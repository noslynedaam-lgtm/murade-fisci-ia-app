// Protocolo entre as Agentes IA do Murade (DP, Fiscal, Contábil). Este arquivo é idêntico nos três sistemas.
//
// Regras:
//  - PERGUNTA: leitura. O sistema de destino responde na hora com dados reais (consultas registradas).
//  - PEDIDO: nunca executa sozinho no destino. Cai na caixa de pedidos de lá; a agente/usuário daquele
//    sistema aceita ou recusa e responde. Quem pediu acompanha pelo estado do pedido.
//  - Todo envio usa o token de integração e fica registrado (enviado, recebido, respondido, falha).
//  - Pedido que não chegou (destino dormindo/fora do ar) é reenviado por um robô, sem duplicar:
//    o destino ignora o mesmo idPedido repetido.
import { randomUUID, timingSafeEqual } from 'node:crypto';

export type SistemaMurade = 'dp' | 'fiscal' | 'contabil' | 'fiscoia';
export const SISTEMAS: SistemaMurade[] = ['dp', 'fiscal', 'contabil', 'fiscoia'];
export const NOME_SISTEMA: Record<SistemaMurade, string> = { dp: 'Departamento Pessoal', fiscal: 'Fiscal', contabil: 'Contábil', fiscoia: 'Fisco IA' };

export type TipoMensagem = 'pergunta' | 'pedido';
export type EstadoPedido = 'a_enviar' | 'enviado' | 'recebido' | 'aceito' | 'recusado' | 'concluido' | 'falhou';

export interface PedidoEntreAgentes {
  id: string;
  direcao: 'enviado' | 'recebido';
  de: SistemaMurade;
  para: SistemaMurade;
  cnpj: string | null;
  texto: string;
  estado: EstadoPedido;
  resposta: string | null;
  tentativas: number;
  erro: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ArmazemPedidos {
  salvar(p: PedidoEntreAgentes): Promise<void>;
  obter(id: string, direcao: 'enviado' | 'recebido'): Promise<PedidoEntreAgentes | null>;
  listar(direcao: 'enviado' | 'recebido', apenasAbertos: boolean, limite: number): Promise<PedidoEntreAgentes[]>;
}

export class ArmazemPedidosMemoria implements ArmazemPedidos {
  private itens = new Map<string, PedidoEntreAgentes>();
  async salvar(p: PedidoEntreAgentes) { this.itens.set(`${p.direcao}:${p.id}`, { ...p }); }
  async obter(id: string, direcao: 'enviado' | 'recebido') { const i = this.itens.get(`${direcao}:${id}`); return i ? { ...i } : null; }
  async listar(direcao: 'enviado' | 'recebido', apenasAbertos: boolean, limite: number) {
    const abertos: EstadoPedido[] = ['a_enviar', 'enviado', 'recebido', 'aceito'];
    return [...this.itens.values()].filter((i) => i.direcao === direcao && (!apenasAbertos || abertos.includes(i.estado)))
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, limite).map((i) => ({ ...i }));
  }
}

type Consulta = (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
export class ArmazemPedidosPg implements ArmazemPedidos {
  private pronto: Promise<void> | null = null;
  constructor(private consulta: Consulta) {}
  private garantir() {
    if (!this.pronto) {
      this.pronto = this.consulta(`
        CREATE TABLE IF NOT EXISTS agente_pedidos (
          id TEXT NOT NULL, direcao TEXT NOT NULL, de TEXT NOT NULL, para TEXT NOT NULL, cnpj TEXT, texto TEXT NOT NULL,
          estado TEXT NOT NULL, resposta TEXT, tentativas INT NOT NULL DEFAULT 0, erro TEXT,
          criado_em TIMESTAMPTZ NOT NULL DEFAULT now(), atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (id, direcao)
        )`).then(() => undefined).catch((e) => { this.pronto = null; throw e; });
    }
    return this.pronto;
  }
  private linha(r: any): PedidoEntreAgentes {
    return { id: r.id, direcao: r.direcao, de: r.de, para: r.para, cnpj: r.cnpj, texto: r.texto, estado: r.estado, resposta: r.resposta,
      tentativas: Number(r.tentativas), erro: r.erro, criadoEm: new Date(r.criado_em).toISOString(), atualizadoEm: new Date(r.atualizado_em).toISOString() };
  }
  async salvar(p: PedidoEntreAgentes) {
    await this.garantir();
    await this.consulta(
      `INSERT INTO agente_pedidos (id,direcao,de,para,cnpj,texto,estado,resposta,tentativas,erro,criado_em,atualizado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id,direcao) DO UPDATE SET estado=$7, resposta=$8, tentativas=$9, erro=$10, atualizado_em=$12`,
      [p.id, p.direcao, p.de, p.para, p.cnpj, p.texto, p.estado, p.resposta, p.tentativas, p.erro, p.criadoEm, p.atualizadoEm]);
  }
  async obter(id: string, direcao: 'enviado' | 'recebido') {
    await this.garantir();
    const r = await this.consulta('SELECT * FROM agente_pedidos WHERE id=$1 AND direcao=$2', [id, direcao]);
    return r.rows[0] ? this.linha(r.rows[0]) : null;
  }
  async listar(direcao: 'enviado' | 'recebido', apenasAbertos: boolean, limite: number) {
    await this.garantir();
    const r = await this.consulta(
      `SELECT * FROM agente_pedidos WHERE direcao=$1 AND ($2::boolean = false OR estado IN ('a_enviar','enviado','recebido','aceito'))
       ORDER BY criado_em DESC LIMIT $3`, [direcao, apenasAbertos, limite]);
    return r.rows.map((x) => this.linha(x));
  }
}

export function urlDoSistema(s: SistemaMurade, env: Record<string, string | undefined> = process.env): string {
  const chave = { dp: 'MURADE_DP_URL', fiscal: 'MURADE_FISCAL_URL', contabil: 'MURADE_CONTABIL_URL', fiscoia: 'MURADE_FISCOIA_URL' }[s];
  const padrao = { dp: 'https://murade-dp.onrender.com', fiscal: 'https://murade-fiscal-1.onrender.com', contabil: 'https://murade-contabil.onrender.com', fiscoia: 'https://murade-fisco-ia.onrender.com' }[s];
  return (env[chave] || padrao).trim().replace(/\/$/, '');
}

export function tokenValido(cabecalho: string | undefined, esperado = process.env.MURADE_INTEGRATION_TOKEN): boolean {
  if (!esperado) return false;
  const enviado = (cabecalho || '').startsWith('Bearer ') ? (cabecalho as string).slice(7) : '';
  const a = Buffer.from(esperado); const b = Buffer.from(enviado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type Transporte = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; json: any }>;
const transportePadrao: Transporte = async (url, init) => {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  let json: any = null; try { json = await r.json(); } catch { /* corpo vazio */ }
  return { status: r.status, json };
};

export interface Consultas { [nome: string]: (cnpj: string | null) => Promise<unknown> }

export class CentralDePedidos {
  constructor(
    private eu: SistemaMurade,
    private armazem: ArmazemPedidos,
    private consultas: Consultas,
    private transporte: Transporte = transportePadrao,
    private env: Record<string, string | undefined> = process.env,
    private agora: () => Date = () => new Date(),
  ) {}

  private entrega(p: PedidoEntreAgentes, tipo: TipoMensagem) {
    const base = urlDoSistema(p.para, this.env);
    const token = this.env.MURADE_INTEGRATION_TOKEN;
    if (!base) throw new Error(`O endereço do sistema ${NOME_SISTEMA[p.para]} não está configurado (variável de ambiente).`);
    if (!token) throw new Error('Token de integração não configurado.');
    return this.transporte(`${base}/api/integracao/agente/mensagem`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ de: this.eu, tipo, idPedido: p.id, texto: p.texto, cnpj: p.cnpj, consulta: tipo === 'pergunta' ? p.texto : undefined }),
    });
  }

  /** Pergunta direta (somente leitura). `consulta` é o nome registrado no destino. */
  async perguntar(para: SistemaMurade, consulta: string, cnpj: string | null): Promise<{ ok: boolean; dados?: unknown; erro?: string }> {
    if (para === this.eu) return { ok: false, erro: 'Este já é o sistema atual; use as ferramentas locais.' };
    const p: PedidoEntreAgentes = { id: randomUUID(), direcao: 'enviado', de: this.eu, para, cnpj, texto: consulta, estado: 'enviado', resposta: null, tentativas: 1, erro: null, criadoEm: this.agora().toISOString(), atualizadoEm: this.agora().toISOString() };
    try {
      const r = await this.entrega(p, 'pergunta');
      if (r.status === 200 && r.json?.ok) return { ok: true, dados: r.json.dados };
      return { ok: false, erro: String(r.json?.erro || `O sistema ${NOME_SISTEMA[para]} respondeu com erro ${r.status}.`) };
    } catch (e: any) {
      return { ok: false, erro: `Não consegui falar com o ${NOME_SISTEMA[para]} agora (pode estar dormindo ou fora do ar): ${String(e?.message || e)}` };
    }
  }

  /** Pedido: grava primeiro, depois tenta entregar. Se falhar, fica `a_enviar` para o robô reenviar. */
  async pedir(para: SistemaMurade, texto: string, cnpj: string | null): Promise<PedidoEntreAgentes> {
    if (para === this.eu) throw new Error('Não é possível enviar pedido para o próprio sistema.');
    if (!texto.trim()) throw new Error('O pedido está vazio.');
    const agora = this.agora().toISOString();
    const p: PedidoEntreAgentes = { id: randomUUID(), direcao: 'enviado', de: this.eu, para, cnpj, texto: texto.trim().slice(0, 1000), estado: 'a_enviar', resposta: null, tentativas: 0, erro: null, criadoEm: agora, atualizadoEm: agora };
    await this.armazem.salvar(p);
    return this.tentarEntregar(p);
  }

  private async tentarEntregar(p: PedidoEntreAgentes): Promise<PedidoEntreAgentes> {
    p.tentativas += 1; p.atualizadoEm = this.agora().toISOString();
    try {
      const r = await this.entrega(p, 'pedido');
      if (r.status === 200 && r.json?.ok) { p.estado = 'enviado'; p.erro = null; }
      else { p.estado = p.tentativas >= 10 ? 'falhou' : 'a_enviar'; p.erro = String(r.json?.erro || `erro ${r.status}`).slice(0, 200); }
    } catch (e: any) {
      p.estado = p.tentativas >= 10 ? 'falhou' : 'a_enviar'; p.erro = String(e?.message || e).slice(0, 200);
    }
    await this.armazem.salvar(p);
    return p;
  }

  /** Robô de reenvio: roda de tempos em tempos. */
  async reenviarPendentes(): Promise<number> {
    const abertos = (await this.armazem.listar('enviado', true, 50)).filter((p) => p.estado === 'a_enviar');
    for (const p of abertos) await this.tentarEntregar(p);
    return abertos.length;
  }

  /** Chamado pela rota POST /api/integracao/agente/mensagem (já autenticada pelo token). */
  async receber(corpo: any): Promise<{ status: number; corpo: any }> {
    const de = corpo?.de as SistemaMurade;
    if (!SISTEMAS.includes(de) || de === this.eu) return { status: 400, corpo: { ok: false, erro: 'Remetente inválido.' } };
    const cnpj = corpo?.cnpj ? String(corpo.cnpj).replace(/\D/g, '') : null;
    if (corpo?.tipo === 'pergunta') {
      const nome = String(corpo?.consulta || '');
      const fn = this.consultas[nome];
      if (!fn) return { status: 404, corpo: { ok: false, erro: `Consulta desconhecida. Disponíveis aqui: ${Object.keys(this.consultas).join(', ')}.` } };
      try { return { status: 200, corpo: { ok: true, dados: await fn(cnpj) } }; }
      catch (e: any) { return { status: 500, corpo: { ok: false, erro: String(e?.message || 'Falha na consulta.').slice(0, 200) } }; }
    }
    if (corpo?.tipo === 'pedido') {
      const id = String(corpo?.idPedido || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return { status: 400, corpo: { ok: false, erro: 'Identificador do pedido inválido.' } };
      const texto = String(corpo?.texto || '').trim().slice(0, 1000);
      if (!texto) return { status: 400, corpo: { ok: false, erro: 'Pedido vazio.' } };
      if (await this.armazem.obter(id, 'recebido')) return { status: 200, corpo: { ok: true, duplicado: true } };
      const agora = this.agora().toISOString();
      await this.armazem.salvar({ id, direcao: 'recebido', de, para: this.eu, cnpj, texto, estado: 'recebido', resposta: null, tentativas: 0, erro: null, criadoEm: agora, atualizadoEm: agora });
      return { status: 200, corpo: { ok: true } };
    }
    if (corpo?.tipo === 'resposta') {
      const p = await this.armazem.obter(String(corpo?.idPedido || ''), 'enviado');
      if (!p || p.para !== de) return { status: 404, corpo: { ok: false, erro: 'Pedido não encontrado.' } };
      const estado = corpo?.estado as EstadoPedido;
      if (!['aceito', 'recusado', 'concluido'].includes(estado)) return { status: 400, corpo: { ok: false, erro: 'Estado inválido.' } };
      p.estado = estado; p.resposta = String(corpo?.resposta || '').slice(0, 1000); p.atualizadoEm = this.agora().toISOString();
      await this.armazem.salvar(p);
      return { status: 200, corpo: { ok: true } };
    }
    return { status: 400, corpo: { ok: false, erro: 'Tipo de mensagem inválido.' } };
  }

  /** Responde um pedido recebido e avisa quem pediu. Se o aviso falhar, a resposta fica salva aqui. */
  async responder(id: string, estado: 'aceito' | 'recusado' | 'concluido', resposta: string): Promise<{ pedido: PedidoEntreAgentes; avisado: boolean }> {
    const p = await this.armazem.obter(id, 'recebido');
    if (!p) throw new Error('Pedido não encontrado na caixa de entrada.');
    if (p.estado === 'concluido' || p.estado === 'recusado') throw new Error('Este pedido já foi encerrado.');
    p.estado = estado; p.resposta = resposta.slice(0, 1000); p.atualizadoEm = this.agora().toISOString();
    await this.armazem.salvar(p);
    let avisado = false;
    try {
      const base = urlDoSistema(p.de, this.env); const token = this.env.MURADE_INTEGRATION_TOKEN;
      if (base && token) {
        const r = await this.transporte(`${base}/api/integracao/agente/mensagem`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ de: this.eu, tipo: 'resposta', idPedido: id, estado, resposta: p.resposta }) });
        avisado = r.status === 200;
      }
    } catch { avisado = false; }
    return { pedido: p, avisado };
  }

  caixaDeEntrada(apenasAbertos = true) { return this.armazem.listar('recebido', apenasAbertos, 50); }
  enviados(apenasAbertos = false) { return this.armazem.listar('enviado', apenasAbertos, 50); }
}
