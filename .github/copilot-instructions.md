# Copilot Instructions

## Architecture Snapshot
- Next.js App Router project deployed to Cloudflare Workers via `@opennextjs/cloudflare`; keep UI code under `app/` and pure domain logic under `lib/`.
- The marching simulator experience lives at `/marching`, with `app/marching/page.tsx` wiring the full-screen experience.
- Pure simulation code is in `lib/marching/**`; nothing in this folder should import React/DOM APIs so it can run in tests and Workers.
- Cloudflare bindings/types flow through `env.d.ts` and `wrangler.jsonc`; always run `npm run cf-typegen` after editing bindings.

## Simulation Engine (lib/marching)
- `lib/marching/index.ts` is the single public surface exporting types, `createInitialState`, `reduce`, `parseCommand`, geometry, and orchestrator helpers—prefer importing from here.
- State is modeled by `SimulatorState` (`types.ts`); keep new fields serializable and document defaults in `createInitialState()`.
- `engine/reducer.ts` enforces drill rules (e.g., facing requires `motion === 'halted'`, flanks require marching). Always return `{ next, error? }` without mutating the incoming state.
- The orchestrator (`orchestrator/index.ts`) turns reducer outputs into cadet animations: use `applyCommandToSimulation()` when you need action queues and `assignCadetRoles()` whenever guide side changes.
- `geometry/positions.ts` computes cadet coordinates; spacing is driven by `state.spacing` (normal vs close interval). Update geometry instead of hardcoding offsets in UI.
- Keep scenarios/demo scripts in `fixtures/sample-scenarios.ts` so tests and the UI can share them.

## UI + Simulator Experience
- `app/marching/components/simulator-client.tsx` is the rich client: hooks for setup, canvas rendering, hotkeys, and visual logs. It calls the reducer and orchestrator directly; keep it as the sole place that mutates React state.
- `app/marching/simulator-client.tsx` is a pared-down JSON debugger for manual testing—use it as a reference when validating reducer output.
- When adding UI features, pipe commands through `dispatchCommand()` so reducer errors surface in `setError()` and simulation history stays accurate.

## Command Parsing & Validation
- `parser/index.ts` only knows about textual commands; every string path must map to a `Command` kind or return `{ error }`. Extend it in tandem with `reduce()` and add tests to cover the new syntax.
- Input widgets (forms, quick buttons, keyboard shortcuts) all dispatch `Command` objects; keep them synchronized via the `Command` union before touching UI copy.

## Testing & Quality Gates
- Use `npm run test` (Vitest) for the pure engine—see `tests/reducer.test.ts` for coverage of reducer + parser interactions. Add new tests per command or state field before wiring UI.
- Manual smoke tests: `npm run dev`, open `/marching`, run the checklist from `app/marching/README.md` (FALL IN, FORWARD MARCH, HALT, LEFT/RIGHT FACE, LEFT/RIGHT FLANK, TO THE REAR) and verify JSON + canvas stay in sync.

## Docs & Traceability
- Requirements/spec live under `docs/spec/` (PDF + extracted markdown); AI planning artifacts are under `docs/ai/**` (analysis, plan, tracing, changelog). Update these whenever new simulator behaviors are implemented.
- `PROMPT.md` describes the implementation brief; reference it when scoping large features.

## Cloudflare / Build Workflows
- Local dev: `npm run dev` (Next + Turbopack).
- Production build pipeline: `npm run build` (generates Workers types + Next build) followed by `npm run preview` or `npm run deploy`. For dev bindings/environments, use the `*:dev` scripts.
- Always regenerate Worker bindings before deployment (`npm run build` already calls `wrangler types`, but `npm run cf-typegen` is available for ad-hoc updates).
