import { EmpresaDados, StatusComplianceEmpresa } from '../../types';

const STORAGE_KEY = 'fiscoia_compliance_empresas_status';
export const EVENTO_STATUS_COMPLIANCE_ATUALIZADO = 'fiscoia_status_compliance_atualizado';

export function obterCompetenciaAtual(data = new Date()): string {
  return `${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
}

export const COMPETENCIA_PADRAO = obterCompetenciaAtual();

export type ResultadoLeituraCompliance =
  | { ok: true; status: Record<string, StatusComplianceEmpresa> }
  | { ok: false; erro: string };

function lerTodosStatusDoStorage(): ResultadoLeituraCompliance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ok: true, status: {} };
    const dados: unknown = JSON.parse(raw);
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
      return { ok: false, erro: 'O histórico local de compliance está em formato inválido. Nenhum registro foi substituído.' };
    }

    const validos = Object.values(dados).every(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      const status = item as Record<string, unknown>;
      return typeof status.empresaId === 'string'
        && typeof status.cnpj === 'string'
        && typeof status.competencia === 'string'
        && typeof status.dadosMesEnviados === 'boolean'
        && typeof status.dctfwebEnviada === 'boolean'
        && typeof status.cndEmitida === 'boolean';
    });
    if (!validos) return { ok: false, erro: 'Há registro de compliance inválido. O histórico foi preservado e não será tratado como vazio.' };

    const seguros = clonarMapaStatus(dados as Record<string, StatusComplianceEmpresa>);
    for (const status of Object.values(seguros)) {
      const temNumeroManual = typeof status.motivoCndNaoSaiu === 'string'
        && status.motivoCndNaoSaiu.startsWith('Certidão informada manualmente:');
      if (status.cndEmitida && !temNumeroManual) {
        status.cndEmitida = false;
        status.motivoCndNaoSaiu = 'Registro antigo sem número de certidão informado; situação oficial não verificada.';
      }
    }
    return { ok: true, status: seguros };
  } catch (err) {
    console.error('Erro ao ler status de compliance do storage:', err);
    return { ok: false, erro: 'Não foi possível ler o histórico local de compliance. Os dados armazenados foram preservados.' };
  }
}

function clonarMapaStatus(dados: Record<string, StatusComplianceEmpresa>) {
  return Object.fromEntries(Object.entries(dados).map(([chave, status]) => [chave, { ...status }])) as Record<string, StatusComplianceEmpresa>;
}

export function obterTodosStatusDoStorage(): ResultadoLeituraCompliance {
  return lerTodosStatusDoStorage();
}

export function salvarTodosStatusNoStorage(dados: Record<string, StatusComplianceEmpresa>): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_STATUS_COMPLIANCE_ATUALIZADO));
    return true;
  } catch (err) {
    console.error('Erro ao salvar status de compliance no storage:', err);
    return false;
  }
}

function statusInicial(empresa: EmpresaDados, competencia: string): StatusComplianceEmpresa {
  return {
    empresaId: empresa.id || empresa.cnpj,
    cnpj: empresa.cnpj,
    competencia,
    // Os campos legados do cadastro não identificam a competência. Não os
    // reutilize para marcar outra competência como recebida/transmitida.
    dadosMesEnviados: false,
    dataEnvioDados: undefined,
    dctfwebEnviada: false,
    dataEnvioDCTFWeb: undefined,
    reciboDCTFWeb: undefined,
    cndEmitida: false,
    motivoCndNaoSaiu: empresa.statusCND === 'REGULAR'
      ? 'Situação regular informada no cadastro, sem número de certidão e sem consulta ao órgão.'
      : empresa.motivoPendenciaCND || (empresa.statusCND === 'PENDENCIA' || empresa.statusCND === 'VENCIDA'
        ? 'Pendência informada no cadastro; confirme no órgão responsável.'
        : 'Situação oficial ainda não consultada.'),
    ultimaAtualizacao: new Date().toISOString()
  };
}

export function obterStatusCompliance(
  empresa: EmpresaDados,
  competencia: string = COMPETENCIA_PADRAO
): StatusComplianceEmpresa {
  const leitura = lerTodosStatusDoStorage();
  if ('erro' in leitura) throw new Error(leitura.erro);
  const chave = `${empresa.id || empresa.cnpj}_${competencia}`;
  return leitura.status[chave] || statusInicial(empresa, competencia);
}

export function obterStatusTodasEmpresas(
  empresas: EmpresaDados[],
  competencia: string = COMPETENCIA_PADRAO
): ResultadoLeituraCompliance {
  const leitura = lerTodosStatusDoStorage();
  if ('erro' in leitura) return leitura;
  const mapa: Record<string, StatusComplianceEmpresa> = {};
  empresas.forEach(empresa => {
    const id = empresa.id || empresa.cnpj;
    const chave = `${id}_${competencia}`;
    mapa[id] = leitura.status[chave] || statusInicial(empresa, competencia);
  });
  return { ok: true, status: mapa };
}

export function atualizarStatusCompliance(
  empresa: EmpresaDados,
  updates: Partial<StatusComplianceEmpresa>,
  competencia: string = COMPETENCIA_PADRAO
): StatusComplianceEmpresa {
  const leitura = lerTodosStatusDoStorage();
  if ('erro' in leitura) throw new Error(leitura.erro);
  const chave = `${empresa.id || empresa.cnpj}_${competencia}`;
  const atual = leitura.status[chave] || statusInicial(empresa, competencia);
  const atualizado: StatusComplianceEmpresa = {
    ...atual,
    ...updates,
    ultimaAtualizacao: new Date().toISOString()
  };
  const todos = { ...leitura.status, [chave]: atualizado };
  if (!salvarTodosStatusNoStorage(todos)) throw new Error('Não foi possível salvar o histórico de compliance neste navegador.');
  return atualizado;
}
