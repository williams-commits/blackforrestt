# Incident response runbook

## Scope

Use this runbook for security, financial-integrity, authentication, KYC/document, payment, market-data, execution, reconciliation, availability, or data-loss incidents. The application remains simulation-only; any incident involving real customer funds requires the licensed entity's approved regulatory process in addition to this document.

## Severity

- **SEV-1:** suspected compromise, data disclosure, ledger imbalance, duplicate settlement, unauthorized financial action, unrecoverable database failure, or widespread outage.
- **SEV-2:** degraded critical dependency, reconciliation blocks affecting multiple accounts, persistent login/MFA failure, or material performance regression.
- **SEV-3:** isolated workflow failure with a safe workaround and no integrity/security impact.

## First 15 minutes

1. Open an incident record with UTC start time, reporter, scope, and current severity.
2. Preserve evidence. Do not delete logs, audit rows, reconciliation cases, database snapshots, provider responses, or affected objects.
3. For any integrity ambiguity, stop new exposure and withdrawals at the gateway/application level. Do not "retry" an unknown financial command as a new command.
4. Identify the incident commander, operations lead, application lead, security lead, and communications owner.
5. Record the deployed source SHA-256, container digests, schema migration list, and active configuration versions without copying secret values.

## Containment

- Revoke affected sessions and credentials.
- Disable the affected provider or switch to the explicitly labelled simulation/degraded mode only when policy permits.
- Keep reconciliation blocks active until independently resolved.
- Isolate compromised hosts or object-storage credentials.
- If audit-chain integrity is uncertain, preserve a read-only database copy before further writes.

## Diagnosis

Collect:

- `/api/health` and service/container health;
- PostgreSQL connection, replication, storage, and migration state;
- Redis connectivity, memory, persistence, and lease ownership;
- MinIO/S3 availability and object audit events;
- application and reverse-proxy logs with request IDs;
- audit-chain verification results;
- reconciliation runs/cases/blocks;
- provider request IDs, settlement references, and timestamps;
- load, latency, disconnect, and error metrics.

## Recovery

1. Apply the smallest reversible change.
2. Restore dependencies before re-enabling financial mutations.
3. Run `npm run phase8:verify:integration` against the recovered environment.
4. Run reconciliation and review every critical case.
5. Verify login, MFA, KYC access, payments, account projections, and terminal connectivity.
6. Re-enable withdrawals and new exposure separately, with explicit approval and monitoring.

## Closure

Closure requires a timeline, root cause, affected records/users, evidence references, containment/recovery actions, data-integrity assessment, customer/regulatory communication decision, corrective actions with owners/dates, and a test proving the failure cannot silently recur.
