-- Beneficiary cooling-off check scans PaymentRequest by fingerprint on every
-- withdrawal request; without this index it degrades to a sequential scan as
-- payment history grows.
CREATE INDEX "PaymentRequest_beneficiaryFingerprint_idx" ON "PaymentRequest"("beneficiaryFingerprint");
