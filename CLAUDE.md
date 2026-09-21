# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

## Architecture Overview

This is a **Nuxt 4 full-stack application** (SSR disabled — SPA mode) with Nitro as the server engine and Drizzle ORM.

### Frontend (`app/`)

1. **UI**: Nuxt UI v4 (component library built on TailwindCSS v4)
2. ** Skill ** `gnr-component`

### Backend (`server/`)

Three-layer architecture:

1. **API routes** (`server/api/`) — Single Nitro event handler per resource, routes by HTTP method (GET/POST/PUT/DELETE) to the matching controller action
2. **Controllers** (`server/controllers/`) — Business logic: `paginate`, `find`, `create`, `update`, `destroy`, `download`
3. **Request validation** (`server/requests/`) — Zod schemas: `createRequest`, `updateRequest`, `filterRequest`,errors returned via `flattenError()`
4. ** Skill ** `gnr-api`

### Database

1. **PostgreSQL** + **Drizzle ORM** (`server/drizzle/`)
2. Schema files: `server/drizzle/schema/*.schema.ts` — all exported through `server/drizzle/schema/index.ts`
3. Relations defined in `server/drizzle/relations.ts`
4. DB instance created in `server/drizzle/db.ts` (imported as `db` throughout controllers)
5. ** Skill ** `gnr-api`

### Rules

- .claude/rules/api-pattern.md
- .claude/rules/component-pattern.md
