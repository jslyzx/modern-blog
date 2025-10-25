import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";

export const renderMarkdownWithKatex = async (markdown: string): Promise<string> => {
  if (!markdown?.trim()) {
    return "";
  }

  const result = await unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .process(markdown);

  return String(result);
};

export const markdownToPlainText = (markdown: string): string => {
  if (!markdown?.trim()) {
    return "";
  }

  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[(.+?)\]\((.+?)\)/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\$\$[\s\S]*?\$\$/g, "[math]")
    .replace(/\$([^\$]+)\$/g, "[math]")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const truncateWords = (input: string, limit: number): string => {
  if (!input) {
    return "";
  }

  const words = input.trim().split(/\s+/);

  if (words.length <= limit) {
    return input.trim();
  }

  return `${words.slice(0, limit).join(" ")}…`;
};
