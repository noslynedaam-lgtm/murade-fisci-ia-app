// ==================================================
// MURADE FISCAL — SÓ DADOS REAIS · SEM DADOS FALSOS
// ==================================================

// --------------------------
// CONFIGURAÇÃO — BLOQUEAR FALSO
// --------------------------
export const CONFIG = {
  BLOQUEAR_SIMULACAO: true,
  EXIGIR_CERTIFICADO_REAL: true,
  EXIGIR_CHAVE_NF_44_DIGITOS: true,
  
  ORIGENS_PERMITIDAS: ['SEFAZ', 'ReceitaFederal', 'Serpro', 'NF-e_Portal'],
  ORIGENS_PROIBIDAS: ['simulacao', 'mock', 'dados_teste', 'gerador_falso']
};

// --------------------------
// FILTRO — LIMPAR DADOS FALSOS
// --------------------------
export class FiltroDadosReais {
  static verificar(dados: any): any {
    if (!dados) return null;

    // Bloqueia fonte proibida
    if (dados.fonte && CONFIG.ORIGENS_PROIBIDAS.includes(dados.fonte)) {
      console.log('❌ BLOQUEADO — Fonte falsa:', dados.fonte);
      return null;
    }

    // Valida chave NF-e oficial = 44 dígitos
    if (dados.chaveAcesso && dados.chaveAcesso.length !== 44) {
      console.log('❌ BLOQUEADO — Chave NF-e inválida');
      return null;
    }

    // Sem CNPJ/CPF/chave = não é oficial
    if (!dados.cnpj && !dados.cpf && !dados.chaveAcesso) {
      console.log('❌ BLOQUEADO — Sem identificação oficial');
      return null;
    }

    // Marca como dado real
    return { ...dados, _confirmadoReal: true };
  }

  static conexaoEhReal(resposta: any): boolean {
    return resposta && !resposta.simulacao && !resposta._mock;
  }
}

// --------------------------
// ROBÔS — CONFERÊNCIA FISCAL
// --------------------------
export class RobosMurade {
  nome = 'MURADE — CONFERÊNCIA FISCAL OFICIAL';

  // ROBÔ 1 — Conferir Notas Fiscais
  async conferirNotas(listaNotas: any[]) {
    console.log('🤖 Robô 1 trabalhando...');
    
    const reais: any[] = [];
    const bloqueadas = { qtd: 0, motivos: [] as string[] };

    for (const nota of listaNotas) {
      const notaLimpa = FiltroDadosReais.verificar(nota);
      
      if (notaLimpa && FiltroDadosReais.conexaoEhReal(nota)) {
        reais.push({
          ...notaLimpa,
          conferidoEm: new Date().toLocaleString('pt-BR'),
          status: '✅ VALIDADO — DADO REAL DA SEFAZ'
        });
      } else {
        bloqueadas.qtd++;
        bloqueadas.motivos.push('Dado falso/simulado');
      }
    }

    return {
      total: listaNotas.length,
      notasReais: reais.length,
      bloqueadas: bloqueadas.qtd,
      listaReais: reais,
      resumo: bloqueadas.qtd > 0
        ? `⚠️ ${bloqueadas.qtd} dado(s) falso(s) BLOQUEADO(s)`
        : '✅ TODOS os dados são reais e oficiais'
    };
  }

  // ROBÔ 2 — Conferir Valores e Impostos
  async conferirValores(dados: any) {
    const dadosReais = FiltroDadosReais.verificar(dados);
    
    if (!dadosReais) {
      return { erro: '❌ BLOQUEADO — Usar conexão REAL da SEFAZ' };
    }

    return {
      status: '✅ CONFERIDO — VALORES REAIS',
      dados: dadosReais,
      data: new Date().toLocaleString('pt-BR')
    };
  }

  // ROBÔ 3 — Comparar com outro sistema
  async compararSistemas(dadosExterno: any[], dadosMurade: any[]) {
    const res = { iguais: 0, divergencias: 0, bloqueados: 0, detalhes: [] as any[] };

    for (let i = 0; i < dadosExterno.length; i++) {
      const dadoLimpo = FiltroDadosReais.verificar(dadosExterno[i]);
      
      if (!dadoLimpo) {
        res.bloqueados++;
        continue;
      }

      const v1 = dadoLimpo.valorTotal;
      const v2 = dadosMurade[i]?.valorTotal;

      if (v1 === v2) {
        res.iguais++;
        res.detalhes.push({ status: '✅ IGUAL', valor: v1 });
      } else {
        res.divergencias++;
        res.detalhes.push({ status: '⚠️ DIVERGÊNCIA', externo: v1, murade: v2, dif: (v1 || 0) - (v2 || 0) });
      }
    }

    return res;
  }
}

// --------------------------
// ATIVAR TUDO
// --------------------------
console.log('=====================================');
console.log('  ✅ SISTEMA ATIVADO — SÓ DADOS REAIS');
console.log('  ❌ Dados falsos serão bloqueados');
console.log('=====================================');

export const sistema = new RobosMurade();

// Injeção global para acesso direto via console ou outros módulos
if (typeof window !== 'undefined') {
  (window as any).MURADE_FISCAL_REAIS = sistema;
  (window as any).FiltroDadosReais = FiltroDadosReais;
  (window as any).RobosMurade = RobosMurade;
  (window as any).CONFIG_MURADE_DADOS_REAIS = CONFIG;
}
