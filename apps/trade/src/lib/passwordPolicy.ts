/**
 * Shared password policy — single source of truth for the client registration
 * form and every server-side password route (register, change, reset).
 *
 * Deliberately light: length-only (6–128), no character-class requirements.
 * Passwords remain bcrypt-hashed (cost 12) regardless of strength. If you
 * later tighten the policy, change it HERE only.
 */

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;

/** True when the password satisfies the length policy. */
export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}
