import { Prisma } from "@prisma/client";
import {
  decryptSensitiveString,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyTotp,
} from "./crypto";

type Tx = Prisma.TransactionClient;

export type MfaFactorResult = "TOTP" | "RECOVERY_CODE" | null;

export async function verifyMfaFactor(
  tx: Tx,
  input: {
    userId: string;
    encryptedSecret: string;
    code: string;
  },
): Promise<MfaFactorResult> {
  const trimmed = input.code.trim();
  const counter = verifyTotp(decryptSensitiveString(input.encryptedSecret), trimmed);
  if (counter != null) {
    const claimed = await tx.user.updateMany({
      where: {
        id: input.userId,
        OR: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { lt: counter } }],
      },
      data: { mfaLastUsedStep: counter },
    });
    return claimed.count === 1 ? "TOTP" : null;
  }

  const normalized = normalizeRecoveryCode(trimmed);
  if (normalized.length !== 16) return null;
  const used = await tx.mfaRecoveryCode.updateMany({
    where: {
      userId: input.userId,
      codeHash: hashRecoveryCode(normalized),
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });
  return used.count === 1 ? "RECOVERY_CODE" : null;
}
