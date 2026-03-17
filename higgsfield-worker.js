// ============================================
// Cloudflare Worker - Proxy para Higgsfield API
// ============================================
// COMO USAR:
// 1. Acesse https://workers.cloudflare.com e crie uma conta gratis
// 2. Clique em "Create a Worker"
// 3. Cole TODO este codigo no editor
// 4. Clique em "Deploy"
// 5. Copie a URL do worker (ex: https://meu-worker.usuario.workers.dev)
// 6. Cole essa URL no campo "Higgsfield Proxy URL" no seu site
// ============================================

const ALLOWED_ORIGIN = '*';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Try multiple possible API base URLs
const API_BASES = [
  'https://platform.higgsfield.ai',
  'https://api.higgsfield.ai',
  'https://cloud.higgsfield.ai',
  'https://app.higgsfield.ai',
];

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const targetPath = url.pathname + url.search;

    // Debug endpoint: test all base URLs
    if (targetPath === '/_debug') {
      const authHeader = request.headers.get('Authorization') || '';
      const results = {};
      for (const base of API_BASES) {
        try {
          const r = await fetch(`${base}/`, {
            headers: { 'Authorization': authHeader },
            redirect: 'manual',
          });
          const body = await r.text();
          results[base] = {
            status: r.status,
            statusText: r.statusText,
            body: body.slice(0, 500),
            location: r.headers.get('location') || null,
          };
        } catch (e) {
          results[base] = { error: e.message };
        }
      }
      return new Response(JSON.stringify(results, null, 2), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Discovery endpoint: try a test generation on all bases
    if (targetPath === '/_discover') {
      const authHeader = request.headers.get('Authorization') || '';
      const body = await request.text();
      const testPaths = [
        '/v1/text2image/soul',
        '/soul/text-to-image',
        '/v1/generations',
        '/api/v1/text2image/soul',
        '/api/v1/generations',
        '/api/generate',
      ];
      const results = {};
      for (const base of API_BASES) {
        results[base] = {};
        for (const path of testPaths) {
          try {
            const r = await fetch(`${base}${path}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
              },
              body: body || JSON.stringify({ prompt: 'test', model: 'soul' }),
            });
            const respBody = await r.text();
            results[base][path] = {
              status: r.status,
              body: respBody.slice(0, 300),
            };
          } catch (e) {
            results[base][path] = { error: e.message };
          }
        }
      }
      return new Response(JSON.stringify(results, null, 2), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Normal proxy: try all base URLs, return first non-500 response
    const headers = new Headers();
    headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');
    const auth = request.headers.get('Authorization');
    if (auth) headers.set('Authorization', auth);

    const fetchOptions = { method: request.method, headers };
    let requestBody = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      requestBody = await request.text();
    }

    let lastResponse = null;
    let lastBody = '';

    for (const base of API_BASES) {
      try {
        const opts = { ...fetchOptions };
        if (requestBody) opts.body = requestBody;

        const response = await fetch(`${base}${targetPath}`, opts);
        const responseBody = await response.text();

        // Return first successful or non-500 response
        if (response.status < 500) {
          return new Response(responseBody, {
            status: response.status,
            headers: {
              'Content-Type': response.headers.get('Content-Type') || 'application/json',
              'X-Higgsfield-Base': base,
              ...CORS_HEADERS,
            },
          });
        }

        lastResponse = response;
        lastBody = responseBody;
      } catch (e) {
        lastBody = e.message;
      }
    }

    // All failed - return debug info
    return new Response(JSON.stringify({
      error: 'All API bases returned errors',
      lastStatus: lastResponse?.status,
      lastBody: lastBody.slice(0, 500),
      triedBases: API_BASES,
      path: targetPath,
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  },
};
