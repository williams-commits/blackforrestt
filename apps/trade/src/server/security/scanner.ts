/**
 * Pluggable malware-scanning interface for KYC documents and payment proofs.
 *
 * `stub` is suitable only for local tests. Production uses the HTTP adapter,
 * which sends the original bytes to a private scanning service and fails closed
 * when the service is unavailable or returns an invalid response.
 */

export type ScanStatus = "CLEAN" | "BLOCKED" | "QUARANTINED";

export interface ScanResult {
  status: ScanStatus;
  reason: string;
}

export interface ScanInput {
  key: string;
  sizeBytes: number;
  sha256: string;
  bytes: Buffer;
}

export interface DocumentScanner {
  readonly name: string;
  scan(input: ScanInput): Promise<ScanResult>;
}

// EICAR standard anti-malware test string. The stub scanner remains useful for
// deterministic local and CI validation without claiming production coverage.
const EICAR_MARKER = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
const VALID_STATUSES = new Set<ScanStatus>(["CLEAN", "BLOCKED", "QUARANTINED"]);

function scannerTimeoutMs(): number {
  const configured = Number(process.env.MALWARE_SCANNER_TIMEOUT_MS ?? 30_000);
  return Number.isFinite(configured) && configured >= 1_000
    ? Math.min(120_000, Math.floor(configured))
    : 30_000;
}

export class StubScanner implements DocumentScanner {
  readonly name = "stub";

  async scan(input: ScanInput): Promise<ScanResult> {
    if (input.bytes.includes(Buffer.from(EICAR_MARKER, "latin1"))) {
      return { status: "BLOCKED", reason: "EICAR test signature matched (stub scanner)." };
    }
    return { status: "CLEAN", reason: "No signatures matched (stub scanner)." };
  }
}

/**
 * Adapter contract:
 *   POST MALWARE_SCANNER_URL
 *   body: original file bytes (`application/octet-stream`)
 *   response: `{ "status": "CLEAN|BLOCKED|QUARANTINED", "reason": "..." }`
 *
 * A Bearer token is sent when MALWARE_SCANNER_TOKEN is configured. This keeps
 * the application independent from a specific ClamAV gateway or hosted scanner.
 */
export class HttpScanner implements DocumentScanner {
  readonly name = "http";

  async scan(input: ScanInput): Promise<ScanResult> {
    const endpoint = process.env.MALWARE_SCANNER_URL?.trim();
    if (!endpoint) throw new Error("MALWARE_SCANNER_URL is required for KYC_SCANNER=http.");
    const token = process.env.MALWARE_SCANNER_TOKEN?.trim();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Object-Key": input.key,
        "X-Content-SHA256": input.sha256,
        "X-Content-Length": String(input.sizeBytes),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: new Uint8Array(input.bytes),
      signal: AbortSignal.timeout(scannerTimeoutMs()),
    });
    const payload = await response.json().catch(() => null) as { status?: unknown; reason?: unknown } | null;
    if (!response.ok) {
      throw new Error(`Malware scanner rejected the request with status ${response.status}.`);
    }
    if (!payload || typeof payload.status !== "string" || !VALID_STATUSES.has(payload.status as ScanStatus)) {
      throw new Error("Malware scanner returned an invalid status response.");
    }
    const reason = typeof payload.reason === "string" && payload.reason.trim()
      ? payload.reason.trim().slice(0, 1_000)
      : "Scanner completed without a reason.";
    return { status: payload.status as ScanStatus, reason };
  }
}

export function getScanner(): DocumentScanner {
  const configured = (process.env.KYC_SCANNER ?? "stub").trim().toLowerCase();
  if (configured === "stub") return new StubScanner();
  if (configured === "http") return new HttpScanner();
  if (configured === "clamav") {
    throw new Error("KYC_SCANNER=clamav is not a direct protocol. Configure a ClamAV HTTP gateway and use KYC_SCANNER=http.");
  }
  throw new Error(`Unknown KYC_SCANNER: ${configured}`);
}
