# Marching Simulator – Implementation Prompt

You are an AI engineer tasked with implementing a “Marching Simulator” feature for this Next.js + Cloudflare Workers app using the attached 24-page PDF specification.

## Context
- Stack: Next.js 15 (App Router) + React 19, deployed via `@opennextjs/cloudflare` to Cloudflare Workers.
- Runtime constraints: Cloudflare Workers (browser-compatible APIs; avoid Node-only modules like fs, net, child_process).
- Source structure: App Router in `app/`, static assets in `public/`, config in project root.
- Spec location: Place the PDF at `docs/spec/marching-simulator-spec.pdf` (or update the path below).

## Objectives
Implement a production-ready Marching Simulator according to the PDF spec, delivering:
1) Working UI/UX under `app/marching` (or as instructed by the spec).
2) Deterministic core simulation logic with thorough TypeScript types.
3) Clear separation: pure simulation engine (no React) + React presentation.
4) Documentation, tests (at least unit tests for the engine), and traceability from requirements.

## Inputs & Artifacts to Produce
- Input: 
  - `docs/spec/marching-simulator-spec.pdf`: 29 pages.
  - `docs/spec/marching-simulator-spec.md`: Markdown version of the 29 page PDF.
- Produce the following artifacts in this repo:
  - `docs/ai/analysis/requirements.md`: Structured requirements extracted from the PDF with IDs (REQ-###).
  - `docs/ai/analysis/glossary.md`: Domain terms and definitions.
  - `docs/ai/analysis/use-cases.md`: User stories/flows, pre/post-conditions.
  - `docs/ai/plan/implementation-plan.md`: Architecture, data model, modules, and milestones.
  - `docs/ai/plan/test-plan.md`: Unit coverage for the engine, scenario fixtures, and key UI interactions.
  - `docs/ai/tracing/traceability.md`: Map REQ-### -> code files/tests.
  - `docs/ai/CHANGELOG.md`: Summarize changes per milestone/PR.

## Deliverables (Code)
- `app/marching/` route with pages/server components as needed.
- `app/marching/components/*` for UI.
- `lib/marching/engine/*` for pure TS simulation logic (no React).
- `lib/marching/types.ts` shared types.
- `lib/marching/fixtures/*` sample scenarios.
- Optional (if spec requires persistence): Cloudflare KV/D1 bindings via `cloudflare-env.d.ts`.

## Definition of Done
- All high/medium priority requirements implemented (see requirements.md priorities).
- Simulator engine has unit tests for core algorithms and edge cases.
- Lint passes (`npm run lint`). Build passes (`npm run build`).
- Docs updated: implementation plan, test plan, and traceability.
- Demo scenarios available and documented.

## Implementation Steps
1) Read and summarize the PDF spec.
   - Extract requirements with IDs and priorities into `docs/ai/analysis/requirements.md`.
   - Create a glossary and list assumptions/gaps.
2) Propose an architecture and data model.
   - Focus on a pure engine (deterministic, testable) decoupled from UI.
   - List modules, inputs/outputs, and error handling.
3) Author an implementation plan with milestones and acceptance criteria.
4) Implement the engine in `lib/marching/engine/*` with comprehensive types and tests.
5) Build the UI in `app/marching/*`, consuming the engine.
6) Add demo fixtures and a simple scenario switcher for manual validation.
7) Complete docs and traceability; open a PR using the provided template.

## Constraints & Guidelines
- TypeScript everywhere; prefer explicit types over inference when public.
- No Node-only APIs; ensure compatibility with Cloudflare Workers.
- Keep the engine side-effect free; inject time/randomness for determinism.
- Performance: target <16ms simulation step for smooth 60fps interactions where applicable.
- Accessibility: keyboard navigation and ARIA where relevant.
- Internationalization-ready (no hard-coded English strings in engine logic).

## Testing Scope
- Engine: unit tests for core rules, edge cases (empty inputs, large formations, invalid commands).
- UI: lightweight tests for critical interactions or manual smoke test instructions.
- Provide fixtures representing scenarios from the spec for repeatable validation.

## How to Run
- Dev: `npm run dev`
- Build: `npm run build`
- Preview on Cloudflare locally: `npm run preview`

## Spec Processing (Optional Helper)
If the PDF needs text extraction, you can use `docs/spec/marching-simulator-spec.md`. See `docs/spec/README.md` for suggestions. Keep derived artifacts in `docs/spec/` and cite page numbers.

## Review Checklist
- Do requirements map to code/tests via `traceability.md`?
- Are engine APIs documented and stable?
- Are performance and accessibility considerations addressed?
- Do build and lint pass? Any worker-incompatible dependencies?
