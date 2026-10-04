import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({ gfm: true, breaks: false });

/** Renders Markdown to sanitized HTML. Raw HTML in the source is stripped by the allow-list. */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(html, {
    allowedTags: ["h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "blockquote", "code", "pre", "hr", "br", "a", "table", "thead", "tbody", "tr", "th", "td", "del"],
    allowedAttributes: { a: ["href", "title", "rel", "target"], th: ["align"], td: ["align"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      h1: "h2",
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
    },
    allowedSchemesAppliedToAttributes: ["href"],
  });
}
