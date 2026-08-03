# Key and credential rotation runbook

## Inventory

- `AUTH_SECRET`
- `FIELD_ENCRYPTION_KEY`
- `SECURITY_HASH_PEPPER`
- PostgreSQL credentials
- Redis credentials/TLS material
- S3/MinIO access keys
- provider API tokens
- production KMS key identifiers
- email provider token

## General sequence

1. Open an approved change record and identify data/services affected.
2. Create the replacement credential in the provider/KMS; never paste it into source, logs, tickets, or evidence.
3. Prefer dual-key/dual-credential overlap.
4. deploy readers that accept old and new values;
5. rotate writers to the new value;
6. re-encrypt or re-hash data where required;
7. verify application, background work, signed links, sessions, uploads, payments, and reconciliation;
8. revoke the old credential;
9. record key IDs/versions and timestamps, not secret material.

## Important current limitations

`FIELD_ENCRYPTION_KEY` and `SECURITY_HASH_PEPPER` are single-value application settings. The repository does not yet implement an online key ring, versioned ciphertext migration, or dual-pepper verification. Rotating them without a planned data migration can make encrypted beneficiary/MFA data unreadable or invalidate hashes. Treat online rotation support as a production infrastructure/application blocker; perform any interim rotation only during a controlled maintenance migration with a verified backup and rollback path.

Rotating `AUTH_SECRET` invalidates active Auth.js tokens. Plan a global sign-out and notify users.
