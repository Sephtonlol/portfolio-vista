# Deployment (Frontend + Backend)

This repo contains the Angular frontend. The backend lives next to it at `../portfolio-vista-backend` on your server.

## Prereqs (server)

- Node.js 20+
- npm
- `pm2` installed globally (`npm i -g pm2`)
- MongoDB reachable by the backend connection string

## One-time setup

### Backend env

Create/edit the backend env file:

- `portfolio-vista-backend/.env`

Minimum variables:

- `CONNECTION_STRING=mongodb://localhost:27017`
- `DB_NAME=portfolio-prod`
- `APP_BASE_URL=https://alexanderwu.nl`
- `APP_PORT=3000`

### PM2 startup (optional)

If you want PM2 to auto-start on reboot:

- `pm2 startup` (follow the printed instructions)
- `pm2 save`

## Routine deploy (recommended)

From the frontend repo root (`portfolio-vista/`):

- Backend + frontend:

  - `./scripts/deploy-all.sh`

- First time on a fresh server (installs deps too):

  - `./scripts/deploy-all.sh --install`

## Deploy only one side

### Frontend only

- `./scripts/deploy-frontend.sh`
- Fresh server: `./scripts/deploy-frontend.sh --install`

Output is written to `portfolio-vista/docs/`.

Notes:
- The script preserves `docs/CNAME` and also restores `docs/assets/quiz-app`, `docs/assets/stimuliz`, and `docs/media` if they exist.

### Backend only

From `portfolio-vista-backend/`:

- `./scripts/deploy-backend.sh`
- Fresh server: `./scripts/deploy-backend.sh --install`

The backend is built via `npm run build` and then the PM2 process is restarted:

- process name: `alexanderwu-backend`

## Troubleshooting

- Check backend logs:
  - `pm2 logs alexanderwu-backend --lines 200`
- Check backend status:
  - `pm2 status alexanderwu-backend`
- If you’re debugging “old errors”, flush logs then retry:
  - `pm2 flush alexanderwu-backend`
