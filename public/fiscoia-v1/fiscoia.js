// ==========================================================
// 🛡️ FISCOIA — MÓDULO CND / CERTIDÕES NEGATIVAS — v1.1.0
// Atualizado 2026 · Links Oficiais · Federal / Estadual / Municipal / FGTS
// Controle de Validade · Alertas Automáticos · Por Cliente · Agenda Fiscal
// ==========================================================

// ===================== DADOS SALVOS =====================
let clientesRaw = JSON.parse(localStorage.getItem('fiscoia_clientes')) || [];
let certidoesCNDRaw = JSON.parse(localStorage.getItem('fiscoia_cnd')) || [];

// Limpa qualquer cliente que não seja da Morad
let clientes = clientesRaw.filter(c => {
    const nome = (c.razao || '').toUpperCase();
    const doc = (c.doc || '').replace(/\D/g, '');
    const ehTeste = nome.includes('ROTA 85') || nome.includes('AUTO POSTO') || nome.includes('MERCADO CENTRAL') || nome.includes('CLINICA') || nome.includes('ALPHA') || nome.includes('BETA') || doc === '12345678000190';
    return !ehTeste && (nome.includes('MORAD') || nome.includes('MURAD'));
});

if (clientes.length === 0) {
    clientes = [
        { id: 1, razao: 'MORAD CONTABILIDADE LTDA', doc: '00.111.222/0001-33', regime: 'Simples Nacional', certificado: { tipo: 'A1', validade: '2026-12-31' }, data: '01/01/2026' }
    ];
}
localStorage.setItem('fiscoia_clientes', JSON.stringify(clientes));

// Limpa certidões antigas de empresas de teste
let certidoesCND = certidoesCNDRaw.filter(c => {
    const nome = (c.clienteNome || '').toUpperCase();
    const doc = (c.clienteDoc || '').replace(/\D/g, '');
    const ehTeste = nome.includes('ROTA 85') || nome.includes('AUTO POSTO') || nome.includes('MERCADO CENTRAL') || nome.includes('CLINICA') || nome.includes('ALPHA') || nome.includes('BETA') || doc === '12345678000190';
    return !ehTeste;
});

if (certidoesCND.length === 0 && clientes.length > 0) {
    const hojeData = new Date();
    const em180Dias = new Date();
    em180Dias.setDate(hojeData.getDate() + 180);
    const em90Dias = new Date();
    em90Dias.setDate(hojeData.getDate() + 90);

    certidoesCND = [
        {
            id: 101,
            clienteId: clientes[0].id,
            clienteNome: clientes[0].razao,
            clienteDoc: clientes[0].doc,
            tipo: 'federal',
            numero: 'RFB-2026-MORAD-9921',
            emissao: hojeData.toISOString().split('T')[0],
            validade: em180Dias.toISOString().split('T')[0],
            obs: 'Certidão Conjunta RFB/PGFN regular.',
            dataCadastro: new Date().toISOString()
        },
        {
            id: 102,
            clienteId: clientes[0].id,
            clienteNome: clientes[0].razao,
            clienteDoc: clientes[0].doc,
            tipo: 'fgts',
            numero: 'CRF-CEF-MORAD-88',
            emissao: hojeData.toISOString().split('T')[0],
            validade: em90Dias.toISOString().split('T')[0],
            obs: 'Certificado de Regularidade do FGTS regular.',
            dataCadastro: new Date().toISOString()
        },
        {
            id: 103,
            clienteId: clientes[0].id,
            clienteNome: clientes[0].razao,
            clienteDoc: clientes[0].doc,
            tipo: 'estadual',
            numero: 'SEFAZ-GO-MORAD-01',
            emissao: hojeData.toISOString().split('T')[0],
            validade: em90Dias.toISOString().split('T')[0],
            obs: 'Certidão Negativa Tributária Estadual Goiás regular.',
            dataCadastro: new Date().toISOString()
        }
    ];
    localStorage.setItem('fiscoia_cnd', JSON.stringify(certidoesCND));
}

// ===================== LINKS OFICIAIS — ATUALIZADOS 2026 =====================
const LINKS_EMISSAO = {
    federal: 'https://www.gov.br/pt-br/servicos/emitir-certidao-de-regularidade-fiscal',
    estadual: 'https://www.sefaz.go.gov.br/Certidao/Emissao/',
    municipal: 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00300f0.asp',
    fgts: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf'
};

const NOMES_TIPOS = {
    federal: '🏛️ CND Federal (RFB + INSS)',
    estadual: '🏢 CND Estadual — SEFAZ-GO',
    municipal: '🏘️ CND Municipal — Prefeitura',
    fgts: '💰 CRF — FGTS'
};

// ===================== FUNÇÕES AUXILIARES =====================
function hoje() { return new Date(); }

function formatarData(data) {
    if (!data) return '—';
    const partes = data.split('-');
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    const d = new Date(data);
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
}

function diasAteVencimento(dataValidade) {
    const alvo = new Date(dataValidade + 'T23:59:59');
    const agora = new Date();
    agora.setHours(0,0,0,0);
    return Math.ceil((alvo - agora) / (1000 * 60 * 60 * 24));
}

function definirStatusCND(dataValidade) {
    const dias = diasAteVencimento(dataValidade);
    if (dias < 0) return 'vencida';
    if (dias <= 10) return 'alerta';
    return 'valida';
}

function textoStatus(status) {
    switch(status) {
        case 'valida': return '✅ Válida';
        case 'alerta': return '🟡 A vencer';
        case 'vencida': return '🔴 Vencida';
        default: return '—';
    }
}

// ===================== NAVEGAÇÃO MENU =====================
const botoesLateral = document.querySelectorAll('.item-menu');
const paginas = document.querySelectorAll('.pagina');

botoesLateral.forEach(botao => {
    botao.addEventListener('click', () => {
        botoesLateral.forEach(b => b.classList.remove('ativo'));
        botao.classList.add('ativo');
        paginas.forEach(p => p.classList.remove('ativa'));
        const alvo = document.getElementById(`pagina-${botao.dataset.pagina}`);
        if (alvo) alvo.classList.add('ativa');
        
        if (botao.dataset.pagina === 'cnd') {
            preencherSelectClientesCND();
            renderizarListaCND();
        }
        if (botao.dataset.pagina === 'inicio') {
            atualizarResumoCND();
        }
        if (botao.dataset.pagina === 'agenda') {
            preencherSelectClientesAgenda();
            renderizarAgendaFiscal();
        }
        if (botao.dataset.pagina === 'empresas') {
            atualizarListaClientes();
        }
    });
});

// FILTROS DA CND
document.querySelectorAll('.btn-filtro[data-filtro]').forEach(botao => {
    botao.addEventListener('click', () => {
        document.querySelectorAll('.btn-filtro[data-filtro]').forEach(b => b.classList.remove('ativo'));
        botao.classList.add('ativo');
        renderizarListaCND(botao.dataset.filtro);
    });
});

document.getElementById('cnd-filtro-cliente')?.addEventListener('change', () => {
    const filtroAtivo = document.querySelector('.btn-filtro[data-filtro].ativo')?.dataset.filtro || 'todas';
    renderizarListaCND(filtroAtivo);
});

// MENU CONFIGURAÇÕES TOGGLE
const btnConfig = document.getElementById('btn-config');
const menuConfig = document.getElementById('menu-config');
const fecharConfig = document.getElementById('fechar-config');

btnConfig?.addEventListener('click', (e) => {
    e.stopPropagation();
    menuConfig?.classList.toggle('aberto');
});
fecharConfig?.addEventListener('click', () => {
    menuConfig?.classList.remove('aberto');
});
document.addEventListener('click', (e) => {
    if (menuConfig && !menuConfig.contains(e.target) && e.target !== btnConfig) {
        menuConfig.classList.remove('aberto');
    }
});

// ===================== MÓDULO CND — FUNÇÕES PRINCIPAIS =====================

// Preencher selects com clientes
function preencherSelectClientesCND() {
    const filtroPag = document.getElementById('cnd-filtro-cliente');
    const modalSel = document.getElementById('cnd-modal-cliente');
    const opts = clientes.map(c => `<option value="${c.id}">${c.razao} — ${c.doc}</option>`).join('');
    
    if (filtroPag) {
        const selAtual = filtroPag.value;
        filtroPag.innerHTML = `<option value="todos">Todos os Clientes</option>${opts}`;
        if (selAtual) filtroPag.value = selAtual;
    }
    if (modalSel) {
        modalSel.innerHTML = `<option value="">Selecione um cliente...</option>${opts}`;
    }
}

// Abrir / Fechar Modal
function abrirModalCadastrarCND() {
    const modal = document.getElementById('modal-cnd');
    if (modal) modal.style.display = 'flex';
    preencherSelectClientesCND();
    
    // Sugere data de emissão como hoje
    const campoEmissao = document.getElementById('cnd-modal-emissao');
    if (campoEmissao && !campoEmissao.value) {
        campoEmissao.value = new Date().toISOString().split('T')[0];
    }
}

function fecharModalCND() {
    const modal = document.getElementById('modal-cnd');
    if (modal) modal.style.display = 'none';
    ['cnd-modal-cliente','cnd-modal-tipo','cnd-modal-numero','cnd-modal-emissao','cnd-modal-validade','cnd-modal-arquivo','cnd-modal-obs']
        .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
}

// Salvar Nova Certidão
function salvarCND() {
    const clienteId = document.getElementById('cnd-modal-cliente')?.value;
    const tipo = document.getElementById('cnd-modal-tipo')?.value;
    const numero = document.getElementById('cnd-modal-numero')?.value.trim();
    const emissao = document.getElementById('cnd-modal-emissao')?.value;
    const validade = document.getElementById('cnd-modal-validade')?.value;
    const obs = document.getElementById('cnd-modal-obs')?.value.trim();

    if (!clienteId || !tipo || !numero || !emissao || !validade) {
        return alert('⚠️ Preencha todos os campos obrigatórios: Cliente, Tipo, Número, Emissão e Validade!');
    }

    const cliente = clientes.find(c => String(c.id) === String(clienteId));
    
    const novaCND = {
        id: Date.now(),
        clienteId: parseInt(clienteId),
        clienteNome: cliente?.razao || 'Cliente sem nome',
        clienteDoc: cliente?.doc || '—',
        tipo,
        numero,
        emissao,
        validade,
        obs,
        dataCadastro: new Date().toISOString()
    };

    certidoesCND.push(novaCND);
    localStorage.setItem('fiscoia_cnd', JSON.stringify(certidoesCND));
    
    fecharModalCND();
    renderizarListaCND();
    atualizarResumoCND();
    alert('✅ Certidão CND cadastrada com sucesso!');
}

// Renderizar Lista de Certidões
function renderizarListaCND(filtro = 'todas') {
    const clienteFiltro = document.getElementById('cnd-filtro-cliente')?.value || 'todos';
    let lista = [...certidoesCND].sort((a,b) => new Date(a.validade) - new Date(b.validade));

    // Filtro de tipo
    if (filtro !== 'todas' && filtro !== 'vencidas') {
        lista = lista.filter(c => c.tipo === filtro);
    }
    if (filtro === 'vencidas') {
        lista = lista.filter(c => definirStatusCND(c.validade) === 'vencida');
    }
    
    // Filtro de cliente
    if (clienteFiltro !== 'todos') {
        lista = lista.filter(c => String(c.clienteId) === String(clienteFiltro));
    }

    const container = document.getElementById('lista-cnd');
    if (!container) return;

    if (!lista.length) {
        container.innerHTML = '<p class="vazio">Nenhuma certidão encontrada para este filtro. Clique em "Cadastrar Certidão" para registrar uma nova 📄</p>';
        atualizarResumoCND();
        return;
    }

    container.innerHTML = lista.map(cnd => {
        const status = definirStatusCND(cnd.validade);
        const dias = diasAteVencimento(cnd.validade);
        const linkEmissao = LINKS_EMISSAO[cnd.tipo] || '#';
        
        let rotuloDias = '';
        if (status === 'vencida') {
            rotuloDias = `(venceu há ${Math.abs(dias)} dias)`;
        } else if (dias === 0) {
            rotuloDias = `(vence hoje)`;
        } else {
            rotuloDias = `(faltam ${dias} dias)`;
        }

        return `
            <div class="item-cnd ${status}">
                <div class="cabecalho-cnd">
                    <div>
                        <span class="tipo-cnd">${NOMES_TIPOS[cnd.tipo] || cnd.tipo}</span>
                        <div class="cliente-cnd">${cnd.clienteNome} · CNPJ: ${cnd.clienteDoc}</div>
                    </div>
                    <span class="status-cnd ${status}">${textoStatus(status)} ${rotuloDias}</span>
                </div>
                <div class="dados-cnd">
                    <div><strong>Nº / Protocolo</strong>${cnd.numero}</div>
                    <div><strong>Emissão</strong>${formatarData(cnd.emissao)}</div>
                    <div><strong>Validade</strong>${formatarData(cnd.validade)}</div>
                </div>
                ${cnd.obs ? `<p style="margin-top:8px; font-size:13px; color:#4b5563; background:#f8fafc; padding:6px 10px; border-radius:6px;">📝 <strong>Obs:</strong> ${cnd.obs}</p>` : ''}
                <div class="acoes-cnd">
                    <a class="btn-acao-cnd btn-emitir-novo" href="${linkEmissao}" target="_blank" rel="noopener noreferrer">🔗 Emitir / Consultar Oficial</a>
                    <button class="btn-acao-cnd btn-excluir-cnd" onclick="excluirCND(${cnd.id})">🗑️ Excluir</button>
                </div>
            </div>
        `;
    }).join('');

    atualizarResumoCND();
}

// Excluir Certidão
function excluirCND(id) {
    if (!confirm('Tem certeza que deseja excluir esta certidão do controle?')) return;
    certidoesCND = certidoesCND.filter(c => c.id !== id);
    localStorage.setItem('fiscoia_cnd', JSON.stringify(certidoesCND));
    renderizarListaCND();
    atualizarResumoCND();
}

// Atualizar Resumo na Página Inicial
function atualizarResumoCND() {
    const total = certidoesCND.length;
    const valida = certidoesCND.filter(c => definirStatusCND(c.validade) === 'valida').length;
    const alerta = certidoesCND.filter(c => definirStatusCND(c.validade) === 'alerta').length;
    const vencida = certidoesCND.filter(c => definirStatusCND(c.validade) === 'vencida').length;

    const elTotal = document.getElementById('qtd-cnd-total');
    const elValida = document.getElementById('qtd-cnd-valida');
    const elAlerta = document.getElementById('qtd-cnd-alerta');
    const elVencida = document.getElementById('qtd-cnd-vencida');
    const elAlertas = document.getElementById('cnd-alertas-inicio');

    if (elTotal) elTotal.textContent = total;
    if (elValida) elValida.textContent = valida;
    if (elAlerta) elAlerta.textContent = alerta;
    if (elVencida) elVencida.textContent = vencida;

    // Alertas de certidões próximas de vencer na página inicial
    if (elAlertas) {
        const proximas = certidoesCND
            .filter(c => {
                const s = definirStatusCND(c.validade);
                return s === 'alerta' || s === 'vencida';
            })
            .sort((a,b) => new Date(a.validade) - new Date(b.validade))
            .slice(0, 5);

        if (!proximas.length) {
            elAlertas.innerHTML = '<p class="vazio">Todas as certidões estão em dia ✅ Nenhuma pendência encontrada.</p>';
        } else {
            elAlertas.innerHTML = proximas.map(cnd => {
                const status = definirStatusCND(cnd.validade);
                const dias = diasAteVencimento(cnd.validade);
                const descPrazo = status === 'vencida' ? `Venceu há ${Math.abs(dias)} dias` : (dias === 0 ? 'Vence HOJE' : `Faltam ${dias} dias`);
                return `
                    <div class="item-cnd ${status}" style="padding:14px 18px; margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                            <div>
                                <strong>${NOMES_TIPOS[cnd.tipo] || cnd.tipo}</strong>
                                <div style="font-size:13px; color:#1e40af; font-weight:600;">${cnd.clienteNome}</div>
                                <small style="color:#64748b;">Validade: ${formatarData(cnd.validade)}</small>
                            </div>
                            <span class="status-cnd ${status}">${descPrazo}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

// ===================== CADASTRO DE EMPRESAS — FINAL: SÓ 3 CAMPOS =====================
function salvarCliente() {
    const razao = document.getElementById('cli-razao').value.trim();
    const doc = document.getElementById('cli-documento').value.replace(/\D/g,'');
    const im = document.getElementById('cli-im').value.trim();        // ✅ IM
    const cnae = document.getElementById('cli-cnae').value.trim();    // ✅ CNAE
    const regime = document.getElementById('cli-regime').value;
    const certVenc = document.getElementById('cli-certificado-venc').value; // ✅ Certificado

    if (!razao || !doc) return alert('⚠️ Preencha Razão Social e CNPJ!');

    // ⚠️ Aviso automático do Certificado Digital
    let avisoCert = '';
    if (certVenc) {
        const diasCert = diasAteVencimento(certVenc);
        if (diasCert < 0) avisoCert = '⚠️ ATENÇÃO: Certificado JÁ VENCEU!';
        else if (diasCert <= 30) avisoCert = `⚠️ Certificado vence em ${diasCert} dias!`;
    }

    const novoCliente = {
        id: Date.now(),
        razao,
        doc,
        im,         // ✅ Inscrição Municipal
        cnae,       // ✅ CNAE
        regime,
        certVenc,   // ✅ Vencimento Certificado
        dataCadastro: new Date().toLocaleDateString('pt-BR')
    };

    clientes.push(novoCliente);
    localStorage.setItem('fiscoia_clientes', JSON.stringify(clientes));

    // Sincroniza também com o formato do React app se existir
    try {
        const empresasReact = JSON.parse(localStorage.getItem('fiscoia_empresas_list')) || [];
        empresasReact.push({
            id: String(novoCliente.id),
            razaoSocial: razao,
            nomeFantasia: razao.split(' ')[0],
            cnpj: doc,
            inscricaoMunicipal: im,
            cnaePrincipal: cnae,
            regimeTributario: regime === 'simples' || regime === 'Simples Nacional' ? 'SIMPLES_NACIONAL' : (regime === 'real' || regime === 'Lucro Real' ? 'LUCRO_REAL' : 'LUCRO_PRESUMIDO'),
            certificadoDigital: {
                instalado: !!certVenc,
                tipo: 'A1',
                vencimento: certVenc || '2027-12-31'
            }
        });
        localStorage.setItem('fiscoia_empresas_list', JSON.stringify(empresasReact));
    } catch (e) {
        console.warn('Erro ao sincronizar com app:', e);
    }
    
    // Limpar campos
    ['cli-razao','cli-documento','cli-im','cli-cnae','cli-certificado-venc']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    
    atualizarListaClientes();
    if (typeof preencherSelectClientesCND === 'function') preencherSelectClientesCND();
    if (typeof preencherSelectClientesAgenda === 'function') preencherSelectClientesAgenda();
    
    let msg = '✅ Empresa cadastrada com sucesso!';
    if (avisoCert) msg += '\n' + avisoCert;
    alert(msg);
}

function atualizarListaClientes() {
    const lista = document.getElementById('lista-clientes');
    if (!lista) return;
    
    if (!clientes.length) {
        lista.innerHTML = '<p class="vazio">Nenhuma empresa cadastrada ainda 🏢</p>';
        return;
    }
    
    lista.innerHTML = clientes.map(c => {
        // Status automático do Certificado
        let certTexto = '✅ Válido';
        let certCor = 'green';
        const venc = c.certVenc || (c.certificado && c.certificado.validade);
        if (venc) {
            const dias = diasAteVencimento(venc);
            if (dias < 0) { certTexto = '❌ Vencido'; certCor = 'red'; }
            else if (dias <= 30) { certTexto = `⚠️ Vence em ${dias} dias`; certCor = 'orange'; }
        } else {
            certTexto = '⚪ Sem registro';
            certCor = 'gray';
        }
        
        return `
            <div class="item-cnd valida" style="border-left-color:#3b82f6;">
                <p><strong>${c.razao}</strong></p>
                <p>📄 CNPJ: ${c.doc}</p>
                ${c.im ? `<p>🏘️ IM: ${c.im}</p>` : ''}
                ${c.cnae ? `<p>📊 CNAE: ${c.cnae}</p>` : ''}
                <p>📈 Regime: ${c.regime}</p>
                <p style="color:${certCor};">🔐 Certificado: ${certTexto}</p>
            </div>
        `;
    }).join('');
}

// ===================== AGENDA FISCAL (Prazos Oficiais 2026) =====================
const PRAZOS_OFICIAIS = [
    { nome: 'DCTFWeb (Transmissão Geral)', dia: 15, antecipa: true, desc: 'Apuração eSocial + EFD-Reinf' },
    { nome: 'EFD-Reinf (Retenções)', dia: 15, antecipa: true, desc: 'Retenções federais e notas de serviço' },
    { nome: 'INSS / DARF Previdenciário', dia: 20, antecipa: false, desc: 'Guia gerada após encerramento da DCTFWeb' },
    { nome: 'DAS — Simples Nacional', dia: 20, antecipa: false, desc: 'Tributos unificados Simples Nacional' },
    { nome: 'FGTS Digital', dia: 20, antecipa: true, desc: 'Guia emitida via portal FGTS Digital' },
    { nome: 'PIS / COFINS (Faturamento)', dia: 25, antecipa: false, desc: 'Recolhimento sobre faturamento mensal' },
    { nome: 'IRPJ / CSLL Trimestral', dia: 30, antecipa: false, desc: 'Tributação trimestral Lucro Presumido/Real' }
];

function ajustarFimDeSemana(data, antecipar = false) {
    const d = new Date(data);
    const diaSemana = d.getDay(); // 0 = Dom, 6 = Sab
    if (diaSemana === 0) { // Domingo
        d.setDate(d.getDate() + (antecipar ? -2 : 1));
    } else if (diaSemana === 6) { // Sábado
        d.setDate(d.getDate() + (antecipar ? -1 : 2));
    }
    return d;
}

function preencherSelectClientesAgenda() {
    const sel = document.getElementById('agenda-filtro-cliente');
    if (!sel) return;
    const opts = clientes.map(c => `<option value="${c.id}">${c.razao}</option>`).join('');
    sel.innerHTML = `<option value="todos">Todos os Clientes</option>${opts}`;
}

function renderizarAgendaFiscal(filtro = 'todos') {
    const container = document.getElementById('lista-agenda');
    if (!container) return;

    const clienteFiltro = document.getElementById('agenda-filtro-cliente')?.value || 'todos';
    const hojeData = new Date();
    const ano = hojeData.getFullYear();
    const mes = hojeData.getMonth();

    let itens = [];
    const clientesFiltrados = clienteFiltro === 'todos' ? clientes : clientes.filter(c => String(c.id) === String(clienteFiltro));

    clientesFiltrados.forEach(cli => {
        PRAZOS_OFICIAIS.forEach(prazo => {
            const dataVenc = new Date(ano, mes, prazo.dia);
            const ajustada = ajustarFimDeSemana(dataVenc, prazo.antecipa);
            const dias = diasAteVencimento(ajustada.toISOString().split('T')[0]);
            
            let status = 'verde';
            if (dias < 0) status = 'vermelho';
            else if (dias <= 5) status = 'vermelho';
            else if (dias <= 10) status = 'amarelo';

            itens.push({
                cliente: cli.razao,
                nome: prazo.nome,
                desc: prazo.desc,
                data: ajustada,
                dias,
                status
            });
        });
    });

    itens.sort((a,b) => a.data - b.data);

    if (filtro === 'mes') {
        itens = itens.filter(i => i.data.getMonth() === mes);
    } else if (filtro === '15dias') {
        itens = itens.filter(i => i.dias >= 0 && i.dias <= 15);
    } else if (filtro === 'vencidos') {
        itens = itens.filter(i => i.dias < 0);
    }

    if (!itens.length) {
        container.innerHTML = '<p class="vazio">Nenhum compromisso encontrado para o filtro selecionado.</p>';
        return;
    }

    container.innerHTML = itens.map(item => `
        <div class="item-agenda ${item.status}">
            <div class="cabecalho">
                <div>
                    <span class="nome">${item.nome}</span>
                    <div class="cliente-nome">${item.cliente}</div>
                </div>
                <span class="data">${formatarData(item.data.toISOString().split('T')[0])}</span>
            </div>
            <div class="detalhes">
                <span>📌 ${item.desc}</span>
                <span class="dias">${item.dias < 0 ? `Vencido há ${Math.abs(item.dias)} dias` : (item.dias === 0 ? 'Vence HOJE' : `Faltam ${item.dias} dias`)}</span>
            </div>
        </div>
    `).join('');
}

// Filtros da Agenda
document.querySelectorAll('.btn-filtro[data-filtro-agenda]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-filtro[data-filtro-agenda]').forEach(b => b.classList.remove('ativo'));
        btn.classList.add('ativo');
        renderizarAgendaFiscal(btn.dataset.filtroAgenda);
    });
});

document.getElementById('agenda-filtro-cliente')?.addEventListener('change', () => {
    const filtroAtivo = document.querySelector('.btn-filtro[data-filtro-agenda].ativo')?.dataset.filtroAgenda || 'todos';
    renderizarAgendaFiscal(filtroAtivo);
});

// Funções globais no window para chamadas inline do HTML
window.abrirModalCadastrarCND = abrirModalCadastrarCND;
window.fecharModalCND = fecharModalCND;
window.salvarCND = salvarCND;
window.excluirCND = excluirCND;
window.salvarCliente = salvarCliente;

// ===================== INICIALIZAÇÃO =====================
atualizarListaClientes();
preencherSelectClientesCND();
preencherSelectClientesAgenda();
renderizarListaCND();
atualizarResumoCND();
