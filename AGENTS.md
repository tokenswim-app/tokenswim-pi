# AGENTS.md

A pi extension that registers Tokenswim as a model provider. See
[CONTEXT.md](./CONTEXT.md) for the vocabulary and [README.md](./README.md) for
usage.

## Layout

```
src/index.ts            the extension's entry — auth, Key Verification, registration
src/catalog.ts          the Model Catalog: ids, prices, capabilities
test/harness.ts         the seam: load the extension, drive it through pi's models runtime
test/provider.test.ts   the suite, offline and credential-free
test/drift/             compares the catalog against tokenswim.app/pricing (opt-in)
test/smoke.ts           one real request, run by hand
ext.sh                  register a local checkout with pi
```

## Rules

- **Import only `@earendil-works/pi-ai` and `@earendil-works/pi-ai/compat`.**
  pi's extension loader resolves those two specifiers. An extension importing
  any other subpath fails to load *silently* — no error, no warning, the
  provider simply never appears. `./ext.sh install` exists to catch that. The
  rule is about package specifiers: relative imports between files under `src/`
  are fine, and pi's own bundled extensions use them.
- **Test through the seam, not the internals.** Tests load the extension the
  way pi does and assert on the provider it registers. Do not import
  `src/catalog.ts` or the auth object directly — a catalog assertion should go
  through the registered provider, so it also proves the catalog reached pi.
- **The default suite stays offline.** `bun run test` must need no network and
  no credentials. The drift check lives under `test/` and skips itself unless
  `TOKENSWIM_DRIFT=1`; excluding it by path instead would be one stray
  `bun test` away from failing.
- **This repo is public.** Nothing here should describe Tokenswim's internal
  routing, upstream arrangements, permission model, or margins. The gateway's
  published API and pricing are fair game; how it is served is not.
- **Bun, not Node.** `bun test`, `bun run`, `Bun.serve`, `Bun.file`.

## Checks

```bash
bun run check        # typecheck + tests
bun run test:drift   # network
./ext.sh install     # loads in a real pi
```
