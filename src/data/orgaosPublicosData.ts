export interface OrgaoPublicoItem {
  id: string;
  nome: string;
  sigla: string;
  esfera: 'federal' | 'estadual' | 'municipal' | 'trabalhista' | 'judiciario';
  uf?: string;
  cidade?: string;
  descricao: string;
  urlEmissaoCnd?: string;
  urlPortalPrincipal: string;
  servicosPrincipais: string[];
  /** Catálogo estático; não representa disponibilidade nem conexão ao órgão. */
  status: 'portal_listado' | 'manutencao' | 'alerta';
  icone: string;
}

// ============================================================================
// 🏛️ ESFERA FEDERAL (RECEITA FEDERAL, PGFN, SIMPLES NACIONAL, SERPRO)
// ============================================================================
export const ORGAOS_FEDERAIS: OrgaoPublicoItem[] = [
  {
    id: 'rfb_ecac',
    nome: 'Receita Federal do Brasil — Portal e-CAC',
    sigla: 'RFB / e-CAC',
    esfera: 'federal',
    descricao: 'Centro Virtual de Atendimento da Receita Federal. Apuração de DCTFWeb, DARF, parcelamentos, procurações e compliance.',
    urlEmissaoCnd: 'https://servicos.receitafederal.gov.br/servico/certidoes',
    urlPortalPrincipal: 'https://cav.receita.fazenda.gov.br/ecac/',
    servicosPrincipais: ['DCTFWeb', 'DARF Numerado', 'Procuração Eletrônica', 'DIPJ/DIRF/SPED', 'Caixa Postal Fiscal'],
    status: 'portal_listado',
    icone: '🏛️'
  },
  {
    id: 'rfb_cnd_conjunta',
    nome: 'Certidão Negativa de Débitos Federal (RFB e PGFN)',
    sigla: 'CND Federal Conjunta',
    esfera: 'federal',
    descricao: 'Emissão oficial de certidão de débitos relativos a tributos federais e à dívida ativa da União (inclui INSS/Previdência).',
    urlEmissaoCnd: 'https://servicos.receitafederal.gov.br/servico/certidoes',
    urlPortalPrincipal: 'https://www.gov.br/pt-br/servicos/emitir-certidao-de-regularidade-fiscal',
    servicosPrincipais: ['Certidão Negativa PJ', 'Certidão Positiva com Efeitos de Negativa', 'Validação de Autenticidade'],
    status: 'portal_listado',
    icone: '📜'
  },
  {
    id: 'simples_nacional',
    nome: 'Portal do Simples Nacional & MEI',
    sigla: 'Simples Nacional',
    esfera: 'federal',
    descricao: 'Emissão de DAS, consulta de débitos, opção pelo Simples, DEFIS, PGDAS-D e parcelamentos especiais.',
    urlEmissaoCnd: 'https://www8.receita.fazenda.gov.br/SimplesNacional/Servicos/Grupo.aspx?grp=1',
    urlPortalPrincipal: 'https://www8.receita.fazenda.gov.br/SimplesNacional/',
    servicosPrincipais: ['PGDAS-D', 'Geração de DAS', 'DEFIS', 'Consulta de Opção', 'Parcelamento Simples'],
    status: 'portal_listado',
    icone: '🟢'
  },
  {
    id: 'serpro_integra',
    nome: 'SERPRO — Integra Contador & APIs Governamentais',
    sigla: 'SERPRO',
    esfera: 'federal',
    descricao: 'Gateway tecnológico oficial da Receita Federal para automação de DCTFWeb, DARF, eSocial e consulta cadastral em lote.',
    urlEmissaoCnd: 'https://loja.serpro.gov.br/integracontador',
    urlPortalPrincipal: 'https://gateway.apiserpro.serpro.gov.br',
    servicosPrincipais: ['API Integra Contador', 'Emissão em Lote de Guias', 'Consulta Situação Fiscal', 'Consulta CNPJ/CPF'],
    status: 'portal_listado',
    icone: '⚡'
  },
  {
    id: 'redesim',
    nome: 'REDESIM — Coletor Nacional & Consulta CNPJ',
    sigla: 'REDESIM',
    esfera: 'federal',
    descricao: 'Rede Nacional para a Simplificação do Registro e da Legalização de Empresas e Negócios. Consulta cadastral e DBE.',
    urlEmissaoCnd: 'https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp',
    urlPortalPrincipal: 'https://www.gov.br/empresas-e-negocios/pt-br/redesim',
    servicosPrincipais: ['Comprovante de CNPJ', 'DBE - Documento Básico de Entrada', 'Viabilidade', 'Consulta de Nome Empresarial'],
    status: 'portal_listado',
    icone: '🌐'
  },
  {
    id: 'dte_judicial',
    nome: 'Domicílio Tributário & Judicial Eletrônico (DTE/CNJ)',
    sigla: 'DTE / DJE',
    esfera: 'federal',
    descricao: 'Comunicações oficiais eletrônicas, citações, intimações fiscais da União e Poder Judiciário.',
    urlPortalPrincipal: 'https://comunicacaoprocessual.cnj.jus.br/',
    servicosPrincipais: ['Intimações Federais', 'Notificações Fiscais', 'Comunicações do Judiciário'],
    status: 'portal_listado',
    icone: '📬'
  }
];

// ============================================================================
// 🏢 ESFERA ESTADUAL (TODAS AS 27 SEFAZ DO BRASIL: 26 ESTADOS + DF)
// ============================================================================
export interface SefazEstado {
  uf: string;
  nomeEstado: string;
  sigla: string;
  urlCnd: string;
  urlPortal: string;
  portalNome: string;
}

export const LISTA_SEFAZ_ESTADOS: SefazEstado[] = [
  {
    uf: 'AC',
    nomeEstado: 'Acre',
    sigla: 'SEFAZ-AC',
    urlCnd: 'https://sefaz.ac.gov.br/certidao-negativa',
    urlPortal: 'https://sefaz.ac.gov.br',
    portalNome: 'Portal SEFAZ Acre'
  },
  {
    uf: 'AL',
    nomeEstado: 'Alagoas',
    sigla: 'SEFAZ-AL',
    urlCnd: 'https://www.sefaz.al.gov.br/certidao-de-debitos',
    urlPortal: 'https://www.sefaz.al.gov.br',
    portalNome: 'Portal SEFAZ Alagoas'
  },
  {
    uf: 'AP',
    nomeEstado: 'Amapá',
    sigla: 'SEFAZ-AP',
    urlCnd: 'https://www.sefaz.ap.gov.br',
    urlPortal: 'https://www.sefaz.ap.gov.br',
    portalNome: 'Portal SEFAZ Amapá'
  },
  {
    uf: 'AM',
    nomeEstado: 'Amazonas',
    sigla: 'SEFAZ-AM',
    urlCnd: 'https://online.sefaz.am.gov.br/cnd/',
    urlPortal: 'https://online.sefaz.am.gov.br',
    portalNome: 'SEFAZ Amazonas Online'
  },
  {
    uf: 'BA',
    nomeEstado: 'Bahia',
    sigla: 'SEFAZ-BA',
    urlCnd: 'https://www.sefaz.ba.gov.br/scripts/certidao/certidao.asp',
    urlPortal: 'https://www.sefaz.ba.gov.br',
    portalNome: 'SEFAZ Bahia'
  },
  {
    uf: 'CE',
    nomeEstado: 'Ceará',
    sigla: 'SEFAZ-CE',
    urlCnd: 'https://www.sefaz.ce.gov.br/certidao-negativa/',
    urlPortal: 'https://www.sefaz.ce.gov.br',
    portalNome: 'SEFAZ Ceará'
  },
  {
    uf: 'DF',
    nomeEstado: 'Distrito Federal',
    sigla: 'SEFAZ-DF',
    urlCnd: 'https://www.receita.fazenda.df.gov.br/certidao',
    urlPortal: 'https://www.receita.fazenda.df.gov.br',
    portalNome: 'Receita do Distrito Federal'
  },
  {
    uf: 'ES',
    nomeEstado: 'Espírito Santo',
    sigla: 'SEFAZ-ES',
    urlCnd: 'https://internet.sefaz.es.gov.br/agenciavirtual/area_publica/cnd/',
    urlPortal: 'https://sefaz.es.gov.br',
    portalNome: 'SEFAZ Espírito Santo'
  },
  {
    uf: 'GO',
    nomeEstado: 'Goiás',
    sigla: 'SEFAZ-GO',
    urlCnd: 'https://www.sefaz.go.gov.br/Certidao/Emissao/',
    urlPortal: 'https://goias.gov.br/economia/',
    portalNome: 'Secretaria da Economia de Goiás'
  },
  {
    uf: 'MA',
    nomeEstado: 'Maranhão',
    sigla: 'SEFAZ-MA',
    urlCnd: 'https://sistemas1.sefaz.ma.gov.br/certidoes/',
    urlPortal: 'https://sistemas1.sefaz.ma.gov.br',
    portalNome: 'SEFAZ Maranhão'
  },
  {
    uf: 'MT',
    nomeEstado: 'Mato Grosso',
    sigla: 'SEFAZ-MT',
    urlCnd: 'https://www.sefaz.mt.gov.br/cnd/',
    urlPortal: 'https://www.sefaz.mt.gov.br',
    portalNome: 'SEFAZ Mato Grosso'
  },
  {
    uf: 'MS',
    nomeEstado: 'Mato Grosso do Sul',
    sigla: 'SEFAZ-MS',
    urlCnd: 'https://www.sefaz.ms.gov.br',
    urlPortal: 'https://www.sefaz.ms.gov.br',
    portalNome: 'SEFAZ Mato Grosso do Sul'
  },
  {
    uf: 'MG',
    nomeEstado: 'Minas Gerais',
    sigla: 'SEFAZ-MG',
    urlCnd: 'https://www2.fazenda.mg.gov.br/sol/ctrl/SOL/CDT/SERVICO_001',
    urlPortal: 'https://www.fazenda.mg.gov.br',
    portalNome: 'SIARE • SEFAZ Minas Gerais'
  },
  {
    uf: 'PA',
    nomeEstado: 'Pará',
    sigla: 'SEFA-PA',
    urlCnd: 'https://app.sefa.pa.gov.br/emissao-certidao/',
    urlPortal: 'https://www.sefa.pa.gov.br',
    portalNome: 'Secretaria da Fazenda do Pará'
  },
  {
    uf: 'PB',
    nomeEstado: 'Paraíba',
    sigla: 'SEFAZ-PB',
    urlCnd: 'https://www.sefaz.pb.gov.br/certidao',
    urlPortal: 'https://www.sefaz.pb.gov.br',
    portalNome: 'SEFAZ Paraíba'
  },
  {
    uf: 'PR',
    nomeEstado: 'Paraná',
    sigla: 'SEFAZ-PR',
    urlCnd: 'https://receita.pr.gov.br',
    urlPortal: 'https://www.fazenda.pr.gov.br',
    portalNome: 'Receita Estadual do Paraná'
  },
  {
    uf: 'PE',
    nomeEstado: 'Pernambuco',
    sigla: 'SEFAZ-PE',
    urlCnd: 'https://efisco.sefaz.pe.gov.br',
    urlPortal: 'https://www.sefaz.pe.gov.br',
    portalNome: 'e-Fisco • SEFAZ Pernambuco'
  },
  {
    uf: 'PI',
    nomeEstado: 'Piauí',
    sigla: 'SEFAZ-PI',
    urlCnd: 'https://web.sefaz.pi.gov.br/certidao/',
    urlPortal: 'https://web.sefaz.pi.gov.br',
    portalNome: 'SEFAZ Piauí'
  },
  {
    uf: 'RJ',
    nomeEstado: 'Rio de Janeiro',
    sigla: 'SEFAZ-RJ',
    urlCnd: 'https://www.fazenda.rj.gov.br',
    urlPortal: 'https://www.fazenda.rj.gov.br',
    portalNome: 'Fisco Fácil • SEFAZ Rio de Janeiro'
  },
  {
    uf: 'RN',
    nomeEstado: 'Rio Grande do Norte',
    sigla: 'SET-RN',
    urlCnd: 'https://uvt.set.rn.gov.br',
    urlPortal: 'https://uvt.set.rn.gov.br',
    portalNome: 'Tributação do Rio Grande do Norte'
  },
  {
    uf: 'RS',
    nomeEstado: 'Rio Grande do Sul',
    sigla: 'SEFAZ-RS',
    urlCnd: 'https://receita.fazenda.rs.gov.br/conteudo/4942/certidao-de-situacao-fiscal',
    urlPortal: 'https://receita.fazenda.rs.gov.br',
    portalNome: 'Receita Estadual do Rio Grande do Sul'
  },
  {
    uf: 'RO',
    nomeEstado: 'Rondônia',
    sigla: 'SEFIN-RO',
    urlCnd: 'https://www.sefin.ro.gov.br',
    urlPortal: 'https://www.sefin.ro.gov.br',
    portalNome: 'Secretaria de Finanças de Rondônia'
  },
  {
    uf: 'RR',
    nomeEstado: 'Roraima',
    sigla: 'SEFAZ-RR',
    urlCnd: 'https://sefaz.rr.gov.br',
    urlPortal: 'https://sefaz.rr.gov.br',
    portalNome: 'SEFAZ Roraima'
  },
  {
    uf: 'SC',
    nomeEstado: 'Santa Catarina',
    sigla: 'SEF-SC',
    urlCnd: 'https://sat.sef.sc.gov.br/tax.net/sat.certidaonegativa/',
    urlPortal: 'https://www.sef.sc.gov.br',
    portalNome: 'SAT • SEFAZ Santa Catarina'
  },
  {
    uf: 'SP',
    nomeEstado: 'São Paulo',
    sigla: 'SEFAZ-SP',
    urlCnd: 'https://www.fazenda.sp.gov.br',
    urlPortal: 'https://portal.fazenda.sp.gov.br',
    portalNome: 'Posto Fiscal Eletrônico • SEFAZ São Paulo'
  },
  {
    uf: 'SE',
    nomeEstado: 'Sergipe',
    sigla: 'SEFAZ-SE',
    urlCnd: 'https://www.sefaz.se.gov.br',
    urlPortal: 'https://www.sefaz.se.gov.br',
    portalNome: 'SEFAZ Sergipe'
  },
  {
    uf: 'TO',
    nomeEstado: 'Tocantins',
    sigla: 'SEFAZ-TO',
    urlCnd: 'https://sefaz.to.gov.br',
    urlPortal: 'https://sefaz.to.gov.br',
    portalNome: 'SEFAZ Tocantins'
  }
];

// ============================================================================
// 🏘️ ESFERA MUNICIPAL (PREFEITURAS & SISTEMAS TRIBUTÁRIOS DO ISS)
// ============================================================================
export interface PrefeituraItem {
  id: string;
  municipio: string;
  uf: string;
  orgaoNome: string;
  urlCnd: string;
  urlPortal: string;
  descricao: string;
}

export const LISTA_PREFEITURAS: PrefeituraItem[] = [
  {
    id: 'pref_goiania',
    municipio: 'Goiânia',
    uf: 'GO',
    orgaoNome: 'Prefeitura de Goiânia — SEFIN / SCCER',
    urlCnd: 'https://www.goiania.go.gov.br/sistemas/saces/asp/saces00000f0.asp?sigla=sccer',
    urlPortal: 'https://www.goiania.go.gov.br/',
    descricao: 'Acesso direto ao sistema SCCER para Certidão de Situação Fiscal do Contribuinte (ISS) e Portal SEFIN Goiânia.'
  },
  {
    id: 'pref_sao_paulo',
    municipio: 'São Paulo',
    uf: 'SP',
    orgaoNome: 'Prefeitura de São Paulo — DUC / Tributos Mobiliários',
    urlCnd: 'https://prefeitura.sp.gov.br/fazenda/w/servicos/certidoes/2397',
    urlPortal: 'https://duc.prefeitura.sp.gov.br',
    descricao: 'DUC - Demonstrativo Unificado do Contribuinte e Certidão Conjunta de Tributos Mobiliários.'
  },
  {
    id: 'pref_rio_janeiro',
    municipio: 'Rio de Janeiro',
    uf: 'RJ',
    orgaoNome: 'Prefeitura do Rio de Janeiro — Carioca Digital / ISS',
    urlCnd: 'https://notacarioca.rio.gov.br',
    urlPortal: 'https://carioca.rio',
    descricao: 'Portal Carioca Digital, Nota Carioca e Certidão Negativa de Débitos do ISS.'
  },
  {
    id: 'pref_belo_horizonte',
    municipio: 'Belo Horizonte',
    uf: 'MG',
    orgaoNome: 'Prefeitura de Belo Horizonte — BHISS Digital',
    urlCnd: 'https://fazenda.pbh.gov.br',
    urlPortal: 'https://prefeitura.pbh.gov.br',
    descricao: 'Portal da Secretaria Municipal de Fazenda e Sistema BHISS Digital.'
  },
  {
    id: 'pref_brasilia',
    municipio: 'Brasília',
    uf: 'DF',
    orgaoNome: 'Governo do Distrito Federal — Receita DF (ISS)',
    urlCnd: 'https://www.receita.fazenda.df.gov.br/certidao',
    urlPortal: 'https://www.receita.fazenda.df.gov.br',
    descricao: 'Portal Integrado da Receita do DF para tributos municipais e estaduais (ISS/ICMS).'
  },
  {
    id: 'pref_curitiba',
    municipio: 'Curitiba',
    uf: 'PR',
    orgaoNome: 'Prefeitura de Curitiba — Finanças & ISS Curitiba',
    urlCnd: 'https://certidao.curitiba.pr.gov.br',
    urlPortal: 'https://financas.curitiba.pr.gov.br',
    descricao: 'Portal Tributário de Curitiba, emissão de CND e certidões imobiliárias/mobiliárias.'
  },
  {
    id: 'pref_porto_alegre',
    municipio: 'Porto Alegre',
    uf: 'RS',
    orgaoNome: 'Prefeitura de Porto Alegre — Secretaria Municipal da Fazenda (SMF)',
    urlCnd: 'https://portoalegre.rs.gov.br/smf',
    urlPortal: 'https://portoalegre.rs.gov.br',
    descricao: 'Emissão de certidões negativas de ISS e tributos municipais de Porto Alegre.'
  },
  {
    id: 'pref_salvador',
    municipio: 'Salvador',
    uf: 'BA',
    orgaoNome: 'Prefeitura de Salvador — SEFAZ Salvador',
    urlCnd: 'https://sefaz.salvador.ba.gov.br',
    urlPortal: 'https://sefaz.salvador.ba.gov.br',
    descricao: 'Nota Salvador e Emissão de Certidões Negativas Mobiliárias da capital baiana.'
  },
  {
    id: 'pref_fortaleza',
    municipio: 'Fortaleza',
    uf: 'CE',
    orgaoNome: 'Prefeitura de Fortaleza — SEFIN Fortaleza',
    urlCnd: 'https://www.sefin.fortaleza.ce.gov.br',
    urlPortal: 'https://www.sefin.fortaleza.ce.gov.br',
    descricao: 'Portal SEFIN Fortaleza, consulta de débitos e certidões municipais de ISS.'
  },
  {
    id: 'pref_recife',
    municipio: 'Recife',
    uf: 'PE',
    orgaoNome: 'Prefeitura do Recife — Portal Finanças',
    urlCnd: 'https://portalfinancas.recife.pe.gov.br',
    urlPortal: 'https://portalfinancas.recife.pe.gov.br',
    descricao: 'Portal de Tributos do Recife, certidões negativas de débito e ISS online.'
  },
  {
    id: 'pref_manaus',
    municipio: 'Manaus',
    uf: 'AM',
    orgaoNome: 'Prefeitura de Manaus — SEMEF Manaus',
    urlCnd: 'https://semef.manaus.am.gov.br',
    urlPortal: 'https://semef.manaus.am.gov.br',
    descricao: 'Secretaria Municipal de Finanças e Tecnologia da Informação de Manaus.'
  },
  {
    id: 'pref_campinas',
    municipio: 'Campinas',
    uf: 'SP',
    orgaoNome: 'Prefeitura de Campinas — Secretaria de Finanças',
    urlCnd: 'https://www.campinas.sp.gov.br/governo/financas/',
    urlPortal: 'https://www.campinas.sp.gov.br',
    descricao: 'Portal Tributário de Campinas e certidão de regularidade fiscal do município.'
  }
];

// ============================================================================
// ⚖️ TRABALHISTA, PREVIDENCIÁRIO & CAIXA (FGTS DIGITAL, TST, CRF)
// ============================================================================
export const ORGAOS_TRABALHISTAS: OrgaoPublicoItem[] = [
  {
    id: 'tst_cndt',
    nome: 'Tribunal Superior do Trabalho — CNDT',
    sigla: 'TST • CNDT',
    esfera: 'trabalhista',
    descricao: 'Certidão Negativa de Débitos Trabalhistas emitida pela Justiça do Trabalho (Banco Nacional de Devedores Trabalhistas - BNDT).',
    urlEmissaoCnd: 'https://www.tst.jus.br/certidao',
    urlPortalPrincipal: 'https://www.tst.jus.br',
    servicosPrincipais: ['Emissão CNDT', 'Validação de Certidão', 'Consulta BNDT'],
    status: 'portal_listado',
    icone: '⚖️'
  },
  {
    id: 'caixa_crf_fgts',
    nome: 'Caixa Econômica Federal — CRF FGTS',
    sigla: 'Caixa CRF FGTS',
    esfera: 'trabalhista',
    descricao: 'Portal oficial da Caixa para consulta do Certificado de Regularidade do FGTS (CRF). A consulta deve ser feita no portal.',
    urlEmissaoCnd: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
    urlPortalPrincipal: 'https://www.caixa.gov.br',
    servicosPrincipais: ['Consulta CRF Empregador', 'Histórico de Regularidade', 'Comprovante Oficial de Quitação'],
    status: 'portal_listado',
    icone: '💰'
  },
  {
    id: 'mte_fgts_digital',
    nome: 'FGTS Digital — Ministério do Trabalho & Serpro',
    sigla: 'FGTS Digital',
    esfera: 'trabalhista',
    descricao: 'Novo sistema oficial de recolhimento do FGTS via Pix com integração ao eSocial e DCTFWeb.',
    urlPortalPrincipal: 'https://fgtsdigital.sistema.gov.br',
    servicosPrincipais: ['Geração de Guia Rápida Pix', 'Gestão de Guias', 'Remunerações para FGTS', 'Certidões'],
    status: 'portal_listado',
    icone: '📱'
  },
  {
    id: 'esocial_gov',
    nome: 'Portal Oficial do eSocial',
    sigla: 'eSocial',
    esfera: 'trabalhista',
    descricao: 'Sistema de Escrituração Digital das Obrigações Fiscais, Previdenciárias e Trabalhistas.',
    urlPortalPrincipal: 'https://www.gov.br/esocial/pt-br',
    servicosPrincipais: ['Folha de Pagamento', 'Eventos S-1200 / S-1210 / S-1299', 'Fechamento de Período', 'SST'],
    status: 'portal_listado',
    icone: '👥'
  }
];

// Helper para obter SEFAZ por UF
export function obterSefazPorUf(uf: string): SefazEstado | undefined {
  if (!uf) return undefined;
  return LISTA_SEFAZ_ESTADOS.find(s => s.uf.toUpperCase() === uf.toUpperCase());
}

// Helper para obter Prefeitura por nome ou UF
export function obterPrefeituraPorNomeOuUf(municipioOuUf: string): PrefeituraItem | undefined {
  if (!municipioOuUf) return undefined;
  const termo = normalizarNomeMunicipio(municipioOuUf);
  return (
    LISTA_PREFEITURAS.find(p => normalizarNomeMunicipio(p.municipio) === termo) ||
    LISTA_PREFEITURAS.find(p => p.uf.toLowerCase() === termo)
  );
}

function normalizarNomeMunicipio(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

/** Só retorna uma prefeitura quando município e UF identificam a mesma cidade. */
export function obterPrefeituraPorMunicipioEUf(municipio: string, uf: string): PrefeituraItem | undefined {
  if (!municipio.trim() || !uf.trim()) return undefined;
  const nome = normalizarNomeMunicipio(municipio);
  const sigla = uf.trim().toUpperCase();
  return LISTA_PREFEITURAS.find(p => p.uf === sigla && normalizarNomeMunicipio(p.municipio) === nome);
}
