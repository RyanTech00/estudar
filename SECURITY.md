# Security policy

**English** · [Português](#português)

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Use GitHub's private reporting instead: **Security → Report a vulnerability** on this repository. You'll get a reply within a few days, and a fix is released as a new version (`npx estudar@latest`) with credit to you in the changelog, if you want it.

Include what you can: the affected file or route, how to reproduce it, and what an attacker gains.

## Supported versions

Only the latest version on npm (`estudar@latest`) gets security fixes. Installs update by running `npx estudar@latest` and clicking **Set up** and **Publish** again.

## How Estudar is protected

The details are in the documentation ([Privacy and security](https://estudar.ryanbarbosa.com/en/guide/security)). In short:

- **Data:** Supabase row-level security on every table; each account reads and writes only its own document; viewers can only read the owner's, and the table that grants that can't be written by any client.
- **Keys:** the AI key and the Supabase secret key live only as Cloudflare Worker secrets (and in `~/.estudar` on your computer); they never reach a browser.
- **Setup:** keys, publishing and access are only on the local server (`npx estudar`), which listens on 127.0.0.1, checks the `Host` and `Origin` headers and requires a per-launch token. On the published app those routes don't exist.
- **Browser:** strict Content-Security-Policy (no inline scripts, no third-party code: the Supabase client is bundled), `frame-ancestors 'none'`, `nosniff`, `no-referrer`, HSTS. All data is cleaned on arrival and escaped on render.
- **AI:** only the owner can use it; a daily limit taken atomically in the database; the model's output is validated before anyone sees it.
- **Supply chain:** pinned dependencies and GitHub Actions, Dependabot, and npm releases staged by CI (Trusted Publishing, no tokens) that go live only after a maintainer approves them with 2FA.

---

## Português

**Não abras uma issue pública** para problemas de segurança. Usa o relatório privado do GitHub: **Security → Report a vulnerability** neste repositório. Respondemos em poucos dias e a correção sai numa versão nova (`npx estudar@latest`), com crédito no changelog, se quiseres.

Só a versão mais recente no npm recebe correções de segurança. Para atualizar: `npx estudar@latest`, depois **Configurar** e **Publicar** de novo.

Como o Estudar está protegido: ver [Privacidade e segurança](https://estudar.ryanbarbosa.com/guia/seguranca).
