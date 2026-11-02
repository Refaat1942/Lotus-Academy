import { describe, expect, it } from "vitest";
import { parseCsv, tempPassword } from "./users-admin";
import { passwordProblem } from "./password";

describe("user import helpers", () => {
  it("parses CSV with BOM, quotes, commas and CRLF", () => {
    expect(parseCsv('﻿email,firstName\r\n"a@x.com","Ali, Jr ""A"""\r\n\r\nb@x.com,B\n')).toEqual([["email", "firstName"], ["a@x.com", 'Ali, Jr "A"'], ["b@x.com", "B"]]);
  });
  it("generates temporary passwords that satisfy the policy and differ", () => {
    const a = tempPassword(), b = tempPassword();
    expect(passwordProblem(a)).toBeNull();
    expect(a).not.toBe(b);
  });
});
