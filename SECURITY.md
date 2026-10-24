# Security

## Secrets

| Secret | Stored in | Read by | Status |
| --- | --- | --- | --- |
| GEMMA_API_KEY (Gemini API key) | Backend secret store (server-only env) | `src/lib/llm.server.ts` via `src/routes/api/agent.ts` (Stage 3) | Not added yet. Not used in Stage 1. |
| EMAIL_PROVIDER_KEY | Backend secret store (server-only env) | Email sender (Stage 4) | Not added yet. |
| SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY | Auto-managed | Browser client + `/api/agent` auth check | Public by design, protected by row-level security. |

Platform note: this project runs on TanStack Start with Lovable Cloud. Server logic lives in server routes / server functions (Cloudflare Workers) instead of Supabase Edge Functions; secrets are read with `process.env[...]` inside handlers only.

## Rules in force
- No secret appears in frontend code, the repo, or any `VITE_*` variable.
- `/api/agent` requires a valid sign-in token, rejects cross-origin requests, rate-limits per user and per IP, caps body size, and returns generic errors.
- Row-level security is on for every table. Anonymous visitors can only read reference tables (rules, contacts, glossary, firms, config, data_sources). Users read/write only their own projects, checklists, drafts, and submission log. Only admins can edit rules and contacts. `tool_call_log` and `daily_send_counts` are server-only.

## Known exposure
The uploaded `file.env` contained a Gemini API key, including a copy in a sample comment. It was not copied into this project. Rotate that key in Google AI Studio before adding the new one as GEMMA_API_KEY.
