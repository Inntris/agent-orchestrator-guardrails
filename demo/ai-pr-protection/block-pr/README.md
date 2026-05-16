# BLOCK Example

This scenario represents an AI-generated pull request targeting `main` that modifies production-sensitive paths:

- `src/middleware.ts`
- `supabase/migrations/0012_update_rls.sql`

Expected result:

```text
Inntris Verification: BLOCK
Reason: AI-generated PR touched protected production-sensitive files
```

Run it locally:

```bash
npm run demo:block
```
