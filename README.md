# GTCDN Server

GTCDN is a TanStack Start app that runs on Cloudflare Workers, stores auth data in D1, and stores uploaded files in R2.

## Local setup

1. Install dependencies:

```bash
bun install
```

2. Create the local D1 schema:

```bash
bunx wrangler d1 execute gtcdn-db --local --file=migrations/schema.sql
```

3. Start the local Worker:

```bash
bun run dev
```

The app runs at `http://localhost:3000`.

## Local login

- Username: `admin`
- Default password: `admin123`

The admin account is seeded automatically on the first auth request.

## Cloudflare setup

1. Create a D1 database:

```bash
bunx wrangler d1 create gtcdn-db
```

2. Create an R2 bucket:

```bash
bunx wrangler r2 bucket create gtcdn-files
```

3. Update `wrangler.jsonc` with the real `database_id` returned by the D1 create command.

4. Apply the schema to the remote D1 database:

```bash
bunx wrangler d1 execute gtcdn-db --remote --file=migrations/schema.sql
```

5. Set a Better Auth secret for the Worker:

```bash
bunx wrangler secret put BETTER_AUTH_SECRET
```

6. Deploy:

```bash
bun run deploy
```

After deploy, Cloudflare will print the `*.workers.dev` URL for your app.

## Notes

- Runtime entrypoint is configured in `wrangler.jsonc` via `@tanstack/react-start/server-entry`.
- Cloudflare bindings are read from `cloudflare:workers` only in server-only modules.
- Uploaded files use the `R2_DB` R2 binding and auth uses the `DB` D1 binding.
