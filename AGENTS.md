# AGENTS.md

## Purpose

This repository uses Codex as an implementation assistant.

The primary objective is to minimize unnecessary context usage while producing correct, maintainable code.

---

# Context Policy (Highest Priority)

Treat context as a limited resource.

Before inspecting source code, consult `docs/CODEMAP.md` and use its feature index to identify the smallest likely file set. Treat the map as navigation, not as a substitute for reading the exact code being changed.

Never explore the repository unless necessary.

Always follow this workflow:

1. Read only the file(s) explicitly mentioned by the user.
2. If additional information is required, inspect ONE directly related file.
3. Continue expanding only when there is concrete evidence that another file is required.
4. Never recursively inspect folders to "understand the project".
5. Never perform architecture exploration unless explicitly requested.

Maximum initial context:

* 3 source files
* 1 config file
* 1 type definition

If more files are required:

* Explain why.
* Continue only after justification.

---

# Search Strategy

Prefer:

* exact filename
* exact import path
* TypeScript symbol lookup
* rg

Avoid:

* grep over the whole repository
* recursive folder scanning
* reading entire directories

Never search src recursively unless explicitly requested.

---

# File Reading

Prefer reading only the relevant section.

Do NOT read an entire file when:

* one function
* one component
* one type
* one API handler

is sufficient.

Assume imported modules are correct unless implementation details are required.

Do not recursively follow import chains.

---

# Editing

Modify the minimum number of files.

Reuse existing code.

Do not refactor unrelated code.

Do not rename files or folders unless requested.

Preserve existing architecture.

When adding, deleting, moving, or materially changing the responsibility of a file, update `docs/CODEMAP.md` in the same change.

## Function and Component Documentation

Every newly created named function, class method, React component, hook, route handler, and script entry function must have a concise TSDoc comment immediately above it that includes:

* `Signature:` followed by the complete callable signature in backticks.
* `Purpose:` describing what it does, its important side effect, or the boundary it owns.

Example:

```ts
/**
 * Signature: `async function getEventById(id: string): Promise<NormalizedEvent | null>`
 * Purpose: Loads one official event or user post and returns the shared event DTO shape.
 */
export async function getEventById(id: string) {
```

Keep the comment synchronized when the signature or responsibility changes. Do not add comments that merely restate the function name.

Exemptions:

* small inline callbacks passed directly to `map`, `filter`, event props, timers, or promise handlers
* trivial local closures whose behavior is fully obvious at the call site
* generated code and third-party declarations

When an existing named function or component is materially changed, add or refresh the same documentation if it does not already exist.

---

# Scope

Limit work strictly to the user's request.

Ignore unrelated improvements.

Never perform cleanup-only commits.

Never rewrite working code for style reasons.

---

# Next.js 16

Use App Router only.

Prefer:

* Server Components
* Route Handlers
* Server Actions when appropriate

Avoid Client Components unless browser APIs or interactivity require them.

Never convert Server Components into Client Components without necessity.

---

# TypeScript

No any.

Prefer explicit types.

Prefer existing shared types.

Avoid duplicate interfaces.

Infer types when readability is maintained.

---

# Tailwind CSS v4

Use utility classes.

Reuse existing design patterns.

Avoid inline style.

Avoid introducing custom CSS unless necessary.

Prefer composition over duplication.

---

# Prisma 7

Use existing Prisma Client.

Do not modify schema.prisma unless requested.

Avoid unnecessary migrations.

Prefer transaction() when multiple writes are related.

Prevent N+1 queries.

Prefer selecting only required fields.

Never use SELECT * equivalents.

When modifying database logic:

read only:

- related Prisma model
- current repository/service

Do not inspect unrelated models.

Assume other models are correct.

---

# PostgreSQL

Prefer indexed queries.

Avoid loading unnecessary rows.

Always paginate large datasets.

Do not introduce raw SQL unless required.

When raw SQL is necessary:

* use parameterized queries
* never concatenate user input

---

# MapLibre GL JS

Preserve current map instance.

Avoid recreating the map.

Update sources/layers instead.

Prefer:

setData()

setFeatureState()

over removing and rebuilding layers.

---

# CARTO Positron

Treat the basemap as read-only.

Do not modify style unless requested.

Avoid replacing the basemap.

---

# Performance

Prefer incremental rendering.

Avoid unnecessary React re-renders.

Memoize only when beneficial.

Avoid premature optimization.

---

# API Design

Follow existing API conventions.

Return consistent response formats.

Reuse validation logic.

Avoid introducing new dependencies.

---

# Dependencies

Do not install new packages unless requested.

Prefer built-in APIs.

Reuse existing libraries.

---

# Validation

Do not automatically execute:

npm run build

npm run lint

npm run test

unless:

* user requests
* validation is necessary

If execution may produce large output:

truncate logs.

---

# Shell Usage

Avoid commands producing massive output.

Prefer:

rg

git diff --stat

head

tail

When output may exceed several thousand characters:

truncate it.

---

# Documentation

Update documentation only when behavior changes.

After every code or content change, add a concise record of the change to `CHANGELOG.md` and create a git commit before finishing.

Keep comments concise.

Do not explain obvious code.

---

# Before Finishing

Verify:

* scope is respected
* no unrelated files modified
* no unnecessary dependencies introduced
* type safety preserved
* existing architecture maintained

If unsure,

ask instead of assuming.


Never recreate map layers unless required.

Prefer updating:

- source
- feature state
- paint properties

instead of rebuilding the map.
