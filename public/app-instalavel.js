// Aplicativo instalável + usuário do login já preenchido. Nunca guarda senha.
(function () {
  var CH = 'murade_ultimo_login';
  try { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () {}); } catch (e) {}

  function param(n) {
    try {
      var a = new URLSearchParams(location.search).get(n);
      if (a) return a;
      return new URLSearchParams(location.hash.replace(/^#/, '')).get(n) || '';
    } catch (e) { return ''; }
  }
  function lido() { try { return localStorage.getItem(CH) || ''; } catch (e) { return ''; } }
  function gravar(v) { try { if (v) localStorage.setItem(CH, v); } catch (e) {} }

  function achar() {
    var c = document.querySelector('input[autocomplete="username"]');
    if (c) return c;
    var senha = document.querySelector('input[type="password"]');
    var f = senha && senha.form;
    return f ? f.querySelector('input[type="email"], input[type="text"]') : null;
  }
  var desejado = param('login') || lido();
  function preencher() {
    if (!desejado) return;
    var campo = achar();
    if (!campo || campo.value || campo.readOnly || campo.dataset.muradePreenchido) return;
    campo.dataset.muradePreenchido = '1';
    var set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(campo, desejado);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    var senha = document.querySelector('input[type="password"]');
    if (senha) try { senha.focus(); } catch (e) {}
  }
  new MutationObserver(preencher).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('submit', function () {
    var campo = achar();
    if (campo && campo.value) gravar(campo.value.trim());
  }, true);

  var evento = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); evento = e;
    if (document.getElementById('murade-instalar')) return;
    var b = document.createElement('button');
    b.id = 'murade-instalar'; b.type = 'button';
    b.textContent = 'Instalar aplicativo no computador';
    b.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;background:#0f2444;color:#fff;border:1px solid #F2D26E;border-radius:10px;padding:10px 14px;font:600 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)';
    b.onclick = function () { if (!evento) return; evento.prompt(); evento.userChoice.finally(function () { b.remove(); evento = null; }); };
    document.body.appendChild(b);
  });
  window.addEventListener('appinstalled', function () { var b = document.getElementById('murade-instalar'); if (b) b.remove(); });
})();

// Ajuda para achar e fixar o aplicativo. O navegador só oferece "Instalar" quando o aplicativo ainda NÃO está instalado; depois de instalado
// ele não aparece mais e a pessoa não sabe onde o aplicativo foi parar. Este botão pequeno explica onde achar, como fixar na barra de tarefas,
// criar o atalho na área de trabalho e como ver as opções de novo. Não aparece dentro do aplicativo instalado nem quando o botão de instalar já está na tela.
(function () {
  var CH = 'murade_ajuda_instalar_fechada';
  function standalone() { try { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; } catch (e) { return false; } }
  function fechadaHa30Dias() { try { var t = Number(localStorage.getItem(CH) || 0); return t && Date.now() - t < 30 * 24 * 3600 * 1000; } catch (e) { return false; } }
  function passos() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return ['No iPhone/iPad, abra este endereço no Safari.', 'Toque no botão Compartilhar (quadrado com seta para cima).', 'Escolha "Adicionar à Tela de Início". O ícone fica na tela do aparelho.'];
    if (/Android/i.test(ua)) return ['Toque nos três pontinhos do navegador.', 'Escolha "Instalar aplicativo" (ou "Adicionar à tela inicial").', 'O ícone fica na tela inicial do celular ou tablet.'];
    return [
      'Se você já instalou, o aplicativo está neste computador: clique no menu Iniciar do Windows, digite o nome do sistema e abra.',
      'Para fixar na barra de tarefas: com o aplicativo aberto, clique com o botão direito no ícone dele na barra de tarefas e escolha "Fixar na barra de tarefas".',
      'Para o atalho na área de trabalho: no menu Iniciar, arraste o ícone do aplicativo para a área de trabalho (normalmente funciona assim).',
      'Para ver de novo as opções de instalação (barra de tarefas e atalho): no Edge, abra o endereço edge://apps, clique no aplicativo e desinstale; volte aqui, clique em "Instalar aplicativo no computador" e marque as opções.'
    ];
  }
  function abrir() {
    if (document.getElementById('murade-ajuda-instalar-painel')) return;
    var fundo = document.createElement('div'); fundo.id = 'murade-ajuda-instalar-painel'; fundo.setAttribute('role', 'dialog'); fundo.setAttribute('aria-modal', 'true');
    fundo.style.cssText = 'position:fixed;inset:0;z-index:2147483100;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px';
    var caixa = document.createElement('div');
    caixa.style.cssText = 'background:#fff;color:#0f172a;max-width:520px;width:100%;max-height:90vh;overflow:auto;border-radius:16px;padding:20px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.4)';
    var h = document.createElement('h2'); h.textContent = 'Como achar e fixar o aplicativo'; h.style.cssText = 'margin:0 0 10px;font-size:18px';
    var ol = document.createElement('ol'); ol.style.cssText = 'margin:0;padding-left:20px';
    passos().forEach(function (t) { var li = document.createElement('li'); li.textContent = t; li.style.marginBottom = '8px'; ol.appendChild(li); });
    var linha = document.createElement('div'); linha.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap';
    var naoMostrar = document.createElement('button'); naoMostrar.type = 'button'; naoMostrar.textContent = 'Não mostrar de novo';
    naoMostrar.style.cssText = 'border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:10px 14px;font:600 13px system-ui,sans-serif;cursor:pointer';
    var ok = document.createElement('button'); ok.type = 'button'; ok.textContent = 'Entendi';
    ok.style.cssText = 'border:0;background:#0f2444;color:#fff;border-radius:10px;padding:10px 16px;font:700 13px system-ui,sans-serif;cursor:pointer';
    function fechar() { fundo.remove(); }
    ok.onclick = fechar;
    naoMostrar.onclick = function () { try { localStorage.setItem(CH, String(Date.now())); } catch (e) {} fechar(); var b = document.getElementById('murade-ajuda-instalar'); if (b) b.remove(); };
    fundo.addEventListener('click', function (e) { if (e.target === fundo) fechar(); });
    linha.appendChild(naoMostrar); linha.appendChild(ok); caixa.appendChild(h); caixa.appendChild(ol); caixa.appendChild(linha); fundo.appendChild(caixa); document.body.appendChild(fundo);
    try { ok.focus(); } catch (e) {}
  }
  function botao() {
    if (standalone() || fechadaHa30Dias() || document.getElementById('murade-instalar') || document.getElementById('murade-ajuda-instalar') || !document.body) return;
    var b = document.createElement('button'); b.id = 'murade-ajuda-instalar'; b.type = 'button'; b.textContent = 'Aplicativo: como achar e fixar';
    b.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147482500;background:#0f2444;color:#fff;border:1px solid #F2D26E;border-radius:10px;padding:8px 12px;font:600 12px system-ui,sans-serif;cursor:pointer;opacity:.92';
    b.onclick = abrir; document.body.appendChild(b);
  }
  // espera o navegador decidir se oferece a instalação; se não ofereceu, mostra a ajuda
  window.addEventListener('load', function () { setTimeout(botao, 8000); });
  window.addEventListener('appinstalled', function () { var b = document.getElementById('murade-ajuda-instalar'); if (b) b.remove(); });
})();

// Atualização automática: se o Render publicou versão nova, recarrega sozinho (ao abrir e ao voltar para a janela).
(function () {
  function atual() { return Array.prototype.map.call(document.scripts, function (s) { return s.src; }).filter(function (s) { return /\/assets\//.test(s); }).join('|'); }
  function checar() {
    try {
      fetch('/?_=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (t) {
        var ach = []; var re = /src="([^"]*\/assets\/[^"]+\.js)"/g; var m;
        while ((m = re.exec(t))) ach.push(new URL(m[1], location.href).href);
        var novo = ach.join('|');
        if (!novo) return;
        var chave = 'murade_recarga_' + location.host;
        if (novo !== atual()) {
          if (sessionStorage.getItem(chave) !== novo) { sessionStorage.setItem(chave, novo); location.reload(); }
        } else sessionStorage.removeItem(chave);
      }).catch(function () {});
    } catch (e) {}
  }
  setTimeout(checar, 2500);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checar(); });
  setInterval(checar, 5 * 60 * 1000); // aplicativo deixado aberto: confere versão nova a cada 5 minutos
  window.addEventListener('online', checar);
  try { if ('serviceWorker' in navigator) setInterval(function () { navigator.serviceWorker.getRegistration().then(function (g) { if (g) g.update(); }); }, 30 * 60 * 1000); } catch (e) {}
})();

// Aviso de conexão: sem internet o sistema continua aberto; ao voltar, avisa para os sistemas enviarem o que ficou pendente.
(function () {
  var faixa = null;
  function mostrar(texto, cor) {
    if (!document.body) return;
    if (!faixa) {
      faixa = document.createElement('div'); faixa.id = 'murade-conexao'; faixa.setAttribute('role', 'status');
      faixa.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147482000;padding:8px 12px;font:600 13px system-ui,sans-serif;color:#fff;text-align:center';
      document.body.appendChild(faixa);
    }
    faixa.style.background = cor; faixa.textContent = texto;
  }
  function esconder() { if (faixa) { faixa.remove(); faixa = null; } }
  function off() { mostrar('Sem internet. Você pode continuar; o que for salvo fica neste computador e é enviado sozinho quando a conexão voltar.', '#92400e'); }
  window.addEventListener('offline', off);
  window.addEventListener('online', function () {
    mostrar('Conexão de volta. Enviando o que foi feito sem internet…', '#1e3a8a');
    try { window.dispatchEvent(new Event('murade-voltou-online')); } catch (e) {}
    setTimeout(esconder, 5000);
  });
  if (navigator.onLine === false) { if (document.body) off(); else document.addEventListener('DOMContentLoaded', off); }
})();

// Autocura: se a tela ficar em branco (versão antiga guardada que não existe mais no servidor), limpa só a cópia guardada do app e recarrega.
(function () {
  function vazio() { var r = document.getElementById('root'); return r ? r.children.length === 0 && !(document.body.innerText || '').trim() : false; }
  window.addEventListener('load', function () {
    setTimeout(function () {
      try {
        if (!vazio()) return;
        var ult = Number(sessionStorage.getItem('murade_autocura') || 0);
        if (Date.now() - ult < 10 * 60 * 1000) return; // no máximo uma vez a cada 10 minutos
        sessionStorage.setItem('murade_autocura', String(Date.now()));
        location.replace('/reparar.html');
      } catch (e) {}
    }, 15000);
  });
})();
