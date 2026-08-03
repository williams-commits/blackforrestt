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
  const platform = navigator.platform?.trim();
  return {
    deviceId,
    deviceName: platform ? `${platform} browser` : "Web browser",
  };
}
