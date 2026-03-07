<div align="center">

# GTCDN Server

GTCDN is a TanStack Start app for managing Growtopia private server cache files on Cloudflare Workers, with Better Auth on D1 and file storage on R2.

</div>

## Features

- Cloudflare Workers runtime with TanStack Start
- Better Auth with D1-backed sessions and users
- R2-backed file storage with folders, drag-and-drop upload, and file moves
- Admin-only dashboard for managing cache assets

## Local Development

1. Install dependencies:

```bash
bun install
```

2. Start the app:

```bash
bun run dev
```

3. Open `http://localhost:3000`

Local auth tables and the default admin account are created automatically when auth is first used.

## Default Login

- Username: `admin`
- Password: `admin123`

After signing in with the default password, the dashboard forces you to change it before continuing.

## Cloudflare Deployment

1. Create the D1 database:

```bash
bunx wrangler d1 create gtcdn-db
```

2. Create the R2 bucket:

```bash
bunx wrangler r2 bucket create gtcdn-files
```

3. Update `wrangler.jsonc` with the real D1 `database_id`

4. Apply the schema to remote D1:

```bash
bunx wrangler d1 execute gtcdn-db --remote --file=migrations/schema.sql
```

5. Set Worker secrets:

```bash
bunx wrangler secret put BETTER_AUTH_SECRET
bunx wrangler secret put BETTER_AUTH_URL
```

6. Deploy:

```bash
bun run deploy
```

After deployment, Cloudflare prints your `*.workers.dev` URL.

## Notes

- Worker entry is configured in `wrangler.jsonc` with `@tanstack/react-start/server-entry`
- `cloudflare:workers` imports stay in server-only modules
- Auth uses the `D1_DB` D1 binding and storage uses the `R2_DB` R2 binding

## License

This project is licensed under the MIT License. See `LICENSE` for details.
