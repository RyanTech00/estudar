# API

The same API runs on the Cloudflare Worker and under `npm start` (`worker/api.js`). The `/api/setup/*` routes exist **only** under `npm start`.

Messages returned by the server (errors, health status) follow the `X-Estudar-Lang` header the app sends (`pt` or `en`); without it, they are in Portuguese. See [Languages](/en/architecture/#languages).

## Public

### `GET /api/config`

Public configuration the app needs to start.

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

`setup: true` only under `npm start` — it is what makes the forms on the Server & keys screen appear.

### `GET /api/health`

Status of each service. `ok` is `true`, `false` or `null` (not configured). Example with `X-Estudar-Lang: en`:

```json
{
  "app":      { "ok": true, "runtime": "cloudflare", "message": "Running on Cloudflare" },
  "supabase": { "ok": true, "message": "Online" },
  "database": { "ok": false, "message": "Tables not created yet" },
  "ai":       { "ok": true, "provider": "Gemini", "message": "Gemini · gemini-2.5-flash" },
  "limit":    { "ok": null, "message": "No Supabase secret key: unlimited generations" },
  "checkedAt": "2026-09-27T16:12:51.430Z"
}
```

The AI check queries the model's metadata (Gemini `models/{model}`, Anthropic `models.retrieve`, OpenAI `GET /models`) — it spends no tokens.

## With a session

These require `Authorization: Bearer <Supabase session token>`. The server confirms the token with `GET <supabase>/auth/v1/user` and, if there is a secret key, applies the daily limit (`MAX_PLANS_PER_DAY`, counted in `ai_usage`).

| Status | When |
|---|---|
| `400` | Invalid request (dates, subjects, image) |
| `401` | No session or invalid session |
| `429` | Daily limit reached |
| `502` | The AI failed or refused |

### `POST /api/generate-plan`

The plan's text is written in the request's `lang`, or else in the language from `X-Estudar-Lang`.

```jsonc
// request
{
  "startDate": "2026-09-25",
  "examDate": "2027-01-04",
  "hoursPerDay": [3, 3.5, 3.5, 3.5, 4, 3.5, 3],     // Sunday … Saturday
  "subjects": [{
    "id": "ed", "name": "Estruturas de Dados", "short": "ED",
    "load": "alta", "area": "uni", "ects": 7, "examDate": "2027-01-20",
    "share": 24,             // suggested share (%)
    "mastery": 0.45,         // measured mastery, or null
    "prereqWeak": "Programação I (nota baixa, nota 11)"
  }],
  "notes": "O exame de FP é escrito.",
  "lang": "pt"               // optional: "pt" or "en"
}

// response
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
// request — JPEG, PNG or WebP up to 5 MB
{ "image": "data:image/jpeg;base64,/9j/4AAQ…" }

// response — already cleaned: grades 0–20 or null, dates YYYY-MM-DD or ""
{
  "result": {
    "degree": "Licenciatura em …",
    "units": [{ "year": 1, "semester": 1, "name": "Álgebra Linear", "ects": 6,
                "grade": 12, "date": "2024-12-17", "gradeType": "CC", "group": "" }]
  },
  "remaining": 8
}
```

## Configuration (`npm start` only)

These only accept requests whose `Host` and `Origin` are `localhost`/`127.0.0.1` and that carry the `X-Estudar-Setup: 1` header. The server listens only on `127.0.0.1`.

| Route | Does |
|---|---|
| `GET /api/setup/state` | Current values (secrets masked), last deploy, local URL |
| `POST /api/setup/save` | Writes to `.dev.vars`. An empty or masked secret = keep the current one |
| `POST /api/setup/test` | Runs `/api/health` with the submitted values, without saving |
| `GET /api/setup/cloudflare` | `wrangler whoami` (cached for 60 s; `?fresh=1` to force) |
| `POST /api/setup/cloudflare/login` | Starts `wrangler login` (opens the browser) |
| `POST /api/setup/deploy` | `wrangler deploy` + `wrangler secret bulk`; one at a time |
| `GET /api/setup/job` | Log and result of the publish in progress |
| `GET /api/setup/remote-health` | `/api/health` of the published address |
| `GET /api/setup/sql` | The migration SQL and the project reference |
| `POST /api/setup/supabase/provision` | With an `sbp_…` token: creates the tables, sets the login URLs and emails, and fills in any missing keys. The token is kept in memory only |
