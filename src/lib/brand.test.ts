import { describe, expect, it } from "vitest";
import { detectImageType, validateBrandUpload } from "./brand";

const pad = (b: number[]) => Buffer.concat([Buffer.from(b), Buffer.alloc(32)]);

describe("brand upload validation", () => {
  it("detects formats by content, not name", () => {
    expect(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(Buffer.from("RIFF\0\0\0\0WEBPVP8 ........"))).toBe("image/webp");
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>   '))).toBe("image/svg+xml");
    expect(detectImageType(Buffer.from("MZ\x90\x00 this is an exe renamed to logo.png ...."))).toBeNull();
  });
  it("rejects active SVG, HTML and oversized files", () => {
    expect(validateBrandUpload(Buffer.from('<svg xmlns="x"><script>alert(1)</script></svg>')).ok).toBe(false);
    expect(validateBrandUpload(Buffer.from('<svg xmlns="x" onload="alert(1)"></svg>')).ok).toBe(false);
    expect(validateBrandUpload(Buffer.from("<html><body>hi</body></html>      ")).ok).toBe(false);
    expect(validateBrandUpload(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(3 * 1024 * 1024)])).ok).toBe(false);
    expect(validateBrandUpload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>')).ok).toBe(true);
  });
});
