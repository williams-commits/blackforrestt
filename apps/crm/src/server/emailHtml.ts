/**
 * Server-side hygiene filter for composed rich-text email bodies.
 *
 * The editor is staff-only, but email is an outbound channel: the stored
 * HTML part must never carry scripts, event handlers, or external resource
 * loads. This is a strict tag allowlist — everything not explicitly allowed
 * is unwrapped (children kept), script/style-class content is dropped with
 * its content, and anchors keep only http(s)/mailto hrefs.
 */

const DROP_WITH_CONTENT = /<\s*(script|style|iframe|object|embed|noscript|template|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DROP_SELF_CLOSING = /<\s*(script|style|iframe|object|embed|noscript|template|svg|math)\b[^>]*\/?\s*>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;

const ALLOWED_TAGS = new Set([
  "P", "BR", "DIV", "SPAN", "BLOCKQUOTE", "PRE",
  "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "UL", "OL", "LI",
  "H1", "H2", "H3",
  "A",
]);

const TAG_WITH_ATTRS = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\s*\/?)>/g;

export function sanitizeEmailHtml(input: string): string {
  if (!input) return "";
  let html = input.slice(0, 500_000);

  html = html.replace(DROP_WITH_CONTENT, "");
  html = html.replace(DROP_SELF_CLOSING, "");
  html = html.replace(COMMENTS, "");
  // Normalize self-closing <br/> so the closing-slash isn't mistaken for a
  // close tag below.
  html = html.replace(/<\s*br\s*\/?\s*>/gi, "<br>");

  html = html.replace(TAG_WITH_ATTRS, (_match, close: string, rawName: string, attrs: string) => {
    const name = rawName.toUpperCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    // Preserve the author's tag case — HTML is case-insensitive and this
    // keeps the stored part readable.
    const tag = rawName;
    if (close) return `</${tag}>`;
    if (name === "A") {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s">]+))/i.exec(attrs);
      const value = (href?.[2] ?? href?.[3] ?? href?.[4] ?? "").trim();
      const safe = /^(https?:\/\/|mailto:)/i.test(value) ? value : "";
      return safe
        ? `<a href="${safe.replaceAll('"', "&quot;")}" rel="noopener noreferrer" target="_blank">`
        : "<a>";
    }
    return `<${tag}>`;
  });

  return html;
}

/** Best-effort plain-text extraction from composed HTML (for the text part). */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-3]|blockquote|pre)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
