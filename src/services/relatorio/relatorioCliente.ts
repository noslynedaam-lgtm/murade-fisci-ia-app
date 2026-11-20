/**
 * Relatório para o cliente: junta, por empresa, o que o escritório JÁ consultou e guardou (situação fiscal, certidões, parcelamentos,
 * Caixa Postal da Receita e certificado A1) e escreve em linguagem simples, com o nome e o logo do escritório.
 * Nada aqui consulta o Serpro ou outro órgão (sem custo): cada informação sai com a data da consulta guardada.
 * A Caixa Postal entra só pelo que a LISTA guardada já mostrou (assunto e data); nenhuma mensagem é aberta (abrir dá ciência).
 * Peças puras: sem rede e sem banco.
 */

export type Cor = 'verde' | 'amarelo' | 'vermelho' | 'cinza';

// ------------------------------------------------------------------ Configuração do relatório (por escritório)
export interface ConfigRelatorio {
  nomeExibido: string | null;
  telefone: string | null;
  email: string | null;
  rodape: string | null;
  /** Logo em JPEG, base64 sem o prefixo "data:". A tela converte PNG/JPG para JPEG antes de enviar. */
  logoJpegBase64: string | null;
}
export const LIMITE_LOGO_BASE64 = 200_000;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const textoOpc = (v: unknown, max: number) => v === null || v === undefined || (typeof v === 'string' && v.length <= max);

export function validarConfigRelatorio(dados: unknown): string | null {
  if (!obj(dados)) return 'Configuração inválida.';
  if (!textoOpc(dados.nomeExibido, 120)) return 'Nome do escritório muito longo (até 120 letras).';
  if (!textoOpc(dados.telefone, 30)) return 'Telefone inválido.';
  if (!textoOpc(dados.email, 120) || (typeof dados.email === 'string' && dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email))) return 'E-mail inválido.';
  if (!textoOpc(dados.rodape, 300)) return 'Rodapé muito longo (até 300 letras).';
  const logo = dados.logoJpegBase64;
  if (logo !== null && logo !== undefined) {
    if (typeof logo !== 'string' || logo.length > LIMITE_LOGO_BASE64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(logo)) return 'Logo inválido ou grande demais.';
    if (!logo.startsWith('/9j/')) return 'O logo precisa estar em JPEG.';
  }
  return null;
}
export function lerConfigRelatorio(dados: unknown): ConfigRelatorio {
  const d = obj(dados) && validarConfigRelatorio(dados) === null ? dados : {};
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return { nomeExibido: s(d.nomeExibido), telefone: s(d.telefone), email: s(d.email), rodape: s(d.rodape), logoJpegBase64: s(d.logoJpegBase64) };
}

// ------------------------------------------------------------------ Entrada (tudo já guardado) e saída
export interface EntradaRelatorio {
  hoje: string;
  escritorio: { nome: string; telefone: string | null; email: string | null; rodape: string | null };
  empresa: { nome: string; cnpj: string };
  situacaoFiscal: { situacao: 'regular' | 'pendente' | 'a_conferir' | null; consultadoEm: string | null } | null;
  caixaPostal: { novas: number | null; consultadoEm: string | null } | null;
  caixaLista: { quantidade: number; naoLidas: number; consultadoEm: string | null; naoLidasAssuntos: { assunto: string; enviadaEm: string }[] } | null;
  parcelamentos: { modalidades: string[]; atrasadas: { nomeModalidade: string; parcela: string; valor: number | null }[]; consultadoEm: string | null } | null;
  certidoes: { tipo: string; rotulo: string; cor: Cor; texto: string; validade: string | null }[];
  certificado: { validade: string | null; dias: number | null } | null;
}
export interface LinhaSecao { texto: string; cor?: Cor }
export interface SecaoRelatorio { id: string; titulo: string; cor: Cor; linhas: LinhaSecao[]; explicacao: string }
export interface PendenciaRelatorio {
  codigo: string;
  /** Texto para o cliente (linguagem simples). */
  texto: string;
  /** Texto curto para a tarefa da equipe. */
  tarefa: string;
  gravidade: 'alta' | 'media' | 'baixa';
  /** Pendência que o cliente precisa saber (entra no PDF). As de "baixa" são trabalho interno do escritório. */
  paraCliente: boolean;
}
export interface RelatorioCliente {
  titulo: string; hoje: string;
  escritorio: EntradaRelatorio['escritorio']; empresa: EntradaRelatorio['empresa'];
  geral: { cor: Cor; titulo: string; frase: string };
  secoes: SecaoRelatorio[];
  pendencias: PendenciaRelatorio[];
  aviso: string;
}

/** AAAA-MM-DD ou ISO com hora -> DD/MM/AAAA (data de Brasília). */
export function dataBr(v: string | null | undefined): string {
  if (!v) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('/');
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(t));
}
/** Dias entre a consulta guardada e hoje (AAAA-MM-DD), pela data de Brasília. */
export function diasDesde(consultadoEm: string | null | undefined, hoje: string): number | null {
  if (!consultadoEm) return null;
  const br = dataBr(consultadoEm);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return null;
  return Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`)) / 86_400_000);
}
export const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function cnpjFormatado(c: string): string {
  const d = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : c;
}
const DIAS_CONSULTA_ANTIGA = 30;
const notaAntiga = (consultadoEm: string | null, hoje: string) => {
  const d = diasDesde(consultadoEm, hoje);
  return d !== null && d > DIAS_CONSULTA_ANTIGA ? ` Esta consulta tem ${d} dias; a situação pode ter mudado desde então.` : '';
};
const PESO: Record<Cor, number> = { vermelho: 0, amarelo: 1, cinza: 2, verde: 3 };
const pior = (cores: Cor[]): Cor => (cores.length ? [...cores].sort((a, b) => PESO[a] - PESO[b])[0] : 'cinza');

export function montarRelatorioCliente(e: EntradaRelatorio): RelatorioCliente {
  const secoes: SecaoRelatorio[] = [];
  const pend: PendenciaRelatorio[] = [];

  // 1) Situação fiscal na Receita Federal
  {
    const sf = e.situacaoFiscal;
    let cor: Cor = 'cinza'; let texto = 'Ainda não consultamos a situação fiscal desta empresa na Receita Federal.';
    if (sf?.situacao === 'regular') { cor = 'verde'; texto = `Na consulta de ${dataBr(sf.consultadoEm)}, o relatório da Receita Federal não apontou pendências.${notaAntiga(sf.consultadoEm, e.hoje)}`; }
    else if (sf?.situacao === 'pendente') {
      cor = 'vermelho'; texto = `Na consulta de ${dataBr(sf.consultadoEm)}, o relatório da Receita Federal apontou pendência(s). O escritório está verificando e vai orientar o que fazer.${notaAntiga(sf.consultadoEm, e.hoje)}`;
      pend.push({ codigo: 'sitfis-pendente', texto: 'A Receita Federal apontou pendência na situação fiscal. Fale com o escritório para regularizar.', tarefa: 'Analisar e regularizar a pendência da situação fiscal (Receita Federal)', gravidade: 'alta', paraCliente: true });
    } else if (sf) {
      cor = 'amarelo'; texto = `Consulta de ${dataBr(sf.consultadoEm)} em análise pelo escritório.`;
      pend.push({ codigo: 'sitfis-conferir', texto: 'A situação fiscal está em análise pelo escritório.', tarefa: 'Conferir o PDF da situação fiscal e marcar regular ou pendente', gravidade: 'baixa', paraCliente: false });
    } else pend.push({ codigo: 'sitfis-consultar', texto: 'Situação fiscal ainda não consultada.', tarefa: 'Consultar a situação fiscal na Receita (pode ter custo; só por clique)', gravidade: 'baixa', paraCliente: false });
    secoes.push({ id: 'situacao', titulo: 'Situação fiscal na Receita Federal', cor, linhas: [{ texto, cor }], explicacao: 'É o relatório da Receita que mostra se há débitos, declarações em falta ou outras pendências no CNPJ.' });
  }

  // 2) Certidões
  {
    const linhas: LinhaSecao[] = e.certidoes.map((c) => {
      const val = c.validade ? ` (válida até ${dataBr(c.validade)})` : '';
      const t = c.cor === 'verde' ? `em dia${val}` : c.cor === 'cinza' ? 'ainda não emitida pelo escritório' : `${c.texto}${c.cor === 'amarelo' && c.validade ? val : ''}`;
      if (c.cor === 'vermelho') pend.push({ codigo: `certidao-${c.tipo}`, texto: `${c.rotulo}: ${c.texto}. Sem ela em dia a empresa pode ter dificuldade para vender a órgãos públicos, pegar empréstimo ou participar de licitação.`, tarefa: `Regularizar e emitir de novo: ${c.rotulo}`, gravidade: 'alta', paraCliente: true });
      else if (c.cor === 'amarelo' && /vence/.test(c.texto)) pend.push({ codigo: `certidao-${c.tipo}`, texto: `${c.rotulo}: ${c.texto}. O escritório vai emitir a nova.`, tarefa: `Emitir a nova ${c.rotulo} (${c.texto})`, gravidade: 'media', paraCliente: true });
      else if (c.cor === 'cinza') pend.push({ codigo: `certidao-${c.tipo}`, texto: `${c.rotulo} ainda não emitida.`, tarefa: `Buscar a ${c.rotulo}`, gravidade: 'baixa', paraCliente: false });
      return { texto: `${c.rotulo}: ${t}`, cor: c.cor };
    });
    secoes.push({ id: 'certidoes', titulo: 'Certidões', cor: pior(e.certidoes.filter((c) => c.cor !== 'cinza').map((c) => c.cor)), linhas: linhas.length ? linhas : [{ texto: 'Nenhuma certidão registrada.', cor: 'cinza' }], explicacao: 'Certidões negativas mostram que a empresa não tem dívidas nos órgãos. Valem até a data indicada no próprio documento.' });
  }

  // 3) Parcelamentos
  {
    const p = e.parcelamentos;
    let cor: Cor = 'cinza'; const linhas: LinhaSecao[] = [];
    if (!p) linhas.push({ texto: 'Nenhum parcelamento consultado pelo escritório.', cor: 'cinza' });
    else if (p.atrasadas.length) {
      cor = 'vermelho';
      for (const a of p.atrasadas) linhas.push({ texto: `${a.nomeModalidade}: parcela de ${a.parcela}${a.valor !== null ? ` (${reais(a.valor)})` : ''} aparece em aberto.`, cor: 'vermelho' });
      linhas.push({ texto: `Consulta de ${dataBr(p.consultadoEm)}. Se já pagou, desconsidere; o pagamento pode levar alguns dias para aparecer.${notaAntiga(p.consultadoEm, e.hoje)}` });
      pend.push({ codigo: 'parcelas-atraso', texto: `Há ${p.atrasadas.length} parcela(s) de parcelamento de meses anteriores em aberto. Parcelas atrasadas podem cancelar o parcelamento.`, tarefa: `Conferir e emitir as parcelas em aberto do parcelamento (${p.atrasadas.map((a) => a.parcela).join(', ')})`, gravidade: 'alta', paraCliente: true });
    } else { cor = 'verde'; linhas.push({ texto: `Nenhuma parcela de meses anteriores em aberto na consulta de ${dataBr(p.consultadoEm)}.${notaAntiga(p.consultadoEm, e.hoje)}`, cor: 'verde' }); }
    secoes.push({ id: 'parcelamentos', titulo: 'Parcelamentos de impostos', cor, linhas, explicacao: 'Parcelamentos do Simples Nacional, do MEI, PERT e RELP consultados na Receita.' });
  }

  // 4) Caixa Postal da Receita (e-CAC) — sem abrir mensagens
  {
    const n = e.caixaPostal; const l = e.caixaLista;
    let cor: Cor = 'cinza'; const linhas: LinhaSecao[] = [];
    const temNova = (n?.novas ?? 0) > 0;
    if (!n && !l) linhas.push({ texto: 'Caixa Postal ainda não consultada pelo escritório.', cor: 'cinza' });
    if (n) linhas.push({ texto: temNova ? `Há mensagem nova na Caixa Postal da Receita (consulta de ${dataBr(n.consultadoEm)}).` : `Sem mensagem nova na consulta de ${dataBr(n.consultadoEm)}.`, cor: temNova ? 'amarelo' : 'verde' });
    if (l) {
      linhas.push({ texto: `Lista de ${dataBr(l.consultadoEm)}: ${l.naoLidas} mensagem(ns) ainda não lida(s).`, cor: l.naoLidas > 0 ? 'amarelo' : 'verde' });
      for (const m of l.naoLidasAssuntos.slice(0, 8)) linhas.push({ texto: `• ${m.enviadaEm ? `${m.enviadaEm} — ` : ''}${m.assunto}` });
    }
    if (temNova || (l?.naoLidas ?? 0) > 0) {
      cor = 'amarelo';
      pend.push({ codigo: 'caixa-postal', texto: 'Há mensagem não lida na Caixa Postal da Receita. Abrir a mensagem conta como ciência oficial; o escritório vai ver com você quem abre e o que fazer.', tarefa: 'Ver com o cliente as mensagens não lidas da Caixa Postal da Receita (abrir dá ciência)', gravidade: 'media', paraCliente: true });
    } else if (n || l) cor = 'verde';
    secoes.push({ id: 'caixa', titulo: 'Caixa Postal da Receita (e-CAC)', cor, linhas, explicacao: 'O escritório NÃO abriu as mensagens: na Receita, abrir a mensagem conta como ciência oficial e começa a contar prazo.' });
  }

  // 5) Certificado digital A1
  {
    const c = e.certificado;
    let cor: Cor = 'cinza'; let texto = 'Certificado digital A1 não cadastrado no escritório.';
    if (c?.validade) {
      const d = c.dias;
      if (d !== null && d < 0) { cor = 'vermelho'; texto = `Venceu em ${dataBr(c.validade)}.`; }
      else if (d !== null && d <= 30) { cor = 'amarelo'; texto = d === 0 ? `Vence hoje (${dataBr(c.validade)}).` : `Vence em ${d} dia(s), em ${dataBr(c.validade)}.`; }
      else { cor = 'verde'; texto = `Válido até ${dataBr(c.validade)}.`; }
      if (cor !== 'verde') pend.push({ codigo: 'certificado-a1', texto: `O certificado digital da empresa ${cor === 'vermelho' ? 'venceu' : 'vence logo'}. Sem ele não dá para emitir nota nem entregar declarações. Providencie a renovação.`, tarefa: `Renovar o certificado digital A1 (${texto})`, gravidade: cor === 'vermelho' ? 'alta' : 'media', paraCliente: true });
    } else if (c) { cor = 'amarelo'; texto = 'Validade não registrada no escritório.'; }
    secoes.push({ id: 'certificado', titulo: 'Certificado digital', cor, linhas: [{ texto, cor }], explicacao: 'O certificado digital é usado para emitir notas e entregar declarações.' });
  }

  const doCliente = pend.filter((p) => p.paraCliente);
  const consultado = secoes.some((s) => s.cor !== 'cinza');
  const geral = doCliente.some((p) => p.gravidade === 'alta')
    ? { cor: 'vermelho' as Cor, titulo: 'Há pendências', frase: 'Encontramos pontos que precisam ser resolvidos. Veja abaixo o que fazer.' }
    : doCliente.length
      ? { cor: 'amarelo' as Cor, titulo: 'Atenção', frase: 'Não há pendência grave, mas há pontos para acompanhar.' }
      : consultado
        ? { cor: 'verde' as Cor, titulo: 'Tudo em dia', frase: 'Nas últimas consultas do escritório não encontramos pendências.' }
        : { cor: 'cinza' as Cor, titulo: 'Sem informações ainda', frase: 'O escritório ainda não tem consultas guardadas desta empresa.' };

  return {
    titulo: 'Relatório de situação fiscal', hoje: e.hoje, escritorio: e.escritorio, empresa: e.empresa, geral, secoes,
    pendencias: pend.sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.gravidade] - { alta: 0, media: 1, baixa: 2 }[b.gravidade])),
    aviso: 'Este relatório reúne as últimas informações consultadas e guardadas pelo escritório, com a data de cada uma. Não é certidão e não substitui os documentos oficiais.',
  };
}

/** Texto curto para o WhatsApp (o link wa.me não anexa arquivo: o PDF vai pelo botão de compartilhar ou baixar). */
export function textoWhatsApp(r: RelatorioCliente): string {
  const doCliente = r.pendencias.filter((p) => p.paraCliente);
  const linhas = [
    `Olá! Aqui é do ${r.escritorio.nome}.`,
    `Resumo da situação fiscal da empresa ${r.empresa.nome} (CNPJ ${cnpjFormatado(r.empresa.cnpj)}) em ${dataBr(r.hoje)}: ${r.geral.titulo.toUpperCase()}.`,
    ...(doCliente.length ? ['', 'Pontos de atenção:', ...doCliente.slice(0, 6).map((p) => `- ${p.texto}`)] : ['', r.geral.frase]),
    '', 'O relatório completo em PDF segue em seguida. Qualquer dúvida, estamos à disposição.',
  ];
  return linhas.join('\n').slice(0, 1800);
}

/** Número para o wa.me: só dígitos, com 55 na frente quando vier com DDD (10 ou 11 dígitos). Nulo se não parecer telefone. */
export function numeroWhatsApp(v: unknown): string | null {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}
export function linkWhatsApp(numero: string | null, texto: string): string {
  return `https://wa.me/${numero ?? ''}?text=${encodeURIComponent(texto)}`;
}
