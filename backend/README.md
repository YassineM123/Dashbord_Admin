# Backend API

Backend modulaire Node.js pour le dashboard admin.

## Lancer

```bash
npm run dev
```

Serveur par defaut: `http://localhost:4000`

## Variables d'environnement

Copier `backend/.env.example` vers `backend/.env` puis ajuster:

- `PORT`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `FRONTEND_ORIGIN`
- `PASSWORD_SALT`
- `AI_PROVIDER` (`auto|gemini|openai`)
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## Compte de demo

- Email: `admin@client.com`
- Mot de passe: `Admin@12345`

## API principale

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET|POST|PATCH|DELETE /api/orders`
- `GET|POST|PATCH|DELETE /api/products`
- `GET|POST|PATCH|DELETE /api/customers`
- `GET|POST|PATCH|DELETE /api/ai-orders`
- `GET|POST|PATCH|DELETE /api/leads`
- `POST /api/leads/bulk`
- `POST /api/leads/scrape-jobs`
- `GET /api/leads/scrape-jobs/:id`
- `GET|POST|PATCH|DELETE /api/deliveries`
- `GET /api/deliveries/report/daily`
- `GET|POST|PATCH|DELETE /api/invoices`
- `POST /api/invoices/generate`
- `POST /api/invoices/:id/send`
- `GET /api/invoices/:id/pdf`
- `GET /api/delivery-notes`
- `GET|PATCH|DELETE /api/delivery-notes/:id`
- `POST /api/delivery-notes/generate`
- `GET /api/delivery-notes/:id/pdf`
- `GET|POST|PATCH|DELETE /api/expenses`
- `GET /api/accounting/summary`
- `GET /api/accounting/dashboard`
- `GET /api/accounting/export.csv`
- `GET|POST|PATCH|DELETE /api/marketing/campaigns`
- `GET /api/marketing/templates`
- `POST /api/marketing/generate-copy`
- `GET|POST|PATCH|DELETE /api/ads/campaigns`
- `POST /api/ads/generate-copy`
- `GET /api/analytics/overview`
- `GET /api/integrations/settings`
- `GET /api/integrations/health`
- `POST /api/integrations/:id/connect`
- `POST /api/integrations/:id/disconnect`
- `POST /api/integrations/:id/test`
- `GET|POST|PATCH|DELETE /api/sales-channels`
- `POST /api/sales-channels/:id/sync-products`
- `POST /api/sales-channels/:id/sync-orders`
- `GET /api/sync-jobs`
- `GET /api/sync-jobs/:id`
- `GET /api/agents/channels`
- `GET /api/agents/conversations`
- `GET /api/agents/conversations/:id/messages`
- `POST /api/agents/conversations/:id/messages`
- `GET|PATCH /api/agents/settings`
- `GET|POST /api/agents/rules`
- `PATCH|DELETE /api/agents/rules/:id`
- `POST /api/agents/suggestions`
- `POST /api/agents/social-reply`
- `POST /api/agents/dashboard-assistant`
- `POST /api/copilot/analyze`
- `POST /api/copilot/advanced/analyze`
- `GET|PATCH /api/settings`
- `GET|POST /api/admin-users`
- `PATCH|DELETE /api/admin-users/:id`
- `GET /api/search?q=...`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `POST /api/notifications/mark-all-read`
- `GET /api/health`
