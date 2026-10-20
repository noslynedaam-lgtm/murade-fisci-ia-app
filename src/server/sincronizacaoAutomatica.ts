import { comContextoTenant, obterPoolBanco } from './persistence';
import { sincronizarDocumentosFiscal } from './fiscalSourceSync.routes';
import { normalizarCnpj, validarCnpj } from '../services/cnpj/cnpjValidation';

// Robô de sincronização Murade Fiscal → Fisco IA.
// - Não consulta a SEFAZ: apenas lê o que o Murade Fiscal já guardou.
// - Uma empresa por vez: o relógio confere a cada minuto e inicia no máximo uma
//   sincronização, então duas empresas nunca começam com menos de 1 minuto de diferença.
// - Cada empresa volta a ser sincronizada 61 minutos depois (a cada hora e 1 minuto);
//   se ainda houver notas na fila, a continuação ocorre em 2 minutos.
const INTERVALO_TICK_MS = 60_000;
const MINUTOS_ENTRE_SINCRONIZACOES = 61;
const MINUTOS_CONTINUACAO = 2;
const DIAS_JANELA = 35;
const PAPEIS = ['OWNER', 'ADMIN', 'CONTADOR', 'OPERADOR'];
const MAX_USUARIOS = 200;

let emExecucao = false;

interface EmpresaDevida {
  userId: string;
  tenantId: string;
  companyId: string;
  cnpj: string;
  cursor: string;
  cursorDia: string;
}

function dataIso(deslocamentoDias = 0): string {
  const data = new Date(Date.now() + deslocamentoDias * 86_400_000);
  return data.toISOString().slice(0, 10);
}

/** Procura a próxima empresa vencida e já reserva a vez dela dentro da mesma transação. */
async function reservarProximaEmpresa(): Promise<EmpresaDevida | null> {
  const pool = obterPoolBanco();
  if (!pool) return null;
  const usuarios = await pool.query('SELECT id FROM fiscoia.users WHERE active = true ORDER BY id LIMIT $1', [MAX_USUARIOS]);
  const tenantsVistos = new Set<string>();
  for (const usuario of usuarios.rows) {
    const userId = String(usuario.id);
    const client = await pool.connect();
    let tenants: string[] = [];
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      const membros = await client.query(
        'SELECT tenant_id FROM fiscoia.tenant_memberships WHERE user_id = $1 AND role = ANY($2::text[])',
        [userId, PAPEIS],
      );
      tenants = membros.rows.map((linha) => String(linha.tenant_id));
      await client.query('COMMIT');
    } catch {
      await client.query('ROLLBACK').catch(() => undefined);
    } finally {
      client.release();
    }
    for (const tenantId of tenants) {
      if (tenantsVistos.has(tenantId)) continue;
      tenantsVistos.add(tenantId);
      const escopo = await comContextoTenant(userId, tenantId, async (c) => {
        const devida = await c.query(
          `SELECT id, cnpj, metadata->'sincronizacaoFiscal' AS sync
             FROM fiscoia.companies
            WHERE tenant_id = $1 AND archived_at IS NULL
              AND (metadata->'sincronizacaoFiscal'->>'proximaEm' IS NULL
                   OR (metadata->'sincronizacaoFiscal'->>'proximaEm')::timestamptz <= now())
            ORDER BY (metadata->'sincronizacaoFiscal'->>'proximaEm') NULLS FIRST, id
            LIMIT 1
            FOR UPDATE`,
          [tenantId],
        );
        const linha = devida.rows[0];
        if (!linha) return null;
        await c.query(
          `UPDATE fiscoia.companies
              SET metadata = jsonb_set(metadata, '{sincronizacaoFiscal}',
                    COALESCE(metadata->'sincronizacaoFiscal', '{}'::jsonb)
                    || jsonb_build_object('iniciadaEm', now(), 'proximaEm', now() + make_interval(mins => $2)))
            WHERE id = $1 AND tenant_id = $3`,
          [linha.id, MINUTOS_ENTRE_SINCRONIZACOES, tenantId],
        );
        return {
          userId,
          tenantId,
          companyId: String(linha.id),
          cnpj: normalizarCnpj(String(linha.cnpj)),
          cursor: typeof linha.sync?.cursor === 'string' ? linha.sync.cursor : '',
          cursorDia: typeof linha.sync?.cursorDia === 'string' ? linha.sync.cursorDia : '',
        } as EmpresaDevida;
      }, PAPEIS);
      if (escopo.autorizado && escopo.resultado) return escopo.resultado;
    }
  }
  return null;
}

async function registrarResultado(empresa: EmpresaDevida, resultado: Record<string, unknown>, minutosAteProxima: number): Promise<void> {
  await comContextoTenant(empresa.userId, empresa.tenantId, async (c) => {
    await c.query(
      `UPDATE fiscoia.companies
          SET metadata = jsonb_set(metadata, '{sincronizacaoFiscal}',
                COALESCE(metadata->'sincronizacaoFiscal', '{}'::jsonb)
                || $3::jsonb
                || jsonb_build_object('concluidaEm', now(), 'proximaEm', now() + make_interval(mins => $4)))
        WHERE id = $1 AND tenant_id = $2`,
      [empresa.companyId, empresa.tenantId, JSON.stringify(resultado), minutosAteProxima],
    );
  }, PAPEIS);
}

export async function executarSincronizacaoAutomatica(): Promise<void> {
  if (emExecucao || !obterPoolBanco() || !process.env.MURADE_INTEGRATION_TOKEN?.trim()) return;
  emExecucao = true;
  try {
    const empresa = await reservarProximaEmpresa();
    if (!empresa) return;
    if (!validarCnpj(empresa.cnpj)) {
      await registrarResultado(empresa, { ok: false, mensagem: 'CNPJ cadastrado inválido; nada foi consultado.', cursor: '', cursorDia: '' }, MINUTOS_ENTRE_SINCRONIZACOES);
      return;
    }
    const hoje = dataIso();
    const cursorValido = empresa.cursor && empresa.cursorDia === hoje ? empresa.cursor : '';
    let resultado;
    try {
      resultado = await sincronizarDocumentosFiscal({
        tenantId: empresa.tenantId,
        companyId: empresa.companyId,
        cnpj: empresa.cnpj,
        desde: dataIso(-DIAS_JANELA),
        ate: hoje,
        cursor: cursorValido,
        documentosPorExecucao: 100,
        documentosPorPagina: 5,
        maxPaginas: 30,
        autenticacao: { workerUserId: empresa.userId },
      });
    } catch {
      await registrarResultado(empresa, { ok: false, mensagem: 'Falha de comunicação com o Murade Fiscal; nova tentativa na próxima hora.', cursor: '', cursorDia: '' }, MINUTOS_ENTRE_SINCRONIZACOES);
      return;
    }
    if (resultado.ok === false) {
      await registrarResultado(empresa, {
        ok: false,
        mensagem: String(resultado.corpo.mensagem || 'Sincronização não concluída.').slice(0, 300),
        cursor: '',
        cursorDia: '',
      }, MINUTOS_ENTRE_SINCRONIZACOES);
      return;
    }
    const corpo = resultado.corpo;
    const continua = corpo.podeHaverMais === true && typeof corpo.proximoCursor === 'string' && corpo.proximoCursor !== '';
    await registrarResultado(empresa, {
      ok: true,
      mensagem: continua ? 'Sincronização parcial; continua em instantes.' : 'Sincronização concluída.',
      importados: corpo.importados,
      repetidos: corpo.repetidos,
      rejeitados: corpo.rejeitados,
      cursor: continua ? corpo.proximoCursor : '',
      cursorDia: continua ? hoje : '',
    }, continua ? MINUTOS_CONTINUACAO : MINUTOS_ENTRE_SINCRONIZACOES);
  } catch {
    console.error('Falha no robô de sincronização Fiscal → Fisco IA.');
  } finally {
    emExecucao = false;
  }
}

export function iniciarSincronizacaoAutomatica(): void {
  if (process.env.FISCOIA_SYNC_AUTOMATICA === '0') {
    console.warn('Sincronização automática Fiscal → Fisco IA desligada por configuração.');
    return;
  }
  if (!obterPoolBanco()) {
    console.warn('Sincronização automática Fiscal → Fisco IA desabilitada: banco permanente não configurado.');
    return;
  }
  const primeira = setTimeout(() => void executarSincronizacaoAutomatica(), 90_000);
  primeira.unref();
  const repeticao = setInterval(() => void executarSincronizacaoAutomatica(), INTERVALO_TICK_MS);
  repeticao.unref();
  console.log('Robô de sincronização Fiscal → Fisco IA habilitado: confere a cada minuto e sincroniza cada empresa a cada 61 minutos.');
}
