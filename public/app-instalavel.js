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
})();
