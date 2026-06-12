# Production Deployment

This project deploys as two services:

- Frontend: Vite React app on Vercel.
- Backend: Node.js HTTP API on Render.

The backend currently uses JSON repositories. `DATABASE_URL` and Supabase variables are prepared for the Supabase PostgreSQL target, but the repository layer still needs a Supabase/Postgres migration before Supabase becomes the production data store. Until that migration is complete, Render must use the persistent disk configured in `render.yaml`.

## Project Structure

```text
.
├── src/                     # Vite React frontend
├── backend/
│   ├── src/server.mjs        # Backend entrypoint
│   ├── src/app.mjs           # Routes, auth, CORS, services
│   ├── src/core/             # Env, router, responses, JSON store
│   └── src/data/             # Local JSON seed/dev data
├── vercel.json               # Vercel frontend config
├── render.yaml               # Render backend blueprint
├── package.json              # Frontend scripts and root dev scripts
└── backend/package.json      # Backend start script
```

## Environment Variables

### Frontend: Vercel

Set these in Vercel Project Settings -> Environment Variables:

```bash
VITE_API_BASE_URL=https://admin-dashboard-backend.onrender.com/api
```

Replace the hostname with the real Render backend URL after the backend is created.

### Backend: Render

Set these in Render service environment variables:

```bash
NODE_ENV=production
DATA_DIR=/var/data
FRONTEND_ORIGIN=https://your-vercel-app.vercel.app
CORS_ORIGINS=https://your-vercel-app.vercel.app,https://your-custom-domain.com
JWT_SECRET=<generated-strong-secret-32-plus-chars>
REFRESH_TOKEN_SECRET=<generated-strong-secret-32-plus-chars>
PASSWORD_SALT=<generated-strong-secret-32-plus-chars>
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=604800
TOKEN_ISSUER=admin-dashboard-backend
TOKEN_AUDIENCE=admin-dashboard-frontend
DATABASE_URL=<supabase-postgres-connection-string>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
AI_PROVIDER=auto
GEMINI_API_KEY=<optional>
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=<optional>
OPENAI_MODEL=gpt-4.1-mini
```

Keep `SUPABASE_SERVICE_ROLE_KEY`, JWT secrets, refresh secrets, and salts server-only. Never add them to Vercel frontend variables.

## Deploy Backend on Render

1. Push this project to GitHub.
2. In Render, create a new Blueprint and select this repository.
3. Render reads `render.yaml` and creates `admin-dashboard-backend`.
4. Fill `FRONTEND_ORIGIN`, `CORS_ORIGINS`, Supabase values, and optional AI keys.
5. Deploy the service.
6. Verify health:

```bash
curl https://admin-dashboard-backend.onrender.com/api/health
```

Expected response:

```json
{"data":{"ok":true,"service":"admin-dashboard-backend"}}
```

## Deploy Frontend on Vercel

1. Import the repository in Vercel.
2. Use framework preset `Vite`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Install command: `npm ci`.
6. Set `VITE_API_BASE_URL` to the Render backend API URL ending in `/api`.
7. Deploy.

## Deployment Commands

Local verification:

```bash
npm ci
npm run build
npm run smoke:api
```

Backend only:

```bash
cd backend
npm ci
npm start
```

Frontend only:

```bash
npm ci
npm run build
```

## Production Verification

After both deployments:

1. Open the Vercel URL.
2. Log in with the configured admin account.
3. Confirm the browser network tab calls `https://<render-service>.onrender.com/api/...`.
4. Check `GET /api/health` succeeds.
5. Create, edit, and delete a low-risk record such as a lead.
6. Refresh the page and confirm the record state persists.
7. Check Render logs for auth, CORS, or unhandled errors.

## Troubleshooting

- `CORS` error in browser: add the exact Vercel origin to `CORS_ORIGINS` and redeploy Render. Include custom domains separately.
- `401 Unauthorized`: log in again; verify `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, issuer, and audience are stable between deploys.
- `500 JWT_SECRET must be set`: production secrets must be at least 32 characters and not use placeholder values.
- Frontend calls `/api` on Vercel instead of Render: set `VITE_API_BASE_URL=https://<render-service>.onrender.com/api` and redeploy Vercel.
- Data disappears after Render redeploy: confirm the Render disk is attached and `DATA_DIR=/var/data`.
- Supabase data is not changing: expected until the backend repositories are migrated from JSON files to Supabase/PostgreSQL.
- Render build fails in `backend`: confirm `backend/package-lock.json` is committed and Render uses root directory `backend`.

## Final Production URLs

Use these after deployment:

```text
Frontend: https://<your-vercel-project>.vercel.app
Backend:  https://<your-render-service>.onrender.com
Health:   https://<your-render-service>.onrender.com/api/health
API Base: https://<your-render-service>.onrender.com/api
```
