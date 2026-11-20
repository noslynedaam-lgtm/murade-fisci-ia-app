// Robô preparador das certidões semiautomáticas (CND estadual, CND municipal, CRF do FGTS e CNDT).
// Roda de madrugada, uma vez por dia, e só CONTA o que falta buscar em cada escritório (nunca empresa, CNPJ ou número).
// Não entra em portal de órgão: esses portais pedem verificação humana (captcha). Quem busca é a pessoa, pelo botão "Buscar agora"
// da tela CND, que copia o CNPJ, abre o portal certo e lê o PDF baixado. A conta da manhã aparece no painel do escritório.
import type { Pool } from 'pg';
import { hojeBrasilia } from '../services/certidoes/certidoes';

export interface LinhaABuscar { escritorio: string; empresas: number; faltando: number; vencidas: number; aRenovar: number }

export function mensagemABuscar(l: LinhaABuscar[]): { texto: string; alerta: boolean } {
  const soma = (f: (x: LinhaABuscar) => number) => l.reduce((s, x) => s + f(x), 0);
  const total = soma((x) => x.faltando + x.vencidas + x.aRenovar);
  if (total === 0) return { texto: 'Tudo em ordem: nenhuma certidão estadual, municipal, CRF ou CNDT faltando, vencida ou para renovar.', alerta: false };
  const quem = l.filter((x) => x.faltando + x.vencidas + x.aRenovar > 0).slice(0, 5)
    .map((x) => `${x.escritorio} (${x.faltando} faltando, ${x.vencidas} vencida(s), ${x.aRenovar} para renovar)`).join('; ');
  // Faltar certidão não é falha do robô: só informa. O alerta de vencida continua com o conferidor de vencimento.
  return { texto: `Fila de certidões para buscar: ${soma((x) => x.faltando)} faltando, ${soma((x) => x.vencidas)} vencida(s) e ${soma((x) => x.aRenovar)} para renovar. ${quem}. A pessoa busca pelo botão "Buscar agora" na tela CND.`, alerta: false };
}

export async function prepararBuscaCertidoes(pool: Pool | null, hoje: string = hojeBrasilia()): Promise<string> {
  if (!pool) return 'Banco indisponível; nada preparado.';
  const adm = await pool.query(`SELECT id FROM fiscoia.users WHERE active = true AND is_admin = true ORDER BY id LIMIT 1`);
  if (!adm.rows[0]) return 'Sem conta administradora; nada preparado.';
  let q;
  try { q = await pool.query('SELECT * FROM fiscoia.platform_certidoes_a_buscar($1::uuid, $2::date)', [adm.rows[0].id, hoje]); }
  catch { return 'Atualização 027 do banco ainda não aplicada; nada preparado.'; }
  return mensagemABuscar(q.rows.map((x): LinhaABuscar => ({ escritorio: String(x.tenant_name), empresas: Number(x.empresas) || 0, faltando: Number(x.faltando) || 0, vencidas: Number(x.vencidas) || 0, aRenovar: Number(x.a_renovar) || 0 }))).texto;
}
