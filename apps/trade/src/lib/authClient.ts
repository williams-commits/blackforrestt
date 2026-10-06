export const INVALID_CREDENTIALS_MESSAGE =
  "The email, password, MFA code, or recovery code is incorrect.";
export const AUTH_SERVICE_MESSAGE =
  "The sign-in service is unavailable. Check the application health and try again.";

/** Accept only application-local callback paths. */
export function safeCallbackUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/trade")) {
    return "/account";
  }
  return value;
}

type SignInResultLike = {
  ok?: boolean;
  error?: string | null;
  status?: number;
  code?: string | null;
};

/**
 * Convert Auth.js client responses into non-enumerating, actionable messages.
 * Credential failures remain deliberately generic, while configuration and
 * infrastructure failures are no longer misreported as a bad password.
 */
export function signInFailureMessage(result: unknown): string | null {
  // Some Auth.js beta releases returned a URL string for successful sign-in.
  if (typeof result === "string" && result.length > 0) return null;
  if (!result || typeof result !== "object") return AUTH_SERVICE_MESSAGE;

  const value = result as SignInResultLike;
  if (value.ok === true && !value.error) return null;

  const error = value.error?.toLowerCase() ?? "";
  const code = value.code?.toLowerCase() ?? "";
  if (
    error === "credentialssignin" ||
    error === "accessdenied" ||
    code === "credentials" ||
    code === "credentialssignin"
  ) {
    return INVALID_CREDENTIALS_MESSAGE;
  }

  if ((value.status ?? 0) >= 500 || error === "configuration") {
    return AUTH_SERVICE_MESSAGE;
  }

  return error ? AUTH_SERVICE_MESSAGE : INVALID_CREDENTIALS_MESSAGE;
}
