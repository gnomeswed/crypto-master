# Crypto Master - Crypto Dashboard

> Next.js 16.2.3 + React 19 trading dashboard. Binance (spot) + ByBit (futures, migrado para Binance public API para evitar IP blocks).

## Tech Stack
- **Framework:** Next.js 16.2.3 (custom version — check `node_modules/next/dist/docs/` before writing code)
- **UI:** React 19, TailwindCSS 4, lightweight-charts, recharts, lucide-react
- **Backend:** Supabase (auth + storage), Vercel deploy
- **Languagem:** User prefere respostas em português

## Estrutura
```
app/              # Next.js App Router
  api/            # API routes
  login/          # Login page
  page.tsx        # Dashboard principal
components/       # UI components
  Dashboard/      # Dashboard-specific components
  UI/             # Reusable UI primitives
  Views/          # View-level components
lib/              # Core logic
  engine.ts       # Trading engine principal
  bybit.ts        # API client (ByBit/Binance)
  SignalContext.tsx  # Signal/context provider
  storage.ts      # Persistência local
  types.ts        # TypeScript types
  supabase.ts     # Supabase client
  rateLimiter.ts  # Rate limiting
  logger.ts       # Pino logger
middleware.ts     # Route middleware
```

## Funcionalidades Implementadas
- Live price tracking (Binance spot)
- Trade history + extrato histórico
- Agent reports (relatório de trades abertos/fechados)
- Manual orders
- Dashboard com gráficos (lightweight-charts + recharts)
- Auth via Supabase
- Deploy na Vercel

## Histórico Recente (git log)
- `7b455f0` fix: build Vercel
- `d1f3c76` feat: segurança e performance
- `975d4ea` fix: Binance spot prices + traduções
- `239dfb8` feat: agent reports + live price tracking
- `f087004` fix: relatório no history drawer
- `53653bb` fix: restored agent report
- `6e1af64` refactor: migrated from ByBit to Binance public API
- `4252bf0` fix: remover assinatura rotas públicas (ByBit IP restriction)
- `4059f4f` feat: extrato histórico + performance de preços + relatório de fechamento

## Notas Importantes
- **ByBit → Binance:** API pública migrada para ByBit → Binance para evitar IP blocks. Rotas públicas não assinadas para evitar error 10004.
- **Vercel:** Deploy configurado. Verificar compatibilidade de build.
- **Fix scripts:** Vários arquivos `fix*.js` e `replace*.js` no root podem ser removidos (scripts temporários de fix).
- **AGENTS.md:** Contém aviso sobre Next.js custom com breaking changes.
