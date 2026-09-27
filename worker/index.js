import { handleApi } from './api.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, { ...env, RUNTIME: 'cloudflare' });
    }
    return env.ASSETS.fetch(request);
  },
};
