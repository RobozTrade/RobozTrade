# Environment Variables Configuration Guide

## Overview

This guide explains all environment variables used in the RobozTrade application and how to configure them for different environments.

## Backend Environment Variables

### Secrets (Sensitive - Use `wrangler secret put`)

These variables contain sensitive information and should NEVER be committed to version control.

| Variable         | Description                                      | Required | How to Generate                                               |
| ---------------- | ------------------------------------------------ | -------- | ------------------------------------------------------------- |
| `JWT_SECRET`     | Secret key for signing JWT authentication tokens | ✅ Yes   | `openssl rand -base64 32`                                     |
| `ENCRYPTION_KEY` | Key for encrypting API keys stored in database   | ✅ Yes   | `openssl rand -base64 32` (MUST be different from JWT_SECRET) |

**Production Setup:**

```bash
cd apps/backend

# Generate two different random strings
openssl rand -base64 32  # Copy this for JWT_SECRET
openssl rand -base64 32  # Copy this for ENCRYPTION_KEY

# Set secrets in Cloudflare
wrangler secret put JWT_SECRET
# Paste the first random string when prompted

wrangler secret put ENCRYPTION_KEY
# Paste the second random string when prompted
```

**Local Development Setup:**

Create `apps/backend/.dev.vars` (this file is gitignored):

```
JWT_SECRET=your-local-jwt-secret-here
ENCRYPTION_KEY=your-local-encryption-key-here
```

### Public Variables (Non-Sensitive - In `wrangler.toml`)

These variables are defined in `apps/backend/wrangler.toml` under the `[vars]` section.

#### API Configuration

| Variable             | Description                | Default                     | Required |
| -------------------- | -------------------------- | --------------------------- | -------- |
| `ASTER_API_BASE_URL` | Base URL for Aster DEX API | `https://fapi.asterdex.com` | No       |

#### CORS Configuration

| Variable               | Description                                  | Default                                                                       | Required |
| ---------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- | -------- |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:5173,http://localhost:3000,https://roboz-trade.workers.dev` | No       |

**Example:** Add your custom domain:

```toml
CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:3000,https://roboz-trade.workers.dev,https://yourdomain.com"
```

#### Blockchain Configuration

| Variable                    | Description                                    | Default                                      | Required           |
| --------------------------- | ---------------------------------------------- | -------------------------------------------- | ------------------ |
| `BSC_RPC_URL`               | Binance Smart Chain RPC endpoint               | `https://bsc-dataseed1.binance.org`          | No                 |
| `USDT_CONTRACT_ADDRESS`     | USDT token contract address on BSC             | `0x55d398326f99059fF775485246999027B3197955` | No                 |
| `PAYMENT_RECIPIENT_ADDRESS` | Your wallet address for receiving bot payments | `0xB8b687E16BD6Ce3E37e6f9fd534542F75009c86B` | ⚠️ **UPDATE THIS** |
| `REQUIRED_PAYMENT_AMOUNT`   | Required payment amount in USDT                | `10`                                         | No                 |
| `MIN_CONFIRMATIONS`         | Minimum blockchain confirmations required      | `3`                                          | No                 |

**⚠️ IMPORTANT:** Update `PAYMENT_RECIPIENT_ADDRESS` with YOUR wallet address!

#### Crypto Configuration

| Variable            | Description                                                                  | Default  | Required |
| ------------------- | ---------------------------------------------------------------------------- | -------- | -------- |
| `PBKDF2_ITERATIONS` | Number of PBKDF2 iterations for encryption (higher = more secure but slower) | `100000` | No       |

#### Rate Limiting (Optional)

| Variable                  | Description                       | Default            | Required |
| ------------------------- | --------------------------------- | ------------------ | -------- |
| `RATE_LIMIT_WINDOW_MS`    | Rate limit window in milliseconds | `60000` (1 minute) | No       |
| `RATE_LIMIT_MAX_REQUESTS` | Maximum requests per window       | `100`              | No       |

## Frontend Environment Variables

Frontend environment variables are **build-time** variables. They are embedded into the JavaScript bundle during the build process.

### Development Environment (`.env.development`)

Automatically loaded when running `bun run dev`:

```env
# API Configuration
VITE_API_URL=http://localhost:8787/api
VITE_WS_URL=ws://localhost:8787/ws

# WalletConnect
VITE_WALLETCONNECT_PROJECT_ID=your-project-id

# App Metadata
VITE_APP_NAME=RobozTrade
VITE_APP_URL=http://localhost:5173

# Blockchain
VITE_USDT_CONTRACT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
VITE_PAYMENT_RECIPIENT_ADDRESS=0xYOUR_WALLET_ADDRESS
VITE_REQUIRED_PAYMENT_AMOUNT=10
```

### Production Environment (`.env.production`)

Used when building for production (`bun run build:frontend`):

```env
# API Configuration - Empty for same-origin requests
VITE_API_URL=
VITE_WS_URL=

# WalletConnect
VITE_WALLETCONNECT_PROJECT_ID=your-project-id

# App Metadata
VITE_APP_NAME=RobozTrade
VITE_APP_URL=https://roboz-trade.workers.dev
VITE_APP_ICON=https://roboz-trade.workers.dev/icon.png

# Blockchain
VITE_USDT_CONTRACT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
VITE_PAYMENT_RECIPIENT_ADDRESS=0xYOUR_WALLET_ADDRESS
VITE_REQUIRED_PAYMENT_AMOUNT=10
```

### All Frontend Variables

| Variable                         | Description                               | Default                                      | Required           |
| -------------------------------- | ----------------------------------------- | -------------------------------------------- | ------------------ |
| `VITE_API_URL`                   | API base URL (empty for same-origin)      | `/api`                                       | No                 |
| `VITE_WS_URL`                    | WebSocket URL (empty for same-origin)     | `/ws`                                        | No                 |
| `VITE_WALLETCONNECT_PROJECT_ID`  | WalletConnect project ID from Reown Cloud | Provided                                     | ⚠️ **UPDATE THIS** |
| `VITE_APP_NAME`                  | Application name                          | `RobozTrade`                                 | No                 |
| `VITE_APP_DESCRIPTION`           | Application description                   | `AI-Powered Trading Bot Platform`            | No                 |
| `VITE_APP_URL`                   | Application URL                           | `https://roboztrade.com`                     | No                 |
| `VITE_APP_ICON`                  | Application icon URL                      | `https://roboztrade.com/icon.png`            | No                 |
| `VITE_USDT_CONTRACT_ADDRESS`     | USDT contract address on BSC              | `0x55d398326f99059fF775485246999027B3197955` | No                 |
| `VITE_PAYMENT_RECIPIENT_ADDRESS` | Payment recipient wallet address          | `0xB8b687E16BD6Ce3E37e6f9fd534542F75009c86B` | ⚠️ **UPDATE THIS** |
| `VITE_REQUIRED_PAYMENT_AMOUNT`   | Required payment amount in USDT           | `10`                                         | No                 |

## Quick Setup Checklist

### Before First Deployment

- [ ] Generate JWT_SECRET: `openssl rand -base64 32`
- [ ] Generate ENCRYPTION_KEY: `openssl rand -base64 32` (different from JWT_SECRET!)
- [ ] Set backend secrets: `wrangler secret put JWT_SECRET` and `wrangler secret put ENCRYPTION_KEY`
- [ ] Update `PAYMENT_RECIPIENT_ADDRESS` in `apps/backend/wrangler.toml` with YOUR wallet address
- [ ] Get WalletConnect Project ID from https://cloud.reown.com/
- [ ] Update `VITE_WALLETCONNECT_PROJECT_ID` in `apps/frontend/.env.production`
- [ ] Update `VITE_PAYMENT_RECIPIENT_ADDRESS` in `apps/frontend/.env.production` with YOUR wallet address
- [ ] Update `CORS_ALLOWED_ORIGINS` in `apps/backend/wrangler.toml` if using custom domain

### For Local Development

- [ ] Create `apps/backend/.dev.vars` with JWT_SECRET and ENCRYPTION_KEY
- [ ] Copy `apps/frontend/.env.example` to `apps/frontend/.env.development`
- [ ] Update wallet addresses in `.env.development` if needed

## Important Notes

1. **Never commit secrets to version control**

   - `.dev.vars` is gitignored
   - `.env.development` is gitignored
   - Use `wrangler secret put` for production secrets

2. **Frontend variables are build-time**

   - Changes require rebuilding the frontend: `bun run build:frontend`
   - Backend variables are runtime (no rebuild needed)

3. **Update wallet addresses**

   - Backend: `PAYMENT_RECIPIENT_ADDRESS` in `wrangler.toml`
   - Frontend: `VITE_PAYMENT_RECIPIENT_ADDRESS` in `.env.production`
   - Both should point to YOUR wallet address

4. **Get your own WalletConnect Project ID**

   - Visit: https://cloud.reown.com/
   - Create a new project
   - Copy the Project ID
   - Update `VITE_WALLETCONNECT_PROJECT_ID` in frontend env files

5. **CORS Configuration**

   - Add your custom domain to `CORS_ALLOWED_ORIGINS`
   - Format: comma-separated list with no spaces after commas
   - Example: `"http://localhost:5173,https://yourdomain.com"`

6. **Encryption Key Security**
   - `ENCRYPTION_KEY` must be different from `JWT_SECRET`
   - If you lose `ENCRYPTION_KEY`, you cannot decrypt existing API keys in the database
   - Store it securely (e.g., password manager)

## Environment-Specific Deployment

### Staging Environment

Create `apps/backend/wrangler.staging.toml`:

```toml
name = "roboz-trade-staging"
# ... copy other config from wrangler.toml

[vars]
ASTER_API_BASE_URL = "https://staging-api.asterdex.com"
CORS_ALLOWED_ORIGINS = "https://roboz-trade-staging.workers.dev"
PAYMENT_RECIPIENT_ADDRESS = "0xYOUR_STAGING_WALLET"
```

Set staging secrets:

```bash
wrangler secret put JWT_SECRET --config wrangler.staging.toml
wrangler secret put ENCRYPTION_KEY --config wrangler.staging.toml
```

Deploy:

```bash
wrangler deploy --config wrangler.staging.toml
```

### Production Environment

Use the default `wrangler.toml` and set production secrets:

```bash
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY
```

## Troubleshooting

### "Missing JWT_SECRET" error

**Solution:** Set the JWT_SECRET secret:

```bash
wrangler secret put JWT_SECRET
```

### "Missing ENCRYPTION_KEY" error

**Solution:** Set the ENCRYPTION_KEY secret:

```bash
wrangler secret put ENCRYPTION_KEY
```

### CORS errors in production

**Solution:** Add your production domain to `CORS_ALLOWED_ORIGINS` in `wrangler.toml`:

```toml
CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:3000,https://roboz-trade.workers.dev,https://yourdomain.com"
```

### WalletConnect not working

**Solution:**

1. Get your own Project ID from https://cloud.reown.com/
2. Update `VITE_WALLETCONNECT_PROJECT_ID` in `.env.production`
3. Rebuild frontend: `bun run build:frontend`
4. Redeploy: `bun run deploy`

### Payment validation fails

**Solution:** Ensure `PAYMENT_RECIPIENT_ADDRESS` matches in both:

- Backend: `apps/backend/wrangler.toml`
- Frontend: `apps/frontend/.env.production`

## References

- [Cloudflare Workers Environment Variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Wrangler Secrets](https://developers.cloudflare.com/workers/wrangler/commands/#secret)
