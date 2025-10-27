import { describe, expect, it } from "vitest";

import { generateSlug, isNormalizedSlug, toPinyinSlug } from "@/lib/slug";

describe("generateSlug", () => {
  it("converts Chinese characters to pinyin", () => {
    expect(generateSlug("第一篇文章")).toBe("di-yi-pian-wen-zhang");
  });

  it("keeps latin words readable", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
  });

  it("mixes latin and Chinese characters", () => {
    expect(generateSlug("Hello 世界")).toBe("hello-shi-jie");
  });

  it("removes diacritics", () => {
    expect(generateSlug("Café à la crème")).toBe("cafe-a-la-creme");
  });

  it("generates a fallback slug when input is empty", () => {
    expect(generateSlug("")).toMatch(/^post-[a-z0-9]{6}$/);
  });
});

describe("toPinyinSlug", () => {
  it("normalizes mixed input to a slug", () => {
    expect(toPinyinSlug("Hello 世界")).toBe("hello-shi-jie");
  });

  it("returns empty string for blank input", () => {
    expect(toPinyinSlug("   ")).toBe("");
  });
});

describe("isNormalizedSlug", () => {
  it("returns true for lowercase latin slugs", () => {
    expect(isNormalizedSlug("hello-world-123")).toBe(true);
  });

  it("returns false for slugs with uppercase characters", () => {
    expect(isNormalizedSlug("Hello-World")).toBe(false);
  });

  it("returns false for non-latin characters", () => {
    expect(isNormalizedSlug("第一篇文章")).toBe(false);
  });

  it("returns false for slugs with extra separators", () => {
    expect(isNormalizedSlug("hello--world")).toBe(false);
  });
});
