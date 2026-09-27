import { handleApi } from './api.js';
import { withSecurityHeaders } from './security.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = url.pathname.startsWith('/api/')
      ? await handleApi(request, { ...env, RUNTIME: 'cloudflare' })
      : await env.ASSETS.fetch(request);
    return withSecurityHeaders(response, { supabaseUrl: env.SUPABASE_URL, https: url.protocol === 'https:' });
  },
};
