import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("markdown sanitization", () => {
  it("renders tables, lists and emphasis", () => {
    const h = renderMarkdown("## T\n\n| a | b |\n|---|---|\n| 1 | **2** |\n\n- x\n");
    expect(h).toContain("<table>");
    expect(h).toContain("<strong>2</strong>");
    expect(h).toContain("<li>x</li>");
  });
  it("strips scripts, event handlers and javascript: URLs", () => {
    const h = renderMarkdown('<script>alert(1)</script><img src=x onerror=alert(1)>[c](javascript:alert(1)) <iframe src="//evil"></iframe> <a href="https://ok.com" onclick="x()">ok</a>');
    expect(h).not.toMatch(/<script|onerror|onclick|<iframe|<img|href="javascript/i);
    expect(renderMarkdown("[c](javascript:alert(1))")).not.toMatch(/href="javascript/i);
    expect(h).toContain('href="https://ok.com"');
    expect(h).toContain('rel="noopener noreferrer nofollow"');
  });
});
