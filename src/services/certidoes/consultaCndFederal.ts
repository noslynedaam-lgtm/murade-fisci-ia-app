// Adaptador da CND federal (Receita Federal + PGFN) pelo produto oficial "Consulta CND" do Serpro.
// Fontes oficiais usadas (nada foi inventado fora delas):
//  - https://www.gov.br/conecta/catalogo/apis/consultar-certidao-negativa-de-debito  (operação POST /v1/ConsultaCnd/certidao, validade de 180 dias, filial consulta pela matriz)
//  - https://www.gov.br/conecta/catalogo/apis/consultar-certidao-negativa-de-debito/Documentacao_API_CND.pdf  (campos de entrada/saída, domínio de Status, cobrança só em HTTP 200 e 201, fluxo do Status 7)
//  - https://www.store.serpro.gov.br/consulta-cnd  e  https://www.loja.serpro.gov.br/consultacnd  (contratação por empresa pública ou privada, cobrança por consulta)
// O endereço do gateway de quem contrata pela Loja do Serpro NÃO está nessas páginas; por isso ele vem das variáveis
// SERPRO_CND_BASE_URL e SERPRO_CND_TOKEN_URL, e sem elas a consulta responde "não configurada" sem chamar ninguém.
import type { SituacaoCertidao } from './certidoes';

export interface ConfigCnd { baseUrl: string; tokenUrl: string; consumerKey: string; consumerSecret: string }

export function lerConfigCnd(env: Record<string, string | undefined>): ConfigCnd | null {
  const baseUrl = (env.SERPRO_CND_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const tokenUrl = (env.SERPRO_CND_TOKEN_URL ?? '').trim();
  const consumerKey = (env.SERPRO_CND_CONSUMER_KEY ?? '').trim();
  const consumerSecret = (env.SERPRO_CND_CONSUMER_SECRET ?? '').trim();
  if (!baseUrl || !tokenUrl || !consumerKey || !consumerSecret) return null;
  // Só fala com endereços https do próprio Serpro.
  for (const u of [baseUrl, tokenUrl]) {
    let x: URL; try { x = new URL(u); } catch { return null; }
    if (x.protocol !== 'https:' || !/(^|\.)serpro\.gov\.br$/i.test(x.hostname)) return null;
  }
  return { baseUrl, tokenUrl, consumerKey, consumerSecret };
}

export interface RespostaHttp { status: number; texto: string }
export type ChamadaHttp = (req: { url: string; metodo: 'POST'; cabecalhos: Record<string, string>; corpo: string }) => Promise<RespostaHttp>;

/** Pedido conforme o manual: pessoa jurídica (TipoContribuinte 1, CodigoIdentificacao 9201). */
export function montarPedidoCnd(cnpj: string, chave?: string): Record<string, unknown> {
  return { TipoContribuinte: 1, ContribuinteConsulta: cnpj, CodigoIdentificacao: 9201, GerarCertidaoPdf: true, ...(chave ? { Chave: chave } : {}) };
}

export interface ResultadoConsultaCnd {
  situacao: SituacaoCertidao;
  /** Mensagem do órgão (campo Mensagem) ou a explicação do erro, sem inventar nada. */
  mensagem: string;
  statusOrgao: number | null;
  httpStatus: number;
  numero: string | null;
  emissao: string | null;
  validade: string | null;
  /** Código de TipoCertidao exatamente como o órgão enviou. O manual não lista o significado de cada código; confira no PDF. */
  codigoTipoCertidao: string | null;
  pdfBase64: string | null;
  /** Chave de consulta demorada (Status 7), válida por 1 hora. */
  chave: string | null;
  /** O manual diz que só HTTP 200 e 201 são cobrados. */
  cobrada: boolean;
}

const dataDoOrgao = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

const ERROS_HTTP: Record<number, string> = {
  400: 'O Serpro recusou o pedido (dados inválidos).',
  401: 'O Serpro recusou o acesso: chave inválida, token vencido ou limite do plano atingido.',
  403: 'O Serpro bloqueou o acesso: o IP deste servidor não está autorizado no contrato.',
  404: 'O CNPJ não foi encontrado pelo órgão.',
  415: 'O Serpro não aceitou o formato do pedido.',
  500: 'Erro interno do Serpro. Tente de novo mais tarde.',
  504: 'O Serpro não respondeu a tempo. Tente de novo mais tarde.',
};

export function interpretarRespostaCnd(httpStatus: number, texto: string): ResultadoConsultaCnd {
  const base: ResultadoConsultaCnd = { situacao: 'erro', mensagem: '', statusOrgao: null, httpStatus, numero: null, emissao: null, validade: null, codigoTipoCertidao: null, pdfBase64: null, chave: null, cobrada: httpStatus === 200 || httpStatus === 201 };
  let j: any = null;
  try { j = JSON.parse(texto); } catch { /* corpo não é JSON */ }
  const status = typeof j?.Status === 'number' ? j.Status : null;
  const msgOrgao = typeof j?.Mensagem === 'string' ? j.Mensagem.slice(0, 300) : '';
  base.statusOrgao = status;
  if (!j || typeof j !== 'object') return { ...base, mensagem: ERROS_HTTP[httpStatus] ?? `Resposta inesperada do Serpro (HTTP ${httpStatus}). Nada foi inventado.` };
  if (status === 1 || status === 2) {
    const c = j.Certidao;
    const validade = dataDoOrgao(c?.DataValidade);
    if (!c || !validade) return { ...base, mensagem: 'O órgão informou certidão encontrada/emitida, mas sem a data de validade. Nada foi guardado como válido; confira no portal.' };
    return {
      ...base, situacao: 'emitida', mensagem: msgOrgao || (status === 2 ? 'Certidão emitida.' : 'Certidão encontrada (já válida).'),
      numero: typeof c.CodigoControle === 'string' ? c.CodigoControle : null, emissao: dataDoOrgao(c.DataEmissao), validade,
      codigoTipoCertidao: c.TipoCertidao !== undefined && c.TipoCertidao !== null ? String(c.TipoCertidao) : null,
      pdfBase64: typeof c.DocumentoPdf === 'string' && c.DocumentoPdf ? c.DocumentoPdf : null,
    };
  }
  if (status === 3 || status === 4) return { ...base, situacao: 'nao_emitida', mensagem: msgOrgao || 'O órgão não emitiu a certidão (há pendência ou impedimento). Consulte a situação fiscal no e-CAC.' };
  if (status === 5 || status === 6) return { ...base, situacao: 'indisponivel', mensagem: msgOrgao || 'Análise inconsistente ou base de apoio indisponível; repita a consulta (esta tentativa não é cobrada).', cobrada: false };
  if (status === 7 || httpStatus === 201) return { ...base, situacao: 'em_processamento', mensagem: msgOrgao || 'Consulta em processamento no órgão.', chave: typeof j.Chave === 'string' ? j.Chave : null };
  if (status !== null) return { ...base, mensagem: msgOrgao || ERROS_HTTP[httpStatus] || `O órgão respondeu com o status ${status}.` };
  return { ...base, mensagem: ERROS_HTTP[httpStatus] ?? `Resposta inesperada do Serpro (HTTP ${httpStatus}).` };
}

export interface OpcoesConsultaCnd {
  cnpj: string; config: ConfigCnd; http: ChamadaHttp;
  /** Chave de uma consulta demorada anterior (vale 1 hora): reaproveita sem abrir consulta nova. */
  chaveAnterior?: string | null;
  esperar?: (ms: number) => Promise<void>;
  maxTentativas?: number;
}

export async function consultarCndFederal(o: OpcoesConsultaCnd): Promise<ResultadoConsultaCnd> {
  const esperar = o.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const basic = Buffer.from(`${o.config.consumerKey}:${o.config.consumerSecret}`).toString('base64');
  let tok: RespostaHttp;
  try {
    tok = await o.http({ url: o.config.tokenUrl, metodo: 'POST', cabecalhos: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, corpo: 'grant_type=client_credentials' });
  } catch { return { ...interpretarRespostaCnd(503, ''), mensagem: 'Não foi possível falar com o Serpro. Nada foi cobrado.', cobrada: false }; }
  let token = '';
  try { token = String(JSON.parse(tok.texto)?.access_token ?? ''); } catch { /* sem token */ }
  if (tok.status !== 200 || !token) return { ...interpretarRespostaCnd(tok.status === 200 ? 502 : tok.status, ''), mensagem: 'O Serpro recusou a autenticação (chaves ou contrato). Nada foi cobrado.', cobrada: false };

  const url = `${o.config.baseUrl}/v1/ConsultaCnd/certidao`;
  let chave = o.chaveAnterior ?? undefined;
  let cobrada = false;
  let ultimo!: ResultadoConsultaCnd;
  const max = Math.max(1, Math.min(o.maxTentativas ?? 6, 10));
  for (let i = 0; i < max; i += 1) {
    const corpo = JSON.stringify(montarPedidoCnd(o.cnpj, chave));
    let r: RespostaHttp;
    try { r = await o.http({ url, metodo: 'POST', cabecalhos: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, corpo }); }
    catch { return { ...(ultimo ?? interpretarRespostaCnd(503, '')), situacao: ultimo?.situacao === 'em_processamento' ? 'em_processamento' : 'erro', mensagem: 'A ligação com o Serpro caiu durante a consulta. Confira o extrato do Serpro antes de repetir.', cobrada }; }
    ultimo = interpretarRespostaCnd(r.status, r.texto);
    cobrada = cobrada || (ultimo.cobrada && !chave); // com chave de consulta já aberta o manual não fala em nova cobrança
    if (ultimo.situacao !== 'em_processamento' || !ultimo.chave) break;
    chave = ultimo.chave;
    await esperar(600); // o manual pede no mínimo 500 ms entre as chamadas
  }
  return { ...ultimo, cobrada };
}
