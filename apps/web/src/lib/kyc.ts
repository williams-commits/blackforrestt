export const IDENTITY_DOCUMENT_TYPES = [
  { value: "PASSPORT", label: "Passport" },
  { value: "ID_CARD", label: "National identity card" },
  { value: "DRIVING_LICENSE", label: "Driving licence" },
] as const;

export const ADDRESS_DOCUMENT_TYPES = [
  { value: "PROOF_OF_ADDRESS", label: "Proof of address" },
  { value: "UTILITY_BILL", label: "Utility bill" },
  { value: "BANK_STATEMENT", label: "Bank statement" },
  { value: "GOVERNMENT_LETTER", label: "Government or tax letter" },
  { value: "TENANCY_AGREEMENT", label: "Tenancy or lease agreement" },
] as const;

export const KYC_DOCUMENT_TYPES = [
  ...IDENTITY_DOCUMENT_TYPES,
  ...ADDRESS_DOCUMENT_TYPES,
] as const;

export const KYC_DOCUMENT_TYPE_VALUES = [
  "PASSPORT",
  "ID_CARD",
  "DRIVING_LICENSE",
  "PROOF_OF_ADDRESS",
  "UTILITY_BILL",
  "BANK_STATEMENT",
  "GOVERNMENT_LETTER",
  "TENANCY_AGREEMENT",
] as const;

export type KycDocumentType = (typeof KYC_DOCUMENT_TYPE_VALUES)[number];

const IDENTITY_VALUES = new Set<string>(IDENTITY_DOCUMENT_TYPES.map((item) => item.value));
const ADDRESS_VALUES = new Set<string>(ADDRESS_DOCUMENT_TYPES.map((item) => item.value));

export function isIdentityDocumentType(value: string): boolean {
  return IDENTITY_VALUES.has(value);
}

export function isAddressDocumentType(value: string): boolean {
  return ADDRESS_VALUES.has(value);
}

export function kycDocumentLabel(value: string): string {
  return KYC_DOCUMENT_TYPES.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ");
}
