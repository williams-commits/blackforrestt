# Provider outage and degraded-mode runbook

## PostgreSQL

Fail readiness, stop financial mutations, preserve application logs, and restore service or fail over through the approved database platform. Do not accept writes into an alternate local store.

## Redis

Production authentication throttling, scheduler leadership, and distributed controls fail closed. Do not substitute process-local throttling or leases in production. Restore Redis, verify lease ownership, and run reconciliation before resuming scheduled work.

## S3/MinIO/KMS/scanner

Stop KYC/payment-proof finalization and compliance downloads. Do not mark unscanned or unverifiable objects as accepted. Preserve pending object metadata and resume through the idempotent finalize/scan workflow after recovery.

## Email

Queue or report verification/reset notifications as unavailable. Never claim delivery. Password-reset and verification tokens must retain expiry and single-use semantics.

## Market-data or execution provider

- mark quotes stale and visibly identify the unavailable source;
- stop new exposure when executable/authoritative pricing is unavailable;
- do not synthesize a live quote or claim a simulated fill as provider execution;
- classify timeout/unknown submit outcomes as ambiguous and send them to reconciliation;
- never retry an ambiguous order as a new order;
- reconcile provider orders, fills, fees, swaps, positions, and statements before resuming.

The current repository has no licensed execution adapter, so production provider failover and ambiguity handling remain unverified external/local blockers.

## Recovery exit

Provider health alone is insufficient. Verify request IDs, missed events, duplicate prevention, object/document state, ledger projections, reconciliation cases/blocks, and user-visible source/freshness indicators before clearing degraded mode.
