# GitHub Copilot Instructions for RobozTrade

## Project Overview

RobozTrade is an AI-powered trading platform built with a modern liquid-glass design inspired by Apple's design language. The project uses a Bun monorepo structure with a Cloudflare Workers backend and React frontend.

## Tech Stack

### Backend
- **Runtime**: Cloudflare Workers
- **Framework**: Hono 4.10.1
- **Database**: D1 SQLite with Drizzle ORM 0.38.3
- **Authentication**: JWT with bcryptjs
- **Encryption**: AES-GCM for API keys
- **Real-time**: WebSocket Durable Objects
- **API Integration**: Aster DEX with HMAC SHA256 signing

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite 6
- **Styling**: TailwindCSS 3.4.17
- **State Management**: Zustand 5.0.3
- **Routing**: React Router 7.1.3
- **Data Fetching**: TanStack Query 5.67.1
- **Charts**: Lightweight Charts 4.2.2
- **TypeScript**: 5.7.3

### Monorepo
- **Package Manager**: Bun
- **Structure**: apps/backend, apps/frontend, packages/shared-types

## Design System

### Theme
- **Style**: Liquid-glass (glassmorphism) with Apple-inspired aesthetics
- **Modes**: Dark/Light with smooth transitions (300ms)
- **Persistence**: localStorage with system preference detection

### Colors

**Light Mode:**
- Primary BG: `#ffffff` → `bg-light-bg-primary`
- Secondary BG: `#f5f5f7` → `bg-light-bg-secondary`
- Primary Text: `#1d1d1f` → `text-light-text-primary`
- Secondary Text: `#6e6e73` → `text-light-text-secondary`
- Border: `#d2d2d7` → `border-light-border`

**Dark Mode:**
- Primary BG: `#000000` → `bg-dark-bg-primary`
- Secondary BG: `#1c1c1e` → `bg-dark-bg-secondary`
- Primary Text: `#f5f5f7` → `text-dark-text-primary`
- Secondary Text: `#98989d` → `text-dark-text-secondary`
- Border: `#38383a` → `border-dark-border`

**Accent Colors:**
- Blue: `#007aff` → `bg-accent-blue` / `text-accent-blue`
- Purple: `#af52de` → `bg-accent-purple` / `text-accent-purple`
- Pink: `#ff2d55` → `bg-accent-pink` / `text-accent-pink`
- Green: `#34c759` → `bg-accent-green` / `text-accent-green`
- Red: `#ff3b30` → `bg-accent-red` / `text-accent-red`
- Orange: `#ff9500` → `bg-accent-orange` / `text-accent-orange`

### Typography
- **Font Family**: SF Pro Display, -apple-system, BlinkMacSystemFont, system-ui
- **Font Weights**: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
- **Always use**: `font-sans` class for consistency

### Glassmorphism Effect
```tsx
// Standard glass effect
className="backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 shadow-glass"

// Strong glass effect
className="backdrop-blur-2xl bg-white/70 dark:bg-black/70 border border-light-border dark:border-dark-border"
```

### Border Radius
- Small: `rounded-xl` (12px)
- Medium: `rounded-2xl` (16px)
- Large: `rounded-3xl` (24px)

### Animations
- **Duration**: `duration-200` or `duration-300`
- **Easing**: Default (ease-in-out)
- **Custom**: `animate-fade-in`, `animate-slide-up`, `animate-scale-in`, `animate-shimmer`

## Component Guidelines

### Use Reusable Glass Components

**Always prefer these over custom styling:**

```tsx
import { GlassCard, GlassButton, GlassInput } from "@/components/ui/GlassCard";

// Card
<GlassCard className="p-6">
  {/* content */}
</GlassCard>

// Button
<GlassButton variant="primary" size="md" onClick={handleClick}>
  Click Me
</GlassButton>

// Input
<GlassInput
  type="text"
  value={value}
  onChange={setValue}
  placeholder="Enter text"
/>
```

### Theme-Aware Styling

**Always use light/dark mode classes:**

```tsx
// ✅ Correct
<div className="bg-light-bg-secondary dark:bg-dark-bg-primary text-light-text-primary dark:text-dark-text-primary">

// ❌ Incorrect
<div className="bg-gray-100 text-black">
```

### Transitions

**Always add smooth transitions:**

```tsx
<div className="transition-colors duration-300">
  {/* content */}
</div>
```

### Icons

**Use lucide-react for all icons:**

```tsx
import { Activity, TrendingUp, Settings } from "lucide-react";

<Activity className="w-5 h-5" />
```

## Code Style

### TypeScript
- **Always use TypeScript** for all new files
- **Import types** from `@shared/types` when available
- **Define interfaces** for component props
- **Use type inference** where possible

### React
- **Functional components** only (no class components)
- **Hooks**: useState, useEffect, useCallback, useMemo
- **Custom hooks**: Prefix with `use` (e.g., `useTheme`, `useAuth`)
- **Props destructuring**: Always destructure props in function signature

### Imports
```tsx
// ✅ Correct order
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/api";
import type { User } from "@shared/types";

// ❌ Incorrect - mixed order
import { api } from "@/lib/api";
import { useState } from "react";
import type { User } from "@shared/types";
```

### Naming Conventions
- **Components**: PascalCase (e.g., `DashboardPage`, `GlassCard`)
- **Files**: PascalCase for components (e.g., `DashboardPage.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useTheme`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `AI_MODELS`)
- **Functions**: camelCase (e.g., `handleSubmit`, `fetchData`)

## Route Structure

### Public Routes (No auth required)
- `/` - Public dashboard

### Auth Routes (Only for non-authenticated)
- `/login` - Login page
- `/register` - Registration page

### Private Routes (Auth required, `/app` prefix)
- `/app/dashboard` - Main dashboard
- `/app/bots` - Trading bots management
- `/app/market` - Market data
- `/app/analytics` - Performance analytics
- `/app/benchmarks` - Benchmark testing
- `/app/settings` - User settings

## API Integration

### Backend Routes
```typescript
// Authentication
POST /api/auth/register
POST /api/auth/login

// Bots
GET /api/bots
POST /api/bots
GET /api/bots/:id
PUT /api/bots/:id
DELETE /api/bots/:id

// Market Data
GET /api/market/ticker/:symbol
GET /api/market/orderbook/:symbol

// Analytics
GET /api/analytics/performance
GET /api/analytics/trades
```

### Frontend API Calls
```tsx
import { api } from "@/lib/api";

// Always use try-catch
try {
  const response = await api.get("/bots");
  const bots = await response.json();
} catch (error) {
  console.error("Failed to fetch bots:", error);
}
```

## State Management

### Zustand Stores
```tsx
import { create } from "zustand";

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("token"),
  login: async (email, password) => {
    // implementation
  },
  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null });
  },
}));
```

## Database Schema

### Key Tables
- `users` - User accounts
- `bots` - Trading bot configurations
- `trades` - Trade history
- `positions` - Current positions
- `api_keys` - Encrypted API keys

### Drizzle ORM
```typescript
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const db = drizzle(env.DB, { schema });

// Query
const bots = await db.select().from(schema.bots).where(eq(schema.bots.userId, userId));

// Insert
await db.insert(schema.bots).values({ userId, name, strategy });
```

## AI Models

### 5 Trading Models
1. **Momentum Master** - Blue `#007aff`
2. **Mean Reversion Pro** - Purple `#af52de`
3. **Trend Follower** - Green `#34c759`
4. **Volatility Hunter** - Orange `#ff9500`
5. **Arbitrage Bot** - Pink `#ff2d55`

## Best Practices

### Performance
- Use `React.memo` for expensive components
- Use `useCallback` for event handlers passed to children
- Use `useMemo` for expensive calculations
- Lazy load routes with `React.lazy`

### Accessibility
- Always add `aria-label` to icon-only buttons
- Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Ensure keyboard navigation works
- Maintain color contrast ratios

### Security
- Never expose API keys in frontend code
- Always validate user input
- Use JWT for authentication
- Encrypt sensitive data (API keys) with AES-GCM

### Error Handling
- Always use try-catch for async operations
- Show user-friendly error messages
- Log errors to console for debugging
- Use error boundaries for React components

## Testing

### Run Tests
```bash
# Frontend
cd apps/frontend && bun test

# Backend
cd apps/backend && bun test
```

### Build
```bash
# Frontend
cd apps/frontend && bun run build

# Backend
cd apps/backend && bun run build
```

## Common Patterns

### Loading States
```tsx
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  try {
    await api.post("/endpoint", data);
  } finally {
    setLoading(false);
  }
};
```

### Theme Toggle
```tsx
import { useTheme } from "@/contexts/ThemeContext";

const { theme, toggleTheme } = useTheme();

<button onClick={toggleTheme}>
  {theme === "light" ? <Moon /> : <Sun />}
</button>
```

### Protected Routes
```tsx
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

const ProtectedRoute = ({ children }) => {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/login" />;
};
```

## Remember

1. **Always use glassmorphism components** (`GlassCard`, `GlassButton`, `GlassInput`)
2. **Always support dark/light mode** with proper color classes
3. **Always add smooth transitions** (200-300ms)
4. **Always use TypeScript** with proper types
5. **Always handle errors** with try-catch
6. **Always use SF Pro Display font** (`font-sans`)
7. **Always use rounded corners** (`rounded-xl`, `rounded-2xl`)
8. **Always import from `@/` aliases** for cleaner imports
9. **Always validate user input** before API calls
10. **Always test in both light and dark modes**

