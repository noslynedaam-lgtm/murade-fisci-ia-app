// Motor da Agente IA Murade (idêntico no DP, Fiscal e Contábil; cada sistema só traz as próprias ferramentas).
//
// Princípios:
//  1. A IA nunca acessa o banco nem executa nada por conta própria. Cada ferramenta chama uma rota que
//     já existe no servidor, com a mesma sessão do usuário. Escopo por empresa, perfil "somente consulta"
//     e todas as validações da folha continuam valendo, porque quem decide é a rota, não a IA.
//  2. Consultas rodam na hora. Qualquer alteração vira uma "ação pendente": o usuário vê exatamente o que
//     será feito e só então confirma. A ação confirmada executa uma única vez.
//  3. Os valores de mensagens (guias, folha) vêm do servidor, nunca do texto do modelo.
//  4. Tudo que é proposto, confirmado, recusado ou falha fica registrado.
import crypto from 'node:crypto';

export type ChamarApi = (metodo: 'GET' | 'POST', caminho: string, corpo?: unknown) => Promise<{ status: number; corpo: any }>;

export interface DeclaracaoFerramenta {
  name: string;
  description: string;
  parameters: { type: 'OBJECT'; properties: Record<string, any>; required?: string[] };
}

export interface ChamadaModelo { nome: string; args: Record<string, any> }
export interface RespostaModelo { texto: string; chamadas: ChamadaModelo[]; turnoModelo?: unknown }
export type ModeloIA = (entrada: { instrucao: string; conteudos: any[]; declaracoes: DeclaracaoFerramenta[] }) => Promise<RespostaModelo>;

export interface EventoAuditoria {
  evento: 'proposta' | 'confirmada' | 'recusada' | 'falha' | 'whatsapp_preparado' | 'expirada';
  ferramenta: string;
  cnpj: string | null;
  resumo: string;
  resultado?: string;
}

export interface AcaoParaTela {
  id: string;
  ferramenta: string;
  titulo: string;
  descricao: string[];
  aviso: string | null;
  irreversivel: boolean;
  expiraEm: string;
}

export interface MensagemWhatsAppParaTela {
  empresa: string;
  numero: string | null;
  texto: string;
  link: string;
}
import type { CentralDePedidos } from './agentesEntreSistemas';

export interface ContextoAgente {
  sessaoHash: string;
  login: string;
  hoje: string;
  chamarApi: ChamarApi;
  registrar: (evento: EventoAuditoria) => Promise<void> | void;
  pendentes: ArmazemAcoesPendentes;
  kit: KitAgente;
  /** Protocolo com as Agentes dos outros sistemas Murade. */
  central?: CentralDePedidos;
}

interface AcaoPendente {
  id: string;
  sessaoHash: string;
  login: string;
  ferramenta: string;
  cnpj: string | null;
  titulo: string;
  params: unknown;
  resumo: string;
  expiraEmMs: number;
}

const VALIDADE_ACAO_MS = 15 * 60_000;
const MAX_PENDENTES_POR_SESSAO = 20;
const MAX_PASSOS_MODELO = 6;
const MAX_CHAMADAS_POR_PASSO = 4;
const LIMITE_RESULTADO_FERRAMENTA = 12_000;

export class ArmazemAcoesPendentes {
  private itens = new Map<string, AcaoPendente>();
  constructor(private agora: () => number = () => Date.now()) {}

  private limpar(): void {
    const t = this.agora();
    for (const [id, item] of this.itens) if (item.expiraEmMs <= t) this.itens.delete(id);
  }

  criar(dados: Omit<AcaoPendente, 'id' | 'expiraEmMs'>): AcaoPendente {
    this.limpar();
    const daSessao = [...this.itens.values()].filter((item) => item.sessaoHash === dados.sessaoHash);
    if (daSessao.length >= MAX_PENDENTES_POR_SESSAO) {
      // Descarta a mais antiga: a pessoa claramente deixou de olhar para ela.
      const maisAntiga = daSessao.sort((a, b) => a.expiraEmMs - b.expiraEmMs)[0];
      this.itens.delete(maisAntiga.id);
    }
    const item: AcaoPendente = { ...dados, id: crypto.randomBytes(12).toString('base64url'), expiraEmMs: this.agora() + VALIDADE_ACAO_MS };
    this.itens.set(item.id, item);
    return item;
  }

  /** Retira a ação do armazém (uso único). Devolve motivo quando não pode ser usada. */
  retirar(id: string, sessaoHash: string): { item?: AcaoPendente; motivo?: string } {
    const item = this.itens.get(String(id || ''));
    if (!item || item.sessaoHash !== sessaoHash) return { motivo: 'Ação não encontrada. Ela pode já ter sido confirmada, cancelada ou ter expirado.' };
    this.itens.delete(item.id);
    if (item.expiraEmMs <= this.agora()) return { item, motivo: 'Esta ação expirou. Peça novamente para a IA preparar.' };
    return { item };
  }

  tamanho(): number { this.limpar(); return this.itens.size; }
}

// ---------------------------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------------------------
export const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
export function cnpjDe(valor: unknown): string | null {
  const c = String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{12}\d{2}$/.test(c) ? c : null;
}
export const competenciaDe = (v: unknown): string | null => (typeof v === 'string' && COMPETENCIA.test(v) ? v : null);
export const numeroNaoNegativo = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e9;
export const reais = (v: unknown): string => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const mesAno = (competencia: string): string => `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`;
export const q = (valor: string): string => encodeURIComponent(valor);

export function erroApi(r: { status: number; corpo: any }): { erro: string } {
  const motivo = r.corpo?.motivo || r.corpo?.error || r.corpo?.mensagem;
  return { erro: String(motivo || `O sistema respondeu com erro (HTTP ${r.status}).`).slice(0, 500) };
}
export const ok = (r: { status: number; corpo: any }): boolean => r.status >= 200 && r.status < 300 && r.corpo?.sucesso !== false;

export interface PropostaAcao { params: unknown; titulo: string; descricao: string[]; aviso?: string; irreversivel?: boolean; cnpj: string; resumo: string }

export interface FerramentaLeitura {
  tipo: 'leitura';
  declaracao: DeclaracaoFerramenta;
  executar(ctx: ContextoAgente, args: Record<string, any>): Promise<unknown>;
}
export interface FerramentaAcao {
  tipo: 'acao';
  declaracao: DeclaracaoFerramenta;
  /** Valida os argumentos e monta a proposta. Retorna texto de erro quando algo está faltando ou inválido. */
  preparar(ctx: ContextoAgente, args: Record<string, any>): Promise<PropostaAcao | { erro: string }>;
  executar(ctx: ContextoAgente, params: any): Promise<{ sucesso: boolean; mensagem: string; detalhes?: unknown }>;
}
export interface FerramentaMensagem {
  tipo: 'mensagem';
  declaracao: DeclaracaoFerramenta;
  executar(ctx: ContextoAgente, args: Record<string, any>): Promise<{ erro: string } | { mensagem: MensagemWhatsAppParaTela }>;
}
export type Ferramenta = FerramentaLeitura | FerramentaAcao | FerramentaMensagem;

export interface KitAgente { ferramentas: Ferramenta[]; instrucao: string }

// ---------------------------------------------------------------------------------------------
// Conversa
// ---------------------------------------------------------------------------------------------
export interface TurnoHistorico { papel: 'usuario' | 'ia'; texto: string }
export interface ResultadoConversa { resposta: string; acoes: AcaoParaTela[]; whatsapp: MensagemWhatsAppParaTela[] }

function resultadoParaModelo(valor: unknown): Record<string, unknown> {
  const texto = JSON.stringify(valor ?? {});
  if (texto.length <= LIMITE_RESULTADO_FERRAMENTA) return (valor && typeof valor === 'object' ? valor : { resultado: valor }) as Record<string, unknown>;
  return { aviso: 'Resultado muito grande; mostrando só o começo.', parcial: texto.slice(0, LIMITE_RESULTADO_FERRAMENTA) };
}

async function auditar(ctx: ContextoAgente, evento: EventoAuditoria): Promise<void> {
  try { await ctx.registrar(evento); } catch (erro: any) { console.error('Falha ao registrar ação da Agente IA:', erro?.message || erro); }
}

export async function conversar(ctx: ContextoAgente, modelo: ModeloIA, mensagem: string, historico: TurnoHistorico[] = []): Promise<ResultadoConversa> {
  const porNome = new Map(ctx.kit.ferramentas.map((f) => [f.declaracao.name, f]));
  const declaracoes = ctx.kit.ferramentas.map((f) => f.declaracao);
  const conteudos: any[] = historico.slice(-10).filter((t) => t && typeof t.texto === 'string' && t.texto.trim()).map((t) => ({
    role: t.papel === 'ia' ? 'model' : 'user', parts: [{ text: t.texto.slice(0, 1500) }],
  }));
  conteudos.push({ role: 'user', parts: [{ text: `Data de hoje: ${ctx.hoje}\n${mensagem}` }] });

  const acoes: AcaoParaTela[] = [];
  const whatsapp: MensagemWhatsAppParaTela[] = [];

  for (let passo = 0; passo < MAX_PASSOS_MODELO; passo += 1) {
    const r = await modelo({ instrucao: ctx.kit.instrucao, conteudos, declaracoes });
    if (!r.chamadas.length) {
      return { resposta: r.texto.trim() || 'Não consegui montar uma resposta. Pode repetir o pedido?', acoes, whatsapp };
    }
    conteudos.push(r.turnoModelo ?? { role: 'model', parts: r.chamadas.map((c) => ({ functionCall: { name: c.nome, args: c.args } })) });
    const respostas: any[] = [];
    for (const chamada of r.chamadas.slice(0, MAX_CHAMADAS_POR_PASSO)) {
      let resultado: Record<string, unknown>;
      const ferramenta = porNome.get(chamada.nome);
      const args = chamada.args && typeof chamada.args === 'object' ? chamada.args : {};
      try {
        if (!ferramenta) resultado = { erro: `Ferramenta desconhecida: ${chamada.nome}.` };
        else if (ferramenta.tipo === 'leitura') resultado = resultadoParaModelo(await ferramenta.executar(ctx, args));
        else if (ferramenta.tipo === 'mensagem') {
          const m = await ferramenta.executar(ctx, args);
          if ('erro' in m) resultado = m;
          else {
            whatsapp.push(m.mensagem);
            resultado = { status: 'mensagem_preparada', numeroCadastrado: Boolean(m.mensagem.numero), instrucao: m.mensagem.numero ? 'O botão para abrir o WhatsApp já aparece para o usuário. Avise que ele precisa clicar e enviar.' : 'A empresa não tem WhatsApp de avisos válido cadastrado. O botão abre o WhatsApp sem destinatário. Avise para cadastrar o número na tela Empresa.' };
          }
        } else {
          const proposta = await ferramenta.preparar(ctx, args);
          if ('erro' in proposta) resultado = proposta;
          else {
            const pendente = ctx.pendentes.criar({ sessaoHash: ctx.sessaoHash, login: ctx.login, ferramenta: chamada.nome, cnpj: proposta.cnpj, titulo: proposta.titulo, params: proposta.params, resumo: proposta.resumo });
            acoes.push({ id: pendente.id, ferramenta: chamada.nome, titulo: proposta.titulo, descricao: proposta.descricao, aviso: proposta.aviso ?? null, irreversivel: proposta.irreversivel === true, expiraEm: new Date(pendente.expiraEmMs).toISOString() });
            await auditar(ctx, { evento: 'proposta', ferramenta: chamada.nome, cnpj: proposta.cnpj, resumo: proposta.resumo });
            resultado = { status: 'aguardando_confirmacao_do_usuario', instrucao: 'A ação AINDA NÃO foi executada. O usuário vê um cartão e precisa clicar em Confirmar.' };
          }
        }
      } catch (erro: any) {
        console.error(`Falha na ferramenta ${chamada.nome} da Agente IA:`, erro?.message || erro);
        resultado = { erro: 'Não foi possível concluir esta consulta agora.' };
      }
      respostas.push({ functionResponse: { name: chamada.nome, response: resultado } });
    }
    conteudos.push({ role: 'user', parts: respostas });
  }
  return { resposta: 'Esse pedido ficou longo demais para eu resolver de uma vez. Pode dividir em partes menores?', acoes, whatsapp };
}

export async function confirmarAcao(ctx: ContextoAgente, id: string): Promise<{ sucesso: boolean; mensagem: string; detalhes?: unknown }> {
  const { item, motivo } = ctx.pendentes.retirar(id, ctx.sessaoHash);
  if (!item || motivo) {
    if (item) await auditar(ctx, { evento: 'expirada', ferramenta: item.ferramenta, cnpj: item.cnpj, resumo: item.resumo });
    return { sucesso: false, mensagem: motivo || 'Ação não encontrada.' };
  }
  const ferramenta = ctx.kit.ferramentas.find((f) => f.declaracao.name === item.ferramenta);
  if (!ferramenta || ferramenta.tipo !== 'acao') return { sucesso: false, mensagem: 'Ação não reconhecida.' };
  try {
    const r = await ferramenta.executar(ctx, item.params);
    await auditar(ctx, { evento: r.sucesso ? 'confirmada' : 'falha', ferramenta: item.ferramenta, cnpj: item.cnpj, resumo: item.resumo, resultado: r.mensagem.slice(0, 300) });
    return r;
  } catch (erro: any) {
    console.error(`Falha ao executar a ação ${item.ferramenta}:`, erro?.message || erro);
    await auditar(ctx, { evento: 'falha', ferramenta: item.ferramenta, cnpj: item.cnpj, resumo: item.resumo, resultado: 'erro inesperado' });
    return { sucesso: false, mensagem: 'Não foi possível executar a ação agora. Nada foi alterado de forma confirmada; confira a tela antes de tentar de novo.' };
  }
}

export async function recusarAcao(ctx: ContextoAgente, id: string): Promise<{ sucesso: boolean }> {
  const { item } = ctx.pendentes.retirar(id, ctx.sessaoHash);
  if (item) await auditar(ctx, { evento: 'recusada', ferramenta: item.ferramenta, cnpj: item.cnpj, resumo: item.resumo });
  return { sucesso: Boolean(item) };
}

