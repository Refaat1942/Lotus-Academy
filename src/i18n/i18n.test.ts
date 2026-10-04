import { describe, expect, it } from "vitest";
import { en } from "./en";
import { ar } from "./ar";

describe("i18n", () => {
  it("Arabic covers every English key and no extras", () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });
  it("has no empty strings", () => {
    for (const d of [en, ar]) for (const [k, v] of Object.entries(d)) expect(v.trim(), k).not.toBe("");
  });
});
