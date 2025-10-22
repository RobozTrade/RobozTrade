# RobozTrade Deployment Guide

## Overview

RobozTrade is a monorepo with two main parts:

- **Backend**: Cloudflare Workers (Hono framework)
- **Frontend**: Static site (React + Vite)

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

## Backend Deployment (Cloudflare Workers)

You can deploy the backend using either the Cloudflare Dashboard (easier for beginners) or Wrangler CLI (more control).

### Method 1: Deploy via Cloudflare Dashboard (Recommended for First-Time Deployment)

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

You need to use CLI for migrations:

```bash
cd apps/backend
bun install
bun run db:migrate
```

#### Step 3: Push Code to GitHub

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

#### Step 4: Create Worker via Dashboard

1. Go to https://dash.cloudflare.com
2. Navigate to **Workers & Pages** → **Overview**
3. Click **Create** → **Create Worker**
4. Name it: `roboz-trade` (or your preferred name)
5. Click **Deploy**
6. After deployment, click **Edit Code**
7. On the right sidebar, click **Settings**

#### Step 5: Configure Worker Settings

**Bindings:**
1. In Settings → **Variables and Secrets** → **D1 Database Bindings**
   - Click **Add binding**
   - Variable name: `DB`
   - D1 database: Select `roboz-trade`
   - Click **Save**

2. In **Durable Object Bindings**
   - Click **Add binding**
   - Variable name: `MARKET_WS`
   - Durable Object class name: `MarketDataWebSocket`
   - Script name: Select current worker
   - Click **Save**

**Environment Variables:**
1. In Settings → **Variables and Secrets** → **Environment Variables**
   - Add variable:
     - Name: `ASTER_API_BASE_URL`
     - Value: `https://fapi.asterdex.com`
     - Click **Add variable**
   - Add variable:
     - Name: `JWT_SECRET`
     - Value: Generate a secure random string (e.g., run `openssl rand -base64 32` in terminal)
     - Click **Encrypt** (to make it a secret)
     - Click **Add variable**

**Compatibility:**
1. In Settings → **Compatibility**
   - Compatibility date: `2024-09-23`
   - Compatibility flags: Add `nodejs_compat`

#### Step 6: Connect GitHub for Continuous Deployment

1. In Worker settings, go to **Triggers** tab
2. Click **Add** under **Git Integration**
3. Connect your GitHub account
4. Select repository: `RobozTrade/RobozTrade`
5. Production branch: `main`
6. Build configuration:
   - Root directory: `apps/backend`
   - Build command: Leave empty (Workers don't need build for TypeScript)
   - Entry point: `src/index.ts`
7. Click **Save**

Now any push to `main` branch will automatically deploy your backend!

#### Step 7: Deploy Initial Code

Since the worker is empty, you need to deploy the code:

**Option A - Via Wrangler CLI (Easiest):**
```bash
cd apps/backend
wrangler deploy
```

**Option B - Via Dashboard:**
1. Copy the entire content of `apps/backend/src/index.ts` and all dependencies
2. Paste into the Worker editor
3. Click **Save and Deploy**

**Verify Deployment:**
Visit: `https://roboz-trade.YOUR_SUBDOMAIN.workers.dev/api/health`

You should see:
```json
{
  "status": "ok",
  "timestamp": "..."
}
```

---

### Method 2: Deploy via Wrangler CLI (Quick Deployment)

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

### Troubleshooting Backend Deployment

**Issue: "Missing entry-point to Worker script"**
- Solution: Make sure you're in `apps/backend` directory when running `wrangler deploy`

**Issue: "Database binding not found"**
- Solution: Ensure D1 database binding is configured in wrangler.toml or Dashboard settings

**Issue: "Durable Object class not found"**
- Solution: Ensure Durable Object binding is configured in wrangler.toml or Dashboard settings

## Frontend Deployment (Cloudflare Pages)

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

## Post-Deployment Configuration

### 1. Update Frontend API URL

Edit `apps/frontend/.env.production`:

```env
VITE_API_URL=https://roboz-trade.YOUR_SUBDOMAIN.workers.dev/api
```

Or set it in Cloudflare Pages environment variables.

### 2. Update CORS Settings (if needed)

If your frontend and backend are on different domains, update `apps/backend/src/index.ts`:

```typescript
import { cors } from "hono/cors";

app.use(
  "/*",
  cors({
    origin: ["https://YOUR_FRONTEND_DOMAIN.pages.dev", "http://localhost:5173"],
    credentials: true,
  })
);
```

### 3. Custom Domain (Optional)

**Backend:**

```bash
cd apps/backend
wrangler publish --routes "api.roboztrade.com/*"
```

**Frontend:**

- Go to Cloudflare Pages dashboard
- Navigate to your project → **Custom domains**
- Add your domain (e.g., `roboztrade.com`)

## Verification

### Test Backend

```bash
curl https://roboz-trade.YOUR_SUBDOMAIN.workers.dev/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2025-10-22T..."
}
```

### Test Frontend

Open your frontend URL in a browser and verify:

- ✅ Page loads correctly
- ✅ Can register/login
- ✅ API calls work (check browser console)

## Troubleshooting

### Error: "Missing entry-point to Worker script"

- **Solution**: Make sure you're running `wrangler deploy` from `apps/backend` directory, or use the npm script: `bun run deploy:backend`

### Error: "Database not found"

- **Solution**: Run migrations: `bun run db:migrate`

### Error: "Unauthorized" on API calls

- **Solution**:
  1. Check JWT_SECRET is set: `wrangler secret list`
  2. Verify CORS settings allow your frontend domain

### Frontend shows "Network Error"

- **Solution**:
  1. Check `VITE_API_URL` environment variable is set correctly
  2. Verify backend is deployed and accessible
  3. Check browser console for CORS errors

### Database migrations fail

- **Solution**:
  1. Ensure D1 database is created
  2. Verify `database_id` in `wrangler.toml` matches your database
  3. Run: `wrangler d1 list` to see your databases

## CI/CD Setup (Optional)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches:
      - main

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Deploy Backend
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: apps/backend
          command: deploy

  deploy-frontend:
    runs-on: ubuntu-latest
    needs: deploy-backend
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Build Frontend
        run: bun run build:frontend
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: roboz-trade-frontend
          directory: apps/frontend/dist
```

Add these secrets to your GitHub repository:

- `CLOUDFLARE_API_TOKEN`: Create at https://dash.cloudflare.com/profile/api-tokens
- `CLOUDFLARE_ACCOUNT_ID`: Your account ID
- `VITE_API_URL`: Your backend worker URL

## Monitoring

### View Logs

```bash
# Backend logs
cd apps/backend
wrangler tail

# Or with filters
wrangler tail --status error
```

### Analytics

- Go to Cloudflare Dashboard → Workers & Pages
- Select your worker/pages project
- View analytics, requests, errors, etc.

## Costs

- **D1 Database**: Free tier includes 5GB storage, 5 million row reads/day
- **Workers**: Free tier includes 100,000 requests/day
- **Pages**: Free tier includes unlimited requests, 500 builds/month

## Support

- Cloudflare Docs: https://developers.cloudflare.com/
- Wrangler Docs: https://developers.cloudflare.com/workers/wrangler/
- Issues: https://github.com/RobozTrade/RobozTrade/issues
