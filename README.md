# ai-study

Single high-school (高中) AI learning monorepo.

## Structure

```
apps/web          Next.js web app (@ai-study/web)
packages/core     Shared TypeScript library (@ai-study/core)
packages/ios      Swift iOS client (ios-gaokao target, directory name retained)
packages/android  Kotlin + Jetpack Compose Android client (独立 Gradle 工程, 开发中)
packages/visual-ast  Geometry AST 开源子模块（schema/validator/SVG renderer/prompt/playground，零依赖）
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
cd packages/visual-ast && node --test src/*.test.ts
pnpm --filter @ai-study/core eval:geometry   # 需 DEEPSEEK_API_KEY（真跑 geometry eval + analyze e2e）
```

## Baseline

- Phase: `high` only (`APP_PHASE` in `packages/core/src/constants.ts`)
- Package scope: `@ai-study/*` (legacy `@ai-learning/*` removed)
- iOS: single app under `packages/ios/ios-gaokao/`; `ios-zhongkao` removed
- Android: `packages/android` (Kotlin + Compose, mirrors iOS 3-layer arch, not in pnpm workspace)
- Visual AST: `packages/visual-ast` (零依赖开源子模块，不纳入 pnpm workspace)

## Docs

- **项目参考（对话汇总）**: [docs/PROJECT_REFERENCE.md](docs/PROJECT_REFERENCE.md)
- **Science AST 三版本（V1/V2/V3）**: [docs/SCIENCE_AST_IOS_ROADMAP.md](docs/SCIENCE_AST_IOS_ROADMAP.md)
- **公式与几何渲染**: [docs/RENDER_AST.md](docs/RENDER_AST.md)
- **Visual AST 子项目**: [docs/VISUAL_AST.md](docs/VISUAL_AST.md)
- **几何提示词与 Eval**: [docs/GEOMETRY_PROMPT_EVAL.md](docs/GEOMETRY_PROMPT_EVAL.md) / [docs/GEOMETRY_V2_EXTENSIONS.md](docs/GEOMETRY_V2_EXTENSIONS.md)
- **Agent Memory（M1–M6 六项已实现）**: [docs/AGENT_MEMORY.md](docs/AGENT_MEMORY.md)
- iOS: [packages/ios/README.md](packages/ios/README.md)
- Android: [packages/android/README.md](packages/android/README.md)
- Env template: [apps/web/.env.example](apps/web/.env.example)
- DB migrations: `packages/core/src/db/migrations/`（0000–0003）
