// Service worker do Murade: o sistema abre sem internet (guarda só a casca do aplicativo) e se atualiza sozinho.
// Nunca guarda respostas /api com dados de clientes. Única exceção: a identificação da sessão (quem está logado),
// para o sistema não pedir login de novo só porque a internet caiu; ela é apagada ao sair.
const VERSAO = 'murade-casca-v2';
const SESSAO = ['/api/auth/session', '/api/auth/me'];
const PUBLICAS = ['/api/auth/status']; // situação do serviço de login (sem dados de usuário)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  const nomes = await caches.keys();
  await Promise.all(nomes.filter((n) => n.startsWith('murade-casca-') && n !== VERSAO).map((n) => caches.delete(n)));
  await self.clients.claim();
})()));

function comTempo(req, ms) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  return fetch(req, { signal: c.signal }).finally(() => clearTimeout(t));
}

async function sessao(req) {
  const cache = await caches.open(VERSAO); const chave = new URL(req.url).pathname;
  try {
    const resp = await comTempo(req, 8000);
    let logado = false;
    try { const j = await resp.clone().json(); logado = resp.ok && j && j.autenticado === true; } catch { /* sem corpo */ }
    if (logado) await cache.put(chave, resp.clone());
    else if (resp.status === 401 || resp.ok) await cache.delete(chave); // deslogado de verdade: não manter
    return resp;
  } catch {
    const guardada = await cache.match(chave); // sem internet (ou servidor dormindo): última sessão conhecida
    if (guardada) return guardada;
    throw new Error('sem rede');
  }
}

async function publica(req) {
  const cache = await caches.open(VERSAO); const chave = new URL(req.url).pathname;
  try {
    const resp = await comTempo(req, 8000);
    if (resp.ok) await cache.put(chave, resp.clone());
    return resp;
  } catch {
    const guardada = await cache.match(chave);
    if (guardada) return guardada;
    throw new Error('sem rede');
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.method === 'POST' && /^\/api\/auth\/logout$/.test(url.pathname)) {
    e.waitUntil(caches.open(VERSAO).then((c) => Promise.all(SESSAO.map((p) => c.delete(p)))));
    return;
  }
  if (req.method !== 'GET') return;
  if (SESSAO.includes(url.pathname)) { e.respondWith(sessao(req)); return; }
  if (PUBLICAS.includes(url.pathname)) { e.respondWith(publica(req)); return; }
  if (url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    // Página principal: rede primeiro (versão nova). Sem internet, ou servidor demorando a acordar, abre a última guardada.
    e.respondWith((async () => {
      const cache = await caches.open(VERSAO); const guardada = await cache.match('/');
      try {
        const resp = guardada ? await comTempo(req, 4000) : await fetch(req);
        if (resp.ok && resp.headers.get('content-type')?.includes('text/html')) await cache.put('/', resp.clone());
        return resp;
      } catch { return guardada || Response.error(); }
    })());
    return;
  }
  if (url.pathname !== '/sw.js' && !url.pathname.startsWith('/assets/') && /\.(js|png|svg|ico|webmanifest|css|woff2?)$/.test(url.pathname)) {
    // Arquivos fixos (ícones, manifesto, script do aplicativo): rede primeiro; sem internet, a última cópia.
    e.respondWith(publica(req));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    // Arquivos com nome único por versão: seguro guardar e reutilizar.
    e.respondWith((async () => {
      const guardado = await caches.match(req);
      if (guardado) return guardado;
      const resp = await fetch(req);
      if (resp.ok) (await caches.open(VERSAO)).put(req, resp.clone());
      return resp;
    })());
  }
});
