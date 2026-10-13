import { EmpresaDados, StatusComplianceEmpresa } from '../../types';

const STORAGE_KEY = 'fiscoia_compliance_empresas_status';

// Competência padrão corrente
export const COMPETENCIA_PADRAO = '09/2026';

export function obterTodosStatusDoStorage(): Record<string, StatusComplianceEmpresa> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler status de compliance do storage:', err);
    return {};
  }
}

export function salvarTodosStatusNoStorage(dados: Record<string, StatusComplianceEmpresa>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
  } catch (err) {
    console.error('Erro ao salvar status de compliance no storage:', err);
  }
}

/**
 * Retorna o status de conformidade de uma empresa específica na competência.
 * Se ainda não existir registro gravado, inicializa com base nos dados da empresa.
 */
export function obterStatusCompliance(
  empresa: EmpresaDados,
  competencia: string = COMPETENCIA_PADRAO
): StatusComplianceEmpresa {
  const chave = `${empresa.id || empresa.cnpj}_${competencia}`;
  const todos = obterTodosStatusDoStorage();

  if (todos[chave]) {
    return todos[chave];
  }

  const cndEmitida = empresa.statusCND !== 'PENDENCIA' && empresa.statusCND !== 'VENCIDA';

  const novoStatus: StatusComplianceEmpresa = {
    empresaId: empresa.id || empresa.cnpj,
    cnpj: empresa.cnpj,
    competencia,
    dadosMesEnviados: empresa.envioDadosMes === 'ENVIADO',
    dataEnvioDados: empresa.dataEnvioDados,
    dctfwebEnviada: empresa.envioDCTFWeb === 'ENVIADO',
    dataEnvioDCTFWeb: empresa.dataEnvioDCTFWeb,
    reciboDCTFWeb: empresa.reciboDCTFWeb,
    cndEmitida: cndEmitida,
    motivoCndNaoSaiu: !cndEmitida ? (empresa.motivoPendenciaCND || 'Pendência cadastral ou tributária perante a RFB/PGFN') : undefined,
    ultimaAtualizacao: new Date().toISOString()
  };

  todos[chave] = novoStatus;
  salvarTodosStatusNoStorage(todos);
  return novoStatus;
}

/**
 * Retorna o mapa de status para todas as empresas da lista
 */
export function obterStatusTodasEmpresas(
  empresas: EmpresaDados[],
  competencia: string = COMPETENCIA_PADRAO
): Record<string, StatusComplianceEmpresa> {
  const todos = obterTodosStatusDoStorage();
  const mapa: Record<string, StatusComplianceEmpresa> = {};

  empresas.forEach(emp => {
    const id = emp.id || emp.cnpj;
    const chave = `${id}_${competencia}`;
    if (todos[chave]) {
      mapa[id] = todos[chave];
    } else {
      mapa[id] = obterStatusCompliance(emp, competencia);
    }
  });

  return mapa;
}

/**
 * Atualiza o status de uma empresa específica e persiste
 */
export function atualizarStatusCompliance(
  empresa: EmpresaDados,
  updates: Partial<StatusComplianceEmpresa>,
  competencia: string = COMPETENCIA_PADRAO
): StatusComplianceEmpresa {
  const chave = `${empresa.id || empresa.cnpj}_${competencia}`;
  const todos = obterTodosStatusDoStorage();
  const atual = todos[chave] || obterStatusCompliance(empresa, competencia);

  const atualizado: StatusComplianceEmpresa = {
    ...atual,
    ...updates,
    ultimaAtualizacao: new Date().toISOString()
  };

  todos[chave] = atualizado;
  salvarTodosStatusNoStorage(todos);
  return atualizado;
}
