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
