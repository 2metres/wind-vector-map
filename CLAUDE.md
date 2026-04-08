# WebGL Experiments

Multi-experiment WebGL app (Svelte 5 + Vite + TypeScript).

## Architecture

- `src/Shell.svelte` — app shell with nav bar, mounts experiments dynamically
- `src/router.svelte.ts` — hash-based router using Svelte 5 runes
- `src/experiments/registry.ts` — experiment manifest with lazy loaders
- `src/experiments/<name>/` — each experiment is self-contained
- `src/lib/` — shared infrastructure (GL utils, UI components, media, stores, canvas)

## Codemap

A codemap is auto-generated at `.codemap/map.md` on every commit (via pre-commit hook). It provides a structural overview of the codebase.

- Config: `.codemap/config.json`
- Claude Code hooks: `.claude/settings.local.json` (session-start, pre/post-edit, pre-compact, prompt-submit, session-stop)
- Pre-commit hook regenerates `.codemap/map.md` and stages it automatically

Read `.codemap/map.md` when you need to orient yourself in the codebase.

## Commands

- `bun run dev` — start dev server
- `bun run check` — svelte-check + tsc
- `bun run build` — production build
- `bun run lint` — eslint

## Conventions

- WebGL utility functions are free functions taking `gl: WebGLRenderingContext` as first arg
- Experiment-specific code (shaders, stores, simulation logic) belongs under `src/experiments/<name>/`
- Shared reusable code belongs under `src/lib/`
- Use `createPersistedStore` factory for experiment settings (key format: `<experiment>:settings`)
- Svelte 5 runes mode — use `$state`, `$derived`, `$effect`, `$props`, `$bindable`
