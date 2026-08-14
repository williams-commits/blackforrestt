const DEVICE_STORAGE_KEY = "blckforest-device-id";

export type DeviceCrypto = Pick<Crypto, "getRandomValues"> & {
  randomUUID?: () => string;
};

/** Create an RFC 4122 version-4 identifier without requiring randomUUID(). */
export function createDeviceId(cryptoApi: DeviceCrypto | undefined = globalThis.crypto): string {
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
      .slice(6, 8)
      .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }

  // This is a device-correlation identifier, not an authentication secret.
  // Keep login usable in old/insecure browser contexts while production still
  // requires HTTPS for secure Auth.js cookies.
  return `legacy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

// ─── User-agent parsing ─────────────────────────────────────────────────────

export interface ParsedUA {
  browser: string;
  os: string;
  deviceType: "Desktop" | "Mobile" | "Tablet";
}

/**
 * Lightweight user-agent parser — no external dependency.
 * Works on both client and server (pass the UA string explicitly).
 */
export function parseUserAgent(ua?: string | null): ParsedUA {
  if (!ua) return { browser: "Unknown", os: "Unknown", deviceType: "Desktop" };

  // Browser — order matters (Edge and Opera disguise as Chrome).
  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) browser = "Opera";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Chromium\//.test(ua)) browser = "Chromium";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";

  // Operating system.
  let os = "Unknown";
  if (/Windows NT 10/.test(ua)) os = "Windows";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Linux/.test(ua)) os = "Linux";

  // Device type.
  let deviceType: ParsedUA["deviceType"] = "Desktop";
  if (/iPhone|Android.*Mobile|Windows Phone|Mobile/.test(ua)) deviceType = "Mobile";
  else if (/iPad|Tablet|Android(?!.*Mobile)/.test(ua)) deviceType = "Tablet";

  return { browser, os, deviceType };
}

/** Human-readable label, e.g. "Chrome · macOS" or "Safari · iOS". */
export function formatDeviceLabel(parsed: ParsedUA): string {
  if (parsed.browser === "Unknown" && parsed.os === "Unknown") return "Web browser";
  if (parsed.os === "Unknown") return parsed.browser;
  if (parsed.browser === "Unknown") return parsed.os;
  return `${parsed.browser} · ${parsed.os}`;
}

// ─── Browser-side device identity ───────────────────────────────────────────

export function browserDeviceIdentity(): { deviceId: string; deviceName: string } {
  let deviceId: string | null = null;
  try {
    deviceId = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  } catch {
    deviceId = null;
  }
  if (!deviceId || deviceId.length < 8) {
    deviceId = createDeviceId(window.crypto);
    try {
      window.localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
    } catch {
      // Ephemeral identity is still safe; it simply appears as a new session.
    }
  }

  // Use parsed UA for a rich device name; fall back to platform string.
  const parsed = parseUserAgent(navigator.userAgent);
  const deviceName = formatDeviceLabel(parsed) !== "Web browser"
    ? formatDeviceLabel(parsed)
    : navigator.platform?.trim()
      ? `${navigator.platform.trim()} browser`
      : "Web browser";

  return { deviceId, deviceName };
}
