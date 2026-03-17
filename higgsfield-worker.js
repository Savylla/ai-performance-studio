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

const ALLOWED_ORIGIN = '*'; // Troque por seu dominio se quiser restringir: 'https://savylla.github.io'
const TARGET_BASE = 'https://platform.higgsfield.ai';

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Get the path from the request URL
    const url = new URL(request.url);
    const targetPath = url.pathname + url.search;
    const targetUrl = `${TARGET_BASE}${targetPath}`;

    // Forward the request to Higgsfield API
    const headers = new Headers();
    headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');
    if (request.headers.get('Authorization')) {
      headers.set('Authorization', request.headers.get('Authorization'));
    }

    const fetchOptions = {
      method: request.method,
      headers: headers,
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchOptions.body = await request.text();
    }

    try {
      const response = await fetch(targetUrl, fetchOptions);
      const responseBody = await response.text();

      return new Response(responseBody, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        },
      });
    }
  },
};
