import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_SERVICE_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  safeCallbackUrl,
  signInFailureMessage,
} from "../src/lib/authClient.js";
import { createDeviceId, type DeviceCrypto } from "../src/lib/device.js";

test("safe callback URLs remain application-local", () => {
  assert.equal(safeCallbackUrl("/account?tab=security"), "/account?tab=security");
  assert.equal(safeCallbackUrl("/trade/BTCUSD?tf=5m"), "/account");
  assert.equal(safeCallbackUrl("https://attacker.example"), "/account");
  assert.equal(safeCallbackUrl("//attacker.example"), "/account");
  assert.equal(safeCallbackUrl(null), "/account");
});

test("credential errors stay generic while infrastructure errors are actionable", () => {
  assert.equal(signInFailureMessage({ ok: true, error: null }), null);
  assert.equal(signInFailureMessage("/account"), null);
  assert.equal(
    signInFailureMessage({ ok: false, error: "CredentialsSignin", code: "credentials", status: 401 }),
    INVALID_CREDENTIALS_MESSAGE,
  );
  assert.equal(
    signInFailureMessage({ ok: false, error: "Configuration", status: 500 }),
    AUTH_SERVICE_MESSAGE,
  );
  assert.equal(signInFailureMessage(undefined), AUTH_SERVICE_MESSAGE);
});

test("device IDs do not require crypto.randomUUID", () => {
  const deterministicCrypto = {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      if (array && ArrayBuffer.isView(array)) {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        bytes.forEach((_, index) => { bytes[index] = index; });
      }
      return array;
    },
  } as DeviceCrypto;
  const id = createDeviceId(deterministicCrypto);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
