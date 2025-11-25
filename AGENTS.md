# Repository Guidelines

## Project Structure & Module Organization
- Frontend (Next.js + React): `app/` (routes/layout), `components/` (feature-first: dashboard, scan, violation, ui), `styles/` (global CSS), `public/` (assets).
- Shared code: `lib/` (types, Tauri command adapters, utilities, stores, hooks), `hooks/` (legacy hooks), `data/` (DB file).
- Backend (Tauri + Rust): `src-tauri/` (commands, scanner, DB, git helpers), `src-tauri/tauri.conf.json` (bundle/dev config).
- Tests: `__tests__/`, `e2e-tests/` (WebdriverIO), `vitest.config.ts`/`vitest.setup.ts`. Build artifacts: `out/`, `src-tauri/target/`.

## Build, Test, and Development Commands
- Install deps: `pnpm install`.
- Web build: `pnpm build` (Next.js production build to `out/`).
- Dev (Tauri app + Next dev): `./run-ryn-dev.sh` (loads `.env` and runs `pnpm tauri dev`).
- Tauri prod bundle (codesign/ad-hoc as configured): `pnpm tauri build`.
- Unit/UI tests: `pnpm test` (Vitest), `pnpm test:run`, `pnpm test:coverage`.
- E2E (WebdriverIO): `pnpm test:e2e`.
- Lint: `pnpm lint`.

## Coding Style & Naming Conventions
- TypeScript/React with strict TS; prefer functional components and hooks. Filenames kebab-case in `components/`, PascalCase for components, camelCase for variables/functions.
- Styling: Tailwind via `app/globals.css` plus component-level classes; avoid inline styles unless necessary.
- Utilities: `lib/utils.ts` and `lib/utils/date.ts` for shared helpers; prefer `cn()` for class merging.
- Keep UI split into data hooks and presentational components (e.g., scan/dashboard modules).

## Testing Guidelines
- Framework: Vitest with `happy-dom`; WebdriverIO for E2E.
- Place unit tests near source or in `__tests__/`; name with `.test.ts`/`.spec.ts`.
- For UI-driven flows, prefer deterministic data and avoid networked calls; mock Tauri invokes where possible.

## Commit & Pull Request Guidelines
- Commits: short, imperative summaries (e.g., “Refactor scan UI and dashboard structure”). Group related changes; avoid formatting-only commits. Commit very often.
- PRs: include a clear summary, screenshots for UI changes, linked issues/tasks, and test evidence (`pnpm test`, `pnpm build`, or tauri dev/build logs). Call out any signing/codesign constraints on macOS.

## Security & Configuration Tips
- Secrets: never commit keys; use `.env` (not in repo). X.AI/Grok keys required for fixes.
- Tauri dev: set `PORT` to an open port to avoid conflicts; macOS code signing may require stripping xattrs (`xattr -cr …/ryn.app`) or using ad-hoc identity. Keep `identifier` without `.app` suffix.
