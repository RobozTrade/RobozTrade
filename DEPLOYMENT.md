# RobozTrade Deployment Guide

## Overview

RobozTrade uses a **unified deployment architecture** where both the frontend (React + Vite) and backend (Hono API) are deployed together as a single Cloudflare Worker. This provides:

- ✅ **Single deployment** - One command deploys everything
- ✅ **No CORS issues** - Frontend and backend on same origin
- ✅ **Free static hosting** - You only pay for Worker CPU time (API requests)
- ✅ **Global CDN** - Static assets cached at Cloudflare edge locations worldwide
- ✅ **Simplified architecture** - No need to manage separate deployments

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Single Cloudflare Worker (roboz-trade)          │
├─────────────────────────────────────────────────────────┤
│  Request Router:                                         │
│  - /api/* → Hono Backend (JWT, D1, Durable Objects)    │
│  - /ws → WebSocket Durable Object                       │
│  - /* → Static Assets (React SPA with client routing)   │
└─────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Cloudflare Account**

   - Sign up at https://dash.cloudflare.com/sign-up
   - Note your Account ID (found in Workers & Pages dashboard)

2. **Wrangler CLI**

   ```bash
   bun add -g wrangler
   # or
   npm install -g wrangler
   ```

3. **Authenticate Wrangler**
   ```bash
   wrangler login
   ```

## Unified Deployment (Recommended)

This is the recommended approach that deploys both frontend and backend together as a single Worker.

### Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Build frontend and backend
bun run build

# 3. Deploy everything
bun run deploy
```

That's it! Your entire application (frontend + backend) is now deployed to Cloudflare Workers.

---

## Detailed Deployment Guide

### Method 1: Unified Deployment via Wrangler CLI (Recommended)

#### Step 1: Create D1 Database

1. Go to https://dash.cloudflare.com
2. Navigate to **Workers & Pages** → **D1 SQL Database**
3. Click **Create database**
4. Name it: `roboz-trade`
5. Click **Create**
6. Copy the **Database ID** that appears
7. Update `apps/backend/wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "roboz-trade"
   database_id = "YOUR_DATABASE_ID_FROM_ABOVE"  # Paste the ID here
   ```

#### Step 2: Run Database Migrations

```bash
# From project root
bun run db:migrate

# Or from apps/backend directory
cd apps/backend
bun run db:migrate
```

#### Step 3: Set Environment Variables (Secrets)

**IMPORTANT**: You must set these secrets before deploying:

```bash
cd apps/backend

# Generate strong random strings for secrets
openssl rand -base64 32  # Copy this for JWT_SECRET
openssl rand -base64 32  # Copy this for ENCRYPTION_KEY (must be different!)

# Set JWT secret (REQUIRED)
wrangler secret put JWT_SECRET
# When prompted, paste the first random string

# Set encryption key (REQUIRED)
wrangler secret put ENCRYPTION_KEY
# When prompted, paste the second random string
```

**Note**: Non-sensitive configuration is already in `wrangler.toml` [vars] section. See the [Environment Variables Configuration](#environment-variables-configuration) section below for details.

#### Step 4: Build Frontend

```bash
# From project root
bun run build:frontend

# This creates the dist folder that will be deployed with the Worker
```

#### Step 5: Deploy Unified Worker

```bash
# From project root - builds and deploys everything
bun run deploy

# Or step by step:
bun run build          # Build frontend and backend
bun run deploy:worker  # Deploy the Worker with static assets
```

You'll get a deployment URL like: `https://roboz-trade.YOUR_SUBDOMAIN.workers.dev`

**Important**: The frontend is now served from the same URL as the backend:

- Frontend: `https://roboz-trade.YOUR_SUBDOMAIN.workers.dev/`
- API: `https://roboz-trade.YOUR_SUBDOMAIN.workers.dev/api/*`
- WebSocket: `https://roboz-trade.YOUR_SUBDOMAIN.workers.dev/ws`

---

### Method 2: Deploy via Cloudflare Dashboard (Alternative)

This method uses the Cloudflare Dashboard for configuration. Note that you'll still need to use Wrangler CLI for the actual deployment since the unified deployment requires building the frontend first.

#### Step 1: Create Worker via Dashboard

1. Go to https://dash.cloudflare.com
2. Navigate to **Workers & Pages** → **Overview**
3. Click **Create** → **Create Worker**
4. Name it: `roboz-trade` (or your preferred name)
5. Click **Deploy**

#### Step 2: Configure Worker Settings

1. In Settings → **Variables and Secrets** → **D1 Database Bindings**

   - Click **Add binding**
   - Variable name: `DB`
   - D1 database: Select `roboz-trade` (create it first if needed)
   - Click **Save**

2. In **Durable Object Bindings**

   - Click **Add binding**
   - Variable name: `MARKET_WS`
   - Durable Object class name: `MarketDataWebSocket`
   - Script name: Select current worker
   - Click **Save**

3. In Settings → **Variables and Secrets** → **Environment Variables**

   - Add variable:
     - Name: `ASTER_API_BASE_URL`
     - Value: `https://fapi.asterdex.com`
     - Click **Add variable**
   - Add secret:
     - Name: `JWT_SECRET`
     - Value: Generate a secure random string (e.g., run `openssl rand -base64 32`)
     - Click **Encrypt**
     - Click **Add variable**

4. In Settings → **Compatibility**
   - Compatibility date: `2024-09-23`
   - Compatibility flags: Add `nodejs_compat`

#### Step 3: Deploy via CLI

Even with Dashboard configuration, you need to deploy via CLI for the unified deployment:

```bash
# Build frontend
bun run build:frontend

# Deploy Worker with static assets
cd apps/backend
wrangler deploy
```

---

### Method 3: Legacy Separate Deployments (Not Recommended)

#### Step 1: Update Configuration

Edit `apps/backend/wrangler.toml` and update:

```toml
account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"  # Replace with your account ID
name = "roboz-trade"                        # Your worker name
```

Find your Account ID at: https://dash.cloudflare.com → Workers & Pages → Overview

#### Step 2: Create D1 Database

```bash
# Create production database
wrangler d1 create roboz-trade

# Copy the database_id from output and update wrangler.toml
# Update the database_id in the [[d1_databases]] section
```

Your `wrangler.toml` should look like:

```toml
[[d1_databases]]
binding = "DB"
database_name = "roboz-trade"
database_id = "YOUR_DATABASE_ID_FROM_ABOVE"  # Replace this
```

#### Step 3: Run Database Migrations

```bash
# From project root
bun run db:migrate

# Or from apps/backend directory
cd apps/backend
bun run db:migrate
```

#### Step 4: Set Environment Variables (Secrets)

```bash
cd apps/backend

# Set JWT secret (IMPORTANT: Use a strong random string)
wrangler secret put JWT_SECRET
# When prompted, enter a secure random string (e.g., output of: openssl rand -base64 32)

# Note: ASTER_API_BASE_URL is already in wrangler.toml [vars] section
```

#### Step 5: Deploy Backend

```bash
# Option 1: From project root
bun run deploy:backend

# Option 2: From apps/backend
cd apps/backend
bun run deploy

# Option 3: Direct wrangler command
cd apps/backend
wrangler deploy
```

You'll get a deployment URL like: `https://roboz-trade.YOUR_SUBDOMAIN.workers.dev`

---

---

## Verification

### Test the Unified Deployment

After deploying, verify everything works:

**1. Test Frontend**

Open your Worker URL in a browser:

```
https://roboz-trade.YOUR_SUBDOMAIN.workers.dev/
```

You should see the RobozTrade homepage.

**2. Test API**

```bash
curl https://roboz-trade.YOUR_SUBDOMAIN.workers.dev/api/auth/health
```

**3. Test React Router**

Navigate to different routes in your browser:

- `https://roboz-trade.YOUR_SUBDOMAIN.workers.dev/login`
- `https://roboz-trade.YOUR_SUBDOMAIN.workers.dev/app/dashboard`

All routes should work without 404 errors (React Router handles client-side routing).

**4. Test WebSocket**

The WebSocket endpoint should be available at:

```
wss://roboz-trade.YOUR_SUBDOMAIN.workers.dev/ws
```

---

## Troubleshooting

### Issue: "Missing entry-point to Worker script"

**Solution**: Make sure you're in `apps/backend` directory when running `wrangler deploy`, or use the root-level command: `bun run deploy`

### Issue: "Database binding not found"

**Solution**: Ensure D1 database binding is configured in wrangler.toml or Dashboard settings

### Issue: "Durable Object class not found"\*\*

**Solution**: Ensure Durable Object binding is configured in wrangler.toml or Dashboard settings

### Issue: "Static assets not found" or "404 for frontend routes"

**Solution**:

1. Ensure frontend is built: `bun run build:frontend`
2. Check that `apps/frontend/dist` directory exists and contains files
3. Verify `wrangler.toml` has correct `assets.directory` path: `../frontend/dist`
4. Redeploy: `bun run deploy`

### Issue: "API calls fail with CORS errors"

**Solution**:

1. Check that `apps/backend/src/index.ts` includes your production domain in CORS origins
2. For unified deployment, CORS shouldn't be an issue since frontend and backend are same-origin

### Issue: Frontend shows old version after deployment

**Solution**:

1. Clear browser cache or do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. Check that you built the frontend before deploying: `bun run build:frontend`

---

## Legacy: Separate Frontend Deployment (Not Recommended)

<details>
<summary>Click to expand legacy Pages deployment instructions</summary>

**Note**: This approach is no longer recommended. Use the unified deployment method above instead.

### Frontend Deployment (Cloudflare Pages)

### Option 1: Deploy via Cloudflare Dashboard (Recommended)

1. **Push to GitHub**

   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Cloudflare Pages**
   - Go to https://dash.cloudflare.com
   - Navigate to **Workers & Pages** → **Create application** → **Pages**
   - Connect your GitHub repository
3. **Configure Build Settings**
   - **Framework preset**: None (or Vite)
   - **Build command**: `cd apps/frontend && bun install && bun run build`
   - **Build output directory**: `apps/frontend/dist`
   - **Root directory**: `/` (leave as root)
4. **Environment Variables**
   Add this environment variable:

   - `VITE_API_URL`: Your backend worker URL (e.g., `https://roboz-trade.YOUR_SUBDOMAIN.workers.dev/api`)

5. **Deploy**
   - Click **Save and Deploy**
   - Your frontend will be deployed to: `https://YOUR_PROJECT.pages.dev`

### Option 2: Deploy via Wrangler CLI

1. **Build Frontend**

   ```bash
   cd apps/frontend
   bun run build
   ```

2. **Create Pages Project**

   ```bash
   wrangler pages project create roboz-trade-frontend
   ```

3. **Deploy**

   ```bash
   wrangler pages deploy dist --project-name=roboz-trade-frontend
   ```

4. **Set Environment Variables**
   ```bash
   wrangler pages secret put VITE_API_URL --project-name=roboz-trade-frontend
   # Enter your backend URL when prompted
   ```

</details>

---

## Environment Variables Configuration

### Overview

RobozTrade uses environment variables for all configuration. This section explains how to configure them for both backend and frontend.

### Backend Environment Variables

#### Secrets (use `wrangler secret put`)

These are sensitive values that should NEVER be committed to version control:

| Variable         | Description                             | Required | How to Generate                                               |
| ---------------- | --------------------------------------- | -------- | ------------------------------------------------------------- |
| `JWT_SECRET`     | Secret key for signing JWT tokens       | ✅ Yes   | `openssl rand -base64 32`                                     |
| `ENCRYPTION_KEY` | Key for encrypting API keys in database | ✅ Yes   | `openssl rand -base64 32` (must be different from JWT_SECRET) |

**Setting secrets in production:**

```bash
cd apps/backend

# Generate secrets
openssl rand -base64 32  # Copy for JWT_SECRET
openssl rand -base64 32  # Copy for ENCRYPTION_KEY

# Set secrets
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY
```

**Setting secrets for local development:**

Create `apps/backend/.dev.vars` (this file is gitignored):

```bash
JWT_SECRET=your-local-jwt-secret
ENCRYPTION_KEY=your-local-encryption-key
```

#### Public Variables (in `wrangler.toml` [vars])

These are non-sensitive configuration values defined in `apps/backend/wrangler.toml`:

| Variable                    | Description                                  | Default                                                                       | Required  |
| --------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- | --------- |
| `ASTER_API_BASE_URL`        | Aster DEX API base URL                       | `https://fapi.asterdex.com`                                                   | No        |
| `CORS_ALLOWED_ORIGINS`      | Comma-separated list of allowed CORS origins | `http://localhost:5173,http://localhost:3000,https://roboz-trade.workers.dev` | No        |
| `BSC_RPC_URL`               | Binance Smart Chain RPC URL                  | `https://bsc-dataseed1.binance.org`                                           | No        |
| `USDT_CONTRACT_ADDRESS`     | USDT contract address on BSC                 | `0x55d398326f99059fF775485246999027B3197955`                                  | No        |
| `PAYMENT_RECIPIENT_ADDRESS` | Your wallet address for bot payments         | `0xB8b687E16BD6Ce3E37e6f9fd534542F75009c86B`                                  | ⚠️ Update |
| `REQUIRED_PAYMENT_AMOUNT`   | Required payment amount in USDT              | `10`                                                                          | No        |
| `MIN_CONFIRMATIONS`         | Minimum blockchain confirmations             | `3`                                                                           | No        |
| `PBKDF2_ITERATIONS`         | PBKDF2 iterations for encryption             | `100000`                                                                      | No        |

**Updating public variables:**

Edit `apps/backend/wrangler.toml`:

```toml
[vars]
ASTER_API_BASE_URL = "https://fapi.asterdex.com"
CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:3000,https://roboz-trade.workers.dev,https://yourdomain.com"
PAYMENT_RECIPIENT_ADDRESS = "0xYOUR_WALLET_ADDRESS"  # ⚠️ IMPORTANT: Update this!
# ... other variables
```

### Frontend Environment Variables

Frontend environment variables are **build-time** variables (not runtime). They are embedded into the JavaScript bundle during build.

#### Development (`.env.development`)

Automatically loaded when running `bun run dev`:

```env
VITE_API_URL=http://localhost:8787/api
VITE_WS_URL=ws://localhost:8787/ws
VITE_WALLETCONNECT_PROJECT_ID=your-project-id
VITE_PAYMENT_RECIPIENT_ADDRESS=0xYOUR_WALLET_ADDRESS
```

#### Production (`.env.production`)

Used when building for production (`bun run build:frontend`):

```env
# Empty for same-origin requests (unified deployment)
VITE_API_URL=
VITE_WS_URL=

# WalletConnect Project ID
VITE_WALLETCONNECT_PROJECT_ID=your-project-id

# App metadata
VITE_APP_URL=https://roboz-trade.workers.dev
VITE_APP_ICON=https://roboz-trade.workers.dev/icon.png

# Blockchain config
VITE_PAYMENT_RECIPIENT_ADDRESS=0xYOUR_WALLET_ADDRESS
```

#### All Frontend Variables

| Variable                         | Description                           | Default                                      | Required  |
| -------------------------------- | ------------------------------------- | -------------------------------------------- | --------- |
| `VITE_API_URL`                   | API base URL (empty for same-origin)  | `/api`                                       | No        |
| `VITE_WS_URL`                    | WebSocket URL (empty for same-origin) | `/ws`                                        | No        |
| `VITE_WALLETCONNECT_PROJECT_ID`  | WalletConnect project ID              | Provided                                     | ⚠️ Update |
| `VITE_APP_NAME`                  | Application name                      | `RobozTrade`                                 | No        |
| `VITE_APP_DESCRIPTION`           | Application description               | `AI-Powered Trading Bot Platform`            | No        |
| `VITE_APP_URL`                   | Application URL                       | `https://roboztrade.com`                     | No        |
| `VITE_APP_ICON`                  | Application icon URL                  | `https://roboztrade.com/icon.png`            | No        |
| `VITE_USDT_CONTRACT_ADDRESS`     | USDT contract on BSC                  | `0x55d398326f99059fF775485246999027B3197955` | No        |
| `VITE_PAYMENT_RECIPIENT_ADDRESS` | Payment recipient wallet              | `0xB8b687E16BD6Ce3E37e6f9fd534542F75009c86B` | ⚠️ Update |
| `VITE_REQUIRED_PAYMENT_AMOUNT`   | Required payment in USDT              | `10`                                         | No        |

### Environment-Specific Deployment

#### Staging Environment

Create `wrangler.staging.toml`:

```toml
name = "roboz-trade-staging"
# ... copy other config from wrangler.toml

[vars]
ASTER_API_BASE_URL = "https://staging-api.asterdex.com"
CORS_ALLOWED_ORIGINS = "https://roboz-trade-staging.workers.dev"
PAYMENT_RECIPIENT_ADDRESS = "0xYOUR_STAGING_WALLET"
```

Deploy:

```bash
wrangler deploy --config wrangler.staging.toml
```

#### Production Environment

Use the default `wrangler.toml` and set production secrets:

```bash
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY
```

### Important Notes

1. **Never commit secrets** to version control

   - `.env.development` and `.dev.vars` are gitignored
   - Use `wrangler secret put` for production secrets

2. **Frontend variables are build-time**

   - Changes require rebuilding: `bun run build:frontend`
   - Backend variables are runtime (no rebuild needed)

3. **Update wallet addresses**

   - `PAYMENT_RECIPIENT_ADDRESS` (backend)
   - `VITE_PAYMENT_RECIPIENT_ADDRESS` (frontend)
   - Both should point to YOUR wallet address

4. **Get your own WalletConnect Project ID**
   - Visit: https://cloud.reown.com/
   - Create a new project
   - Update `VITE_WALLETCONNECT_PROJECT_ID`

---

## Post-Deployment Configuration

### 1. Custom Domain (Optional)

You can add a custom domain to your Worker:

**Via Wrangler:**

```bash
cd apps/backend
wrangler publish --routes "roboztrade.com/*"
```

**Via Dashboard:**

1. Go to your Worker in the Cloudflare Dashboard
2. Navigate to **Triggers** → **Custom Domains**
3. Click **Add Custom Domain**
4. Enter your domain (e.g., `roboztrade.com`)
5. Follow the DNS configuration instructions

### 2. Environment-Specific Configuration

For different environments (staging, production), you can:

**Option 1: Use wrangler.toml environments**

```toml
[env.staging]
name = "roboz-trade-staging"
vars = { ASTER_API_BASE_URL = "https://staging-api.asterdex.com" }

[env.production]
name = "roboz-trade"
vars = { ASTER_API_BASE_URL = "https://fapi.asterdex.com" }
```

Deploy to specific environment:

```bash
wrangler deploy --env staging
wrangler deploy --env production
```

**Option 2: Use separate wrangler.toml files**

Create `wrangler.staging.toml` and `wrangler.production.toml`, then:

```bash
wrangler deploy --config wrangler.staging.toml
wrangler deploy --config wrangler.production.toml
```

### 3. Update CORS for Custom Domains

If you add a custom domain, update `apps/backend/src/index.ts`:

```typescript
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://roboz-trade.workers.dev",
      "https://roboztrade.com", // Add your custom domain
    ],
    credentials: true,
  })
);
```

## CI/CD Setup (Optional)

### GitHub Actions for Unified Deployment

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Build Frontend
        run: bun run build:frontend

      - name: Deploy Unified Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: apps/backend
          command: deploy
```

Add these secrets to your GitHub repository:

- `CLOUDFLARE_API_TOKEN`: Create at https://dash.cloudflare.com/profile/api-tokens
  - Required permissions: Workers Scripts (Edit), D1 (Edit), Durable Objects (Edit)

## Monitoring

### View Logs

```bash
# Real-time logs
cd apps/backend
wrangler tail

# Filter by status
wrangler tail --status error

# Filter by method
wrangler tail --method POST
```

### Analytics

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker: `roboz-trade`
3. View:
   - Request analytics
   - Error rates
   - CPU time usage
   - Bandwidth usage

### Performance Monitoring

Monitor your Worker's performance:

- **CPU Time**: Track how long requests take to process
- **Subrequest Count**: Monitor API calls to external services
- **Cache Hit Rate**: See how well static assets are cached

## Costs

With the unified deployment:

- **D1 Database**: Free tier includes 5GB storage, 5 million row reads/day
- **Workers**: Free tier includes 100,000 requests/day
- **Static Assets**: Served for free (you only pay for Worker CPU time on API requests)
- **Durable Objects**: Free tier includes 1 million requests/month

**Cost Optimization Tips:**

1. Static assets (HTML, CSS, JS, images) are cached and served for free
2. Only API requests (`/api/*`) and WebSocket connections consume Worker CPU time
3. Use Smart Placement for database queries to reduce latency and costs

## Development Workflow

### Local Development

```bash
# Terminal 1 - Frontend dev server (with HMR)
bun run dev:frontend

# Terminal 2 - Backend Worker
bun run dev:backend
```

The Vite proxy configuration ensures API requests are forwarded to the backend during development.

### Testing Before Deployment

```bash
# Build everything locally
bun run build

# Test the build
cd apps/backend
wrangler dev

# Open http://localhost:8787 to test the unified deployment locally
```

## Support

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/
- **Static Assets Docs**: https://developers.cloudflare.com/workers/static-assets/
- **Issues**: https://github.com/RobozTrade/RobozTrade/issues

## Summary

The unified deployment architecture provides:

✅ **Simplified deployment** - One command deploys everything
✅ **Better performance** - Static assets cached globally
✅ **Lower costs** - Free static hosting, pay only for API CPU time
✅ **No CORS issues** - Same-origin requests
✅ **Easier maintenance** - Single codebase, single deployment

**Quick Commands:**

```bash
# Development
bun run dev

# Build
bun run build

# Deploy
bun run deploy

# View logs
cd apps/backend && wrangler tail
```
