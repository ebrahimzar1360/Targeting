# هدف‌نگار — notes for working on this repo

Persian (RTL) goal-setting PWA for the «ماتریس ساختار طراحی» method. Client-only: no backend, data lives in `localStorage`.

## Commands

- `npm run dev` — dev server
- `npm test` — vitest (domain + Excel round trip). `GOAL_XLSX=/path/goal.xlsx npm test` also imports an original spreadsheet.
- `npm run test:e2e` — Playwright browser tests (`tests/e2e/`) against the production build; run `npm run build` first. CI runs them before every deploy.
- `npm run build:artifact` — the claude.ai build: one self-contained page at `dist-artifact/hadafnegar.html` (published as https://claude.ai/artifact/MkioP4edQenGAhLek63JNb).
- `npm run build` — typecheck + production build (`dist/`). `.github/workflows/deploy.yml` tests every push and publishes the repo's default branch to GitHub Pages.

## Architecture

- `src/domain/` is pure logic with no React: `schema.ts` (zod model, single source of types), `jalali.ts` (dates), `calc.ts` (progress, capacity, budget, health checks), `factory.ts`, `migrate.ts`. Put new rules here and test them in `domain.test.ts`.
- `src/store/store.ts` — one zustand store. All plan edits go through `edit(label, recipe)`, which records an undo step; don't mutate plans elsewhere.
- Pages in `src/pages/`, editing sheets in `src/components/editors.tsx`, UI primitives in `src/components/ui/`.
- `src/data/templates.ts` — starter templates (vision, role model, requirements with desired states). Add a template by appending an entry.
- `src/pages/Report.tsx` — printable report; print styles use Tailwind `print:` variants, and the app switches to light theme on `beforeprint`.
- `src/io/excel.ts` reads and writes the original spreadsheet layout. It is header-driven, so keep header labels stable.
- `src/platform/` — differences between the web and claude.ai builds behind `IS_ARTIFACT` (a build-time constant): storage (`storage.ts`: localStorage, or the viewer's private `data/users/<id>/` documents in the artifact's db), file saves (`downloads` capability), the assistant (`sample` capability instead of the API key), theme (host `data-theme`). On claude.ai the frame blocks downloads, `window.print()`, `alert/prompt`, outside network calls and service workers, so never use those directly; go through these helpers.
- `src/ai/claude.ts` is optional. It loads `@anthropic-ai/sdk` lazily, uses `client.beta.messages.parse` with zod output formats, and only returns suggestions. The UI never applies them without a click.

## Conventions

- Dates are Jalali strings `YYYY/MM/DD` with Latin digits; zero-padded, so string comparison = date comparison. Show them with `fmtJ`, and numbers with `faNum` / `faPct`.
- Changing the data shape: update `schema.ts` with defaults, bump `SCHEMA_VERSION`, and add a step in `migrate.ts`, so old backups still load.
- Layout is RTL. Use logical Tailwind utilities (`ms-`, `pe-`, `start-`, `end-`, `insetInlineStart`), never `left`/`right`.
- Colors come from the tokens in `src/index.css` (`bg-surface`, `text-ink-2`, `bg-brand`, …). Category colors are `var(--cat-N)`. Status colors are reserved for state and always come with an icon or label.
- Activities carry hours and cost as numbers; budget and capacity are derived, never typed in.
- In CSS grids that hold truncated text, use `grid-cols-1` (minmax(0,1fr)), or long titles overflow on phones.
