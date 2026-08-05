# ai-study

Single high-school (高中) AI learning monorepo.

## Structure

```
apps/web          Next.js web app (@ai-study/web)
packages/core     Shared TypeScript library (@ai-study/core)
packages/ios      Swift iOS client (ios-gaokao target, directory name retained)
```

## Quick start

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# Fill Supabase, AI keys, optional S3

pnpm --filter @ai-study/web dev     # http://localhost:3000
```

## Verify

```bash
cd packages/core && pnpm exec tsc --noEmit && pnpm exec vitest run
cd apps/web && pnpm exec tsc --noEmit
```

## Baseline

- Phase: `high` only (`APP_PHASE` in `packages/core/src/constants.ts`)
- Package scope: `@ai-study/*` (legacy `@ai-learning/*` removed)
- iOS: single app under `packages/ios/ios-gaokao/`; `ios-zhongkao` removed

## Docs

- **项目参考（对话汇总）**: [docs/PROJECT_REFERENCE.md](docs/PROJECT_REFERENCE.md)
- **Agent Memory（六项待建设 + 已实现）**: [docs/AGENT_MEMORY.md](docs/AGENT_MEMORY.md)
- iOS: [packages/ios/README.md](packages/ios/README.md)
- Env template: [apps/web/.env.example](apps/web/.env.example)
- DB migration: [packages/core/src/db/migrations/0000_initial.sql](packages/core/src/db/migrations/0000_initial.sql)
