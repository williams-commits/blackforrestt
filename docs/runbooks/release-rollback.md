# Release rollback runbook

## Preconditions

- Every release has a source SHA-256, immutable container digest, migration list, configuration version, and successful Phase 8 evidence bundle.
- A verified PostgreSQL backup exists before deployment.
- The prior application image remains available.
- Schema compatibility between current and prior application versions is documented.

## Trigger conditions

Rollback on failed health/readiness, material error-rate or latency regression, authentication/session failure, ledger/reconciliation divergence, provider ambiguity, migration failure, or any security control regression.

## Application-only rollback

1. Stop rollout and prevent additional replicas from starting.
2. Keep financial mutations disabled when integrity is uncertain.
3. Re-deploy the prior immutable application image.
4. Do not reverse posted ledger or audit records. Corrections use compensating records.
5. Run health, login, account, reconciliation, and Phase 8 integration checks.
6. Re-enable traffic gradually and monitor.

## Schema rollback

Prisma migrations are forward migrations and this repository does not provide destructive automatic down migrations. For an incompatible schema change:

1. stop writes;
2. preserve a post-failure snapshot;
3. restore the pre-release backup into an isolated database;
4. verify migration, table, user, ledger, audit, and reconciliation counts;
5. point the prior application version at the restored database only after approval;
6. retain the failed database for investigation.

Never edit `_prisma_migrations` manually to make a failed release look successful.

## Exit criteria

- prior release health is stable;
- database and audit integrity are verified;
- reconciliation has no unexplained critical case;
- rollback decision and evidence are attached to the incident/release record;
- a corrected release must pass the complete matrix again.
