# Phase 3 persistence patch trigger

One-time patch execution marker. The workflow applies the persistence writer lock and fsync hardening to `server/db.ts`, then removes itself. Verification is intentionally deferred until the final phase.
