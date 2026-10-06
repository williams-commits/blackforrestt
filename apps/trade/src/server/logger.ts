/**
 * Minimal structured JSON-lines logger — one line per event on stdout, ready
 * for Docker/Caddy log shipping (the prod compose already configures JSON
 * logs). Deliberately dependency-free: the npm 10/11 lock-file dance makes
 * adding pino riskier than the ~40 lines it replaces.
 *
 * Usage:
 *   log.info("payment approved", { requestId, userId, paymentId });
 *   log.error("dispatcher failed", { error: err.message });
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function configuredLevel(): number {
  const raw = (process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug")).toLowerCase();
  return LEVEL_WEIGHT[raw as Level] ?? LEVEL_WEIGHT.info;
}

function emit(level: Level, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_WEIGHT[level] < configuredLevel()) return;
  const entry: Record<string, unknown> = {
    t: new Date().toISOString(),
    level,
    msg: message,
  };
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      if (value === undefined) continue;
      entry[key] = value instanceof Error ? { name: value.name, message: value.message } : value;
    }
  }
  try {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  } catch {
    // A logging failure must never take down the request path.
  }
}

export const log = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};

/** Read the correlation id the middleware injected into the request. */
export function requestIdOf(request: Request): string | null {
  const value = request.headers.get("x-request-id");
  return value && value.length >= 8 && value.length <= 128 ? value : null;
}
