import { describe, expect, it } from "vitest";

import { generateSlug } from "@/lib/slug";

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
