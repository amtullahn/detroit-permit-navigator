<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Server-side AI, email, and open-data calls run only in TanStack server routes/functions (not Supabase Edge Functions); secrets are read via process.env inside handlers. Why: keeps keys out of the browser bundle.
- All model calls go through one server-only llm module so the provider can be swapped in one file. Why: user requirement.
- Each open-data dataset sits behind its own adapter function (src/lib/mock-tools.ts in Stage 1). Why: field mappings change independently.
- The rules table is hand-curated by admins; the model never writes to it. Why: no invented requirements.
