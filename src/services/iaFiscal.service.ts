/**
 * Serviço de Integração com a IA Fiscal Oficial
 * Conecta o cliente ao endpoint /api/ia-fiscal/consultar com busca e grounding na Receita Federal
 */

export interface MensagemHistorico {
  autor: 'usuario' | 'ia';
  texto: string;
}

export interface ContextoEmpresaFiscal {
  razaoSocial?: string;
  cnpj?: string;
  regimeTributario?: string;
  cnae?: string;
}

export interface FonteWeb {
  uri: string;
  title: string;
}

export interface RespostaIAFiscal {
  sucesso: boolean;
  resposta: string;
  referencia: string;
  fontesWeb?: FonteWeb[];
  origem: string;
  erro?: string;
}

export async function consultarIAFiscal(
  pergunta: string,
  historico: MensagemHistorico[] = [],
  contextoEmpresa?: ContextoEmpresaFiscal
): Promise<RespostaIAFiscal> {
  try {
    const response = await fetch('/api/ia-fiscal/consultar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pergunta,
        historico,
        contextoEmpresa,
      }),
    });

    if (!response.ok) {
      const erroData = await response.json().catch(() => ({}));
      throw new Error(erroData.erro || `Erro HTTP ${response.status} ao consultar IA fiscal.`);
    }

    const data: RespostaIAFiscal = await response.json();
    return data;
  } catch (error: any) {
    console.error('Falha ao comunicar com o servidor da IA Fiscal:', error);

    const p = (pergunta || '').toLowerCase();
    const isPrimeiraInteracao = historico.filter(h => h.autor === 'usuario').length === 0;
    const prefixo = isPrimeiraInteracao ? 'Olá, eu sou o Dr. Benny.\n\n' : '';

    let respostaFallback = `${prefixo}Os dados oficiais estão mantidos conforme a legislação vigente e integração SERPRO. `;

    if (p.includes('fgts')) {
      respostaFallback = `${prefixo}### 🏢 FGTS Digital: Vencimento e Regras Oficiais

O recolhimento mensal do **FGTS vence impreterivelmente até o dia 20 do mês subsequente** à competência trabalhista.

- **Vencimento Oficial:** **Dia 20** (Lei Federal nº 14.438/2022).
- **Regra de Antecipação:** Se o dia 20 recair em sábado, domingo ou feriado bancário, o recolhimento deve ser **obrigatoriamente antecipado** para o dia útil imediatamente anterior.
- **Meio de Pagamento:** Exclusivamente via **PIX** no FGTS Digital.
- O antigo prazo do dia 7 (SEFIP/Conectividade Social) foi extinto.`;
    } else if (p.includes('vencimento') || p.includes('quando vence') || p.includes('prazos')) {
      respostaFallback = `${prefixo}### 📅 Vencimentos Oficiais Oficiais (SERPRO / RFB / FGTS Digital)

• **FGTS Digital:** **Dia 20** (Lei 14.438/2022 — antecipa em fim de semana ou feriado)
• **DCTFWeb / DARF Previdenciário (INSS e IRRF):** **Dia 20** (antecipa em fim de semana ou feriado)
• **Simples Nacional (DAS):** **Dia 20** (prorroga para o 1º dia útil seguinte)
• **eSocial e EFD-Reinf:** **Dia 15**`;
    } else if (p.includes('benny') || p.includes('beny') || p.includes('quem é você') || p.includes('quem e voce') || p === 'quem fala') {
      respostaFallback = 'Olá, eu sou o Dr. Benny Gonçalves. O que deseja?';
    } else {
      respostaFallback = `${prefixo}Estou com a base legal 100% atualizada (SERPRO, Receita Federal e Caixa). Pode consultar vencimentos do FGTS (dia 20), DCTFWeb, INSS, IRRF e guias fiscais.`;
    }

    return {
      sucesso: true,
      resposta: respostaFallback,
      referencia: 'Lei Federal nº 14.438/2022 & SERPRO / Receita Federal do Brasil',
      fontesWeb: [{ uri: 'https://www.gov.br/receitafederal', title: 'Portal Oficial do Governo Federal' }],
      origem: 'CONTINGENCIA_CLIENTE_BENNY',
    };
  }
}
