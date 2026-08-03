const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function mutationOriginAllowed(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set<string>();
  if (process.env.APP_ORIGIN) {
    for (const value of process.env.APP_ORIGIN.split(",")) {
      try {
        const configured = value.trim();
        if (!configured) return false;
        allowed.add(new URL(configured).origin);
      } catch {
        return false;
      }
    }
  } else if (process.env.NODE_ENV !== "production") {
    allowed.add(new URL(request.url).origin);
  }
  let requestOrigin: string;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    return false;
  }
  if (!allowed.has(requestOrigin)) return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "same-site";
}
