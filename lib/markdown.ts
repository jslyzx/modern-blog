import katex from "katex";
import sanitizeHtml, { AllowedAttribute } from "sanitize-html";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import rehypePrettyCode from "rehype-pretty-code";

const CODE_BLOCK_PLACEHOLDER = "@@CODE_BLOCK_";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const convertInline = (input: string): string => {
  let html = escapeHtml(input);

  html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" loading="lazy" />');
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
  html = html.replace(/\n/g, "<br />");

  return html;
};

const wrapList = (block: string, ordered: boolean): string => {
  const items = block
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const content = line.replace(ordered ? /^\d+\.\s+/ : /^[-*+]\s+/, "");
      return `<li>${convertInline(content)}</li>`;
    })
    .join("");

  const tag = ordered ? "ol" : "ul";

  return `<${tag}>${items}</${tag}>`;
};

const convertBlock = (block: string): string => {
  if (!block) {
    return "";
  }

  if (/^#{1,6}\s/.test(block)) {
    const [, hashes, content] = block.match(/^(#{1,6})\s+(.*)$/) ?? [];

    if (hashes && content) {
      const level = hashes.length;
      return `<h${level}>${convertInline(content.trim())}</h${level}>`;
    }
  }

  if (/^[-*+]\s/m.test(block)) {
    return wrapList(block, false);
  }

  if (/^\d+\.\s/m.test(block)) {
    return wrapList(block, true);
  }

  if (/^>\s?/.test(block)) {
    const lines = block
      .split(/\n/)
      .map((line) => line.replace(/^>\s?/, ""))
      .map((line) => line.trim())
      .filter(Boolean);

    const content = lines.map((line) => `<p>${convertInline(line)}</p>`).join("");

    return `<blockquote>${content}</blockquote>`;
  }

  return `<p>${convertInline(block)}</p>`;
};

export const markdownToHtml = (markdown: string): string => {
  if (!markdown?.trim()) {
    return "";
  }

  const codeBlocks: string[] = [];

  const working = markdown.replace(/```([\s\S]*?)```/g, (_match, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(String(code).trim())}</code></pre>`);
    return `${CODE_BLOCK_PLACEHOLDER}${index}@@`;
  });

  const blocks = working
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  let html = blocks.map(convertBlock).join("");

  codeBlocks.forEach((code, index) => {
    html = html.replaceAll(`${CODE_BLOCK_PLACEHOLDER}${index}@@`, code);
  });

  return html;
};

export const htmlToPlainText = (html: string): string => {
  if (!html?.trim()) {
    return "";
  }

  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
};

export const markdownToPlainText = (markdown: string): string => {
  if (!markdown?.trim()) {
    return "";
  }

  return htmlToPlainText(markdownToHtml(markdown));
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

const MATHML_TAGS = [
  "math",
  "annotation",
  "semantics",
  "mrow",
  "mi",
  "mo",
  "mn",
  "msup",
  "mfrac",
  "mtext",
  "mspace",
  "msub",
  "msubsup",
  "msqrt",
  "mroot",
  "mtable",
  "mtr",
  "mtd",
  "mstyle",
  "mphantom",
  "mpadded",
  "menclose",
  "mover",
  "munder",
  "munderover",
  "mlabeledtr",
  "mglyph",
  "merror",
];

const EXTRA_ALLOWED_TAGS = [
  "span",
  "div",
  "pre",
  "code",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "hr",
  "sup",
  "sub",
];

const ALLOWED_TAGS = Array.from(new Set([...sanitizeHtml.defaults.allowedTags, ...EXTRA_ALLOWED_TAGS, ...MATHML_TAGS]));

const allowedAttributes: sanitizeHtml.IOptions["allowedAttributes"] = {
  ...sanitizeHtml.defaults.allowedAttributes,
};

const extendAllowedAttributes = (tag: string, attributes: Array<string | RegExp>) => {
  const existing = allowedAttributes[tag] ?? [];
  allowedAttributes[tag] = Array.from(new Set([...existing, ...attributes])) as AllowedAttribute[];
};

extendAllowedAttributes("*", ["class", "aria-hidden", "aria-label", "role", "data-*", "lang"]);
extendAllowedAttributes("a", ["href", "name", "target", "rel", "title", "class"]);
extendAllowedAttributes("img", ["src", "alt", "title", "width", "height", "loading", "decoding", "srcset", "sizes", "class"]);
extendAllowedAttributes("code", ["class"]);
extendAllowedAttributes("pre", ["class"]);
extendAllowedAttributes("span", ["class", "style", "role", "aria-hidden", "aria-label", "data-*"]);
extendAllowedAttributes("div", ["class", "style", "role", "aria-hidden", "aria-label", "data-*"]);
extendAllowedAttributes("table", ["class"]);
extendAllowedAttributes("thead", ["class"]);
extendAllowedAttributes("tbody", ["class"]);
extendAllowedAttributes("tfoot", ["class"]);
extendAllowedAttributes("tr", ["class"]);
extendAllowedAttributes("th", ["class", "colspan", "rowspan", "scope", "align"]);
extendAllowedAttributes("td", ["class", "colspan", "rowspan", "align"]);
extendAllowedAttributes("figure", ["class"]);
extendAllowedAttributes("figcaption", ["class"]);
extendAllowedAttributes("math", ["xmlns", "display", "class"]);
extendAllowedAttributes("annotation", ["encoding", "class"]);
extendAllowedAttributes("semantics", ["class"]);
extendAllowedAttributes("mrow", ["class"]);
extendAllowedAttributes("mi", ["class"]);
extendAllowedAttributes("mo", ["class"]);
extendAllowedAttributes("mn", ["class"]);
extendAllowedAttributes("msup", ["class"]);
extendAllowedAttributes("mfrac", ["class"]);
extendAllowedAttributes("mtext", ["class"]);
extendAllowedAttributes("mspace", ["class", "width", "height", "depth"]);
extendAllowedAttributes("msub", ["class"]);
extendAllowedAttributes("msubsup", ["class"]);
extendAllowedAttributes("msqrt", ["class"]);
extendAllowedAttributes("mroot", ["class"]);
extendAllowedAttributes("mstyle", ["class", "scriptlevel", "displaystyle", "mathcolor", "mathbackground"]);
extendAllowedAttributes("mpadded", ["class", "height", "depth", "width", "lspace", "voffset"]);
extendAllowedAttributes("menclose", ["class", "notation"]);
extendAllowedAttributes("mover", ["class"]);
extendAllowedAttributes("munder", ["class"]);
extendAllowedAttributes("munderover", ["class"]);
extendAllowedAttributes("mlabeledtr", ["class"]);
extendAllowedAttributes("mglyph", ["class", "alt"]);
extendAllowedAttributes("merror", ["class"]);

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes,
  allowedSchemes: ["http", "https", "mailto", "tel", "data"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
  },
  allowProtocolRelative: true,
};

const BLOCK_MATH_PATTERN = /\$\$([\s\S]+?)\$\$/g;
const INLINE_MATH_PATTERN = /(?<!\\)\$(?!\$)([^$\n]+?)(?<!\\)\$(?!\$)/g;
const CODE_ELEMENT_PATTERN = /(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>)/gi;

const createMarkdownProcessor = () =>
  unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypePrettyCode, {
      theme: "github-dark",
      keepBackground: false,
    })
    .use(rehypeStringify, { allowDangerousHtml: true });

const createHtmlProcessor = () =>
  unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeKatex)
    .use(rehypePrettyCode, {
      theme: "github-dark",
      keepBackground: false,
    })
    .use(rehypeStringify);

const createKatexHtml = (expression: string, displayMode: boolean): string => {
  const trimmed = expression.trim();

  if (!trimmed) {
    return "";
  }

  try {
    return katex.renderToString(trimmed, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
    });
  } catch {
    const safe = escapeHtml(trimmed);
    return displayMode ? `<div class="katex-error">${safe}</div>` : `<span class="katex-error">${safe}</span>`;
  }
};

const replaceMathInSegment = (segment: string): string => {
  if (!segment || segment.indexOf("$") === -1) {
    return segment;
  }

  const withBlockMath = segment.replace(BLOCK_MATH_PATTERN, (_match, expression) =>
    createKatexHtml(String(expression ?? ""), true),
  );

  return withBlockMath.replace(INLINE_MATH_PATTERN, (_match, expression) =>
    createKatexHtml(String(expression ?? ""), false),
  );
};

const renderMathInHtml = (html: string): string => {
  if (!html || html.indexOf("$") === -1) {
    return html;
  }

  CODE_ELEMENT_PATTERN.lastIndex = 0;

  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CODE_ELEMENT_PATTERN.exec(html)) !== null) {
    const preceding = html.slice(lastIndex, match.index);

    if (preceding) {
      result += replaceMathInSegment(preceding);
    }

    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex === 0) {
    return replaceMathInSegment(html);
  }

  if (lastIndex < html.length) {
    result += replaceMathInSegment(html.slice(lastIndex));
  }

  return result;
};

const sanitizeAndTrim = (html: string): string => {
  const sanitized = sanitizeHtml(html, SANITIZE_OPTIONS);
  return sanitized.trim();
};

export interface RenderPostHtmlInput {
  contentMd?: string | null;
  contentHtml?: string | null;
}

export const renderPostContent = async (content: string): Promise<string> => {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return "";
  }

  try {
    const processor = createMarkdownProcessor();
    const file = await processor.process(content);
    return sanitizeAndTrim(String(file));
  } catch {
    try {
      const processor = createHtmlProcessor();
      const file = await processor.process(content);
      return sanitizeAndTrim(String(file));
    } catch {
      const fallbackSource = trimmedContent.includes("<")
        ? content
        : markdownToHtml(trimmedContent);
      const withKatex = renderMathInHtml(fallbackSource);
      return sanitizeAndTrim(withKatex);
    }
  }
};

export const renderPostHtml = async ({ contentMd, contentHtml }: RenderPostHtmlInput): Promise<string> => {
  const markdownSource = contentMd?.trim();

  if (markdownSource) {
    return renderPostContent(markdownSource);
  }

  const htmlSource = contentHtml?.trim();

  if (htmlSource) {
    return renderPostContent(htmlSource);
  }

  return "";
};
