// === Service Worker — AI Performance Studio ===
//
// Estratégia:
//   - PRECACHE: arquivos estáticos da aplicação cacheados no install
//   - HTML (navegação): network-first com fallback para cache
//     (sempre tenta versão fresca, mas funciona offline)
//   - JS/CSS/fontes/imagens locais: stale-while-revalidate
//     (responde instantâneo do cache + atualiza em background)
//   - APIs de geração (Gemini, Pollinations, etc): NÃO interceptadas
//     (sempre passam direto pela rede; cachear quebraria streaming/POST)

const CACHE_VERSION = 'aiox-v9-2026-05-21-actions-inline';
const CACHE_NAME = `aiox-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/components.css',
  '/css/responsive.css',
  '/js/app.js',
  '/assets/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] precache parcial:', err);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith('aiox-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Caminhos/origens que NUNCA devem ser cacheados (APIs dinâmicas, POSTs, streams)
const NEVER_CACHE_HOSTS = [
  'generativelanguage.googleapis.com',
  'text.pollinations.ai',
  'image.pollinations.ai',
  'api.groq.com',
  'openrouter.ai',
  'api.together.xyz',
  'router.huggingface.co',
  'stablehorde.net',
  'api.pexels.com',
  'pixabay.com',
  'api.unsplash.com',
  'api.openverse.org',
  'freesound.org',
  'www.thecolorapi.com',
  'accounts.google.com',
  'www.googleapis.com',
  'docs.googleapis.com',
  'docs.google.com',
  'higgsfield.ai',
  'platform.higgsfield.ai',
  'api.higgsfield.ai',
  'cloud.higgsfield.ai',
  'app.higgsfield.ai',
];

function shouldBypass(url) {
  if (NEVER_CACHE_HOSTS.some((h) => url.hostname.endsWith(h))) return true;
  // Ignora workers de proxy do usuário (workers.dev) — sempre rede
  if (url.hostname.endsWith('.workers.dev')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Só GET é cacheável
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  if (shouldBypass(url)) return; // deixa o browser tratar normal

  // HTML: network-first, fallback ao cache (offline)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Estáticos same-origin e CDNs whitelisted: stale-while-revalidate
  const sameOrigin = url.origin === self.location.origin;
  const cdnWhitelist = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdnjs.cloudflare.com',
  ].some((h) => url.hostname === h);

  if (sameOrigin || cdnWhitelist) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            // Só cacheia respostas 200 ok (opaque/error fica fora)
            if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});

// Mensagem do app pra forçar update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
