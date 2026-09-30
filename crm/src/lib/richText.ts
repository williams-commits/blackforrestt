/**
 * Shared rich-text plumbing for the contenteditable editors (email, notes,
 * comments). The client allowlist here mirrors the server-side filter in
 * src/server/emailHtml.ts, so what the author sees is what gets stored.
 */

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Strict allowlist filter — mirrors the server's sanitizeEmailHtml. */
export function sanitizeRichText(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = html;
  root.querySelectorAll("script,style,iframe,object,embed,noscript,template,svg,math").forEach((el) => el.remove());
  const walk = (node: Element): void => {
    Array.from(node.children).forEach((child) => {
      walk(child);
      const tag = child.tagName.toUpperCase();
      const allowed = ["P", "BR", "DIV", "SPAN", "BLOCKQUOTE", "PRE", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "UL", "OL", "LI", "H1", "H2", "H3", "A", "FONT"];
      if (!allowed.includes(tag)) {
        const frag = document.createDocumentFragment();
        while (child.firstChild) frag.appendChild(child.firstChild);
        child.replaceWith(frag);
        return;
      }
      if (tag === "A") {
        const href = child.getAttribute("href") ?? "";
        if (!/^(https?:\/\/|mailto:)/i.test(href)) child.removeAttribute("href");
        else {
          child.setAttribute("rel", "noopener noreferrer");
          child.setAttribute("target", "_blank");
        }
      }
      Array.from(child.attributes).forEach((attr) => {
        if (tag === "A" && attr.name === "href") return;
        child.removeAttribute(attr.name);
      });
    });
  };
  walk(root);
  return root.innerHTML;
}

/** Bodies written before the editors stored HTML — their newlines must survive. */
export function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(text);
}

/** Safe HTML for rendering a stored note/comment body — sanitizes rich content, preserves legacy plain text. */
export function renderRichText(body: string): string {
  if (!looksLikeHtml(body)) return escapeHtml(body).replaceAll("\n", "<br>");
  return sanitizeRichText(body);
}
