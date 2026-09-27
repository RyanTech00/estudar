// Security headers for every response (Worker and the local server).
// The app has no inline scripts and no eval, so scripts come only from this origin; the Supabase
// client is bundled in public/vendor. The only inline styles are style="…" attributes (CSS variables).
export function securityHeaders({ supabaseUrl = '', https = true } = {}) {
  let supabase = '';
  try {
    const u = new URL(supabaseUrl);
    supabase = ` ${u.origin} wss://${u.host}`;
  } catch { /* not configured yet */ }
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    `connect-src 'self'${supabase}`,
    "font-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), fullscreen=(self), screen-wake-lock=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...(https ? { 'Strict-Transport-Security': 'max-age=63072000' } : {}),
  };
}

export function withSecurityHeaders(response, options) {
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries(securityHeaders(options))) r.headers.set(k, v);
  return r;
}
