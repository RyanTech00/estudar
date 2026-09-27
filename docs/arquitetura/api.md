# API

A mesma API corre no Cloudflare Worker e no `npm start` (`worker/api.js`). As rotas `/api/setup/*` existem **só** no `npm start`.

## Públicas

### `GET /api/config`

Configuração pública para a app arrancar.

```json
{
  "configured": true,
  "supabaseUrl": "https://abcdefgh.supabase.co",
  "supabaseAnonKey": "sb_publishable_…",
  "auth": { "email": true, "google": false },
  "ai": true,
  "runtime": "cloudflare",
  "setup": false
}
```

`setup: true` só no `npm start` — é o que faz aparecer os formulários do ecrã Servidor e chaves.

### `GET /api/health`

Estado de cada serviço. `ok` é `true`, `false` ou `null` (não configurado).

```json
{
  "app":      { "ok": true, "runtime": "cloudflare", "message": "A correr no Cloudflare" },
  "supabase": { "ok": true, "message": "Online" },
  "database": { "ok": false, "message": "Tabelas ainda não criadas" },
  "ai":       { "ok": true, "provider": "Gemini", "message": "Gemini · gemini-2.5-flash" },
  "limit":    { "ok": null, "message": "Sem chave secreta do Supabase: gerações ilimitadas" },
  "checkedAt": "2026-09-27T16:12:51.430Z"
}
```

A verificação da IA consulta os metadados do modelo (Gemini `models/{model}`, Anthropic `models.retrieve`, OpenAI `GET /models`) — não gasta tokens.

## Com sessão

Exigem `Authorization: Bearer <token de sessão do Supabase>`. O servidor confirma o token em `GET <supabase>/auth/v1/user` e, se houver chave secreta, aplica o limite diário (`MAX_PLANS_PER_DAY`, contado em `ai_usage`).

| Estado | Quando |
|---|---|
| `400` | Pedido inválido (datas, disciplinas, imagem) |
| `401` | Sem sessão ou sessão inválida |
| `429` | Limite diário atingido |
| `502` | A IA falhou ou recusou |

### `POST /api/generate-plan`

```jsonc
// pedido
{
  "startDate": "2026-09-25",
  "examDate": "2027-01-04",
  "hoursPerDay": [3, 3.5, 3.5, 3.5, 4, 3.5, 3],     // domingo … sábado
  "subjects": [{
    "id": "ed", "name": "Estruturas de Dados", "short": "ED",
    "load": "alta", "area": "uni", "ects": 7, "examDate": "2027-01-20",
    "share": 24,             // fatia sugerida (%)
    "mastery": 0.45,         // domínio medido, ou null
    "prereqWeak": "Programação I (nota baixa, nota 11)"
  }],
  "notes": "O exame de FP é escrito."
}

// resposta
{
  "plan": {
    "weeklyPlan": [{ "day": 2, "subject": "ed", "session": "3 blocos 40+10", "minutes": 150, "focus": "…" }],
    "phases": [{ "name": "Aprender", "label": "60 / 40", "start": "…", "end": "…", "ratio": "…" }],
    "tips": [{ "title": "…", "text": "…" }]
  },
  "remaining": 9
}
```

### `POST /api/import-curriculum`

```jsonc
// pedido — JPEG, PNG ou WebP até 5 MB
{ "image": "data:image/jpeg;base64,/9j/4AAQ…" }

// resposta — já limpa: notas 0–20 ou null, datas AAAA-MM-DD ou ""
{
  "result": {
    "degree": "Licenciatura em …",
    "units": [{ "year": 1, "semester": 1, "name": "Álgebra Linear", "ects": 6,
                "grade": 12, "date": "2024-12-17", "gradeType": "CC", "group": "" }]
  },
  "remaining": 8
}
```

## Configuração (só `npm start`)

Só aceitam pedidos com `Host` e `Origin` de `localhost`/`127.0.0.1` e o cabeçalho `X-Estudar-Setup: 1`. O servidor escuta só em `127.0.0.1`.

| Rota | Faz |
|---|---|
| `GET /api/setup/state` | Valores atuais (segredos mascarados), último deploy, URL local |
| `POST /api/setup/save` | Grava em `.dev.vars`. Segredo vazio ou mascarado = manter o atual |
| `POST /api/setup/test` | Corre `/api/health` com os valores enviados, sem gravar |
| `GET /api/setup/cloudflare` | `wrangler whoami` (cache de 60 s; `?fresh=1` para forçar) |
| `POST /api/setup/cloudflare/login` | Inicia `wrangler login` (abre o browser) |
| `POST /api/setup/deploy` | `wrangler deploy` + `wrangler secret bulk`; um de cada vez |
| `GET /api/setup/job` | Log e resultado da publicação em curso |
| `GET /api/setup/remote-health` | `/api/health` do endereço publicado |
| `GET /api/setup/sql` | O SQL da migração e a referência do projeto |
| `POST /api/setup/supabase/provision` | Com um token `sbp_…`: cria as tabelas, configura URLs e emails de login e preenche as chaves em falta. O token fica só em memória |
