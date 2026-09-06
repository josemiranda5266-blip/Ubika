# UBIKA — Phase 1 perimeter execution marker

The repository now contains a one-time GitHub Actions patch that activates only on a commit containing `[phase1-perimeter]`.

Scope of the patch:
- disable blind `trust proxy = 1`; use `TRUST_PROXY_HOPS` explicitly;
- replace wildcard CORS with an allowlist from `CORS_ALLOWED_ORIGINS`;
- harden CSP by removing `unsafe-eval`, wildcard frame ancestors, plaintext HTTP and broad data/blob allowances.

The workflow intentionally performs no tests, lint, typecheck or build. Final verification remains deferred until all phases are complete.
