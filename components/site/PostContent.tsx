import Image, { type ImageProps } from "next/image";
import { createElement, Fragment, type CSSProperties, type ReactNode } from "react";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import type { Element, Properties, Root, Text } from "hast";
import { BlockMath, InlineMath } from "react-katex";

import { loadImageMetadata } from "@/lib/image-metadata";

import { CodeCopyButton } from "./CodeCopyButton";

const processor = unified().use(rehypeParse, { fragment: true });

type HastNode = Root["children"][number];

const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_HEIGHT = 675;

type RenderContext = {
  insideCode: boolean;
};

const MATH_EXPRESSION_PATTERN =
  /(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$|(?<!\\)\$(?!\$)([^$\n]+?)(?<!\\)\$(?!\$)/g;

const isElementNode = (node: HastNode): node is Element => node.type === "element";
const isTextNode = (node: HastNode): node is Text => node.type === "text";

const ensureString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" ? ensureString(first) : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
};

const ensureNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const stringValue = ensureString(value);

  if (!stringValue) {
    return null;
  }

  const parsed = Number.parseFloat(stringValue);

  return Number.isFinite(parsed) ? parsed : null;
};

const parseStyleString = (input: string): CSSProperties => {
  const style: CSSProperties = {};

  input
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((declaration) => {
      const [rawProperty, rawValue] = declaration.split(":");

      if (!rawProperty || !rawValue) {
        return;
      }

      const property = rawProperty
        .trim()
        .replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
      const value = rawValue.trim();

      if (!property || !value) {
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      (style as Record<string, unknown>)[property] = value;
    });

  return style;
};

const convertProperties = (properties: Properties = {}): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(properties)) {
    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    if (key === "class" || key === "className") {
      const className = ensureString(rawValue);

      if (className) {
        result.className = className;
      }

      continue;
    }

    if (key === "style") {
      if (typeof rawValue === "string") {
        result.style = parseStyleString(rawValue);
      } else if (typeof rawValue === "object" && rawValue) {
        result.style = rawValue;
      }

      continue;
    }

    if (key === "for") {
      result.htmlFor = rawValue;
      continue;
    }

    if (key === "http-equiv") {
      result.httpEquiv = rawValue;
      continue;
    }

    if (Array.isArray(rawValue)) {
      const serialized = rawValue
        .map((item) => (typeof item === "string" ? item : ensureString(item)))
        .filter((item): item is string => Boolean(item))
        .join(" ");

      if (serialized) {
        result[key] = serialized;
      }

      continue;
    }

    result[key] = rawValue;
  }

  return result;
};

const collectDataAttributes = (properties: Properties = {}): Record<string, unknown> => {
  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!key.startsWith("data-") && !key.startsWith("aria-")) {
      continue;
    }

    data[key] = value;
  }

  return data;
};

const extractTextContent = (node: HastNode): string => {
  if (isTextNode(node)) {
    return node.value;
  }

  if (isElementNode(node)) {
    return (node.children ?? []).map((child) => extractTextContent(child)).join("");
  }

  const value = (node as { value?: unknown }).value;

  return typeof value === "string" ? value : "";
};

const extractTextFromNodes = (nodes: HastNode[] = []): string => nodes.map((child) => extractTextContent(child)).join("");

const stringifyClassName = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0).join(" ");
  }

  return "";
};

const LANGUAGE_LABELS: Record<string, string> = {
  bash: "Bash",
  sh: "Shell",
  shell: "Shell",
  zsh: "Zsh",
  js: "JavaScript",
  javascript: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript",
  tsx: "TypeScript",
  typescript: "TypeScript",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  sass: "Sass",
  less: "Less",
  md: "Markdown",
  markdown: "Markdown",
  yaml: "YAML",
  yml: "YAML",
  graphql: "GraphQL",
  py: "Python",
  python: "Python",
  rb: "Ruby",
  go: "Go",
  rust: "Rust",
  java: "Java",
  php: "PHP",
  c: "C",
  cpp: "C++",
  "c++": "C++",
  csharp: "C#",
  cs: "C#",
  swift: "Swift",
  kotlin: "Kotlin",
  dart: "Dart",
  sql: "SQL",
  docker: "Dockerfile",
  dockerfile: "Dockerfile",
  plaintext: "Plain text",
  text: "Plain text",
};

const extractLanguageFromNode = (node: Element | null | undefined): string | null => {
  if (!node) {
    return null;
  }

  const properties = node.properties ?? {};

  const direct =
    ensureString(properties["data-language"]) ??
    ensureString((properties as Record<string, unknown>).dataLanguage) ??
    ensureString((properties as Record<string, unknown>).language) ??
    ensureString((properties as Record<string, unknown>).lang);

  if (direct) {
    return direct;
  }

  const className = stringifyClassName(properties.className ?? properties.class);
  const match = className.match(/(?:language|lang)-([a-z0-9+#-]+)/i);

  if (match?.[1]) {
    return match[1];
  }

  return null;
};

const formatLanguageLabel = (raw: string | null): string | null => {
  if (!raw) {
    return null;
  }

  const normalized = raw.toLowerCase();

  if (Object.prototype.hasOwnProperty.call(LANGUAGE_LABELS, normalized)) {
    return LANGUAGE_LABELS[normalized];
  }

  return raw
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => {
      if (segment.length === 0) {
        return segment;
      }

      const upper = segment.toUpperCase();

      if (upper === "TSX" || upper === "JSX" || upper === "SQL") {
        return upper;
      }

      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
};

const renderTextWithMath = (value: string, key: string): ReactNode => {
  if (!value) {
    return value;
  }

  if (value.indexOf("$") === -1) {
    return value.includes("\\$") ? value.replace(/\\\$/g, "$") : value;
  }

  MATH_EXPRESSION_PATTERN.lastIndex = 0;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = MATH_EXPRESSION_PATTERN.exec(value)) !== null) {
    if (match.index > lastIndex) {
      const text = value.slice(lastIndex, match.index);
      if (text) {
        parts.push(text.includes("\\$") ? text.replace(/\\\$/g, "$") : text);
      }
    }

    const [, blockExpression, inlineExpression] = match;
    const expression = blockExpression ?? inlineExpression;

    if (typeof expression === "string" && expression.trim().length > 0) {
      const math = expression.trim();
      const mathKey = `${key}-math-${parts.length}`;

      if (blockExpression !== undefined) {
        parts.push(createElement(BlockMath, { key: mathKey, math }));
      } else {
        parts.push(createElement(InlineMath, { key: mathKey, math }));
      }
    } else {
      const raw = match[0];
      if (raw) {
        parts.push(raw.includes("\\$") ? raw.replace(/\\\$/g, "$") : raw);
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    const trailing = value.slice(lastIndex);
    if (trailing) {
      parts.push(trailing.includes("\\$") ? trailing.replace(/\\\$/g, "$") : trailing);
    }
  }

  if (parts.length === 0) {
    const fallback = value.includes("\\$") ? value.replace(/\\\$/g, "$") : value;
    return fallback.length > 0 ? fallback : null;
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return createElement(Fragment, { key }, ...parts);
};

const renderChildren = async (
  nodes: HastNode[] = [],
  keyPrefix: string,
  context: RenderContext,
): Promise<ReactNode[]> => {
  const rendered = await Promise.all(
    nodes.map((node, index) => renderNode(node, `${keyPrefix}-${index}`, context)),
  );

  return rendered.filter((child): child is React.ReactElement | string | number => child !== null && child !== undefined);
};

const renderImageElement = async (node: Element, key: string): Promise<ReactNode> => {
  const properties = node.properties ?? {};
  const baseProps = convertProperties(properties);
  const originalSrc = ensureString(properties["data-original-src"]) ?? ensureString(properties.src);
  const webpSrcAttribute = ensureString(properties["data-webp"]);
  const src = originalSrc ?? webpSrcAttribute;

  if (!src) {
    return null;
  }

  let width = ensureNumber(properties.width);
  let height = ensureNumber(properties.height);
  let blurDataUrl = ensureString(properties["data-blur"]);
  let webpSrc = webpSrcAttribute;

  if ((!width || !height || !blurDataUrl || !webpSrc) && originalSrc) {
    const metadata = await loadImageMetadata(originalSrc);

    if (metadata) {
      width = width ?? metadata.original.width ?? null;
      height = height ?? metadata.original.height ?? null;
      blurDataUrl = blurDataUrl ?? metadata.blurDataUrl ?? null;
      webpSrc = webpSrc ?? metadata.webp?.url ?? null;
    }
  }

  const resolvedWidth = width ?? DEFAULT_IMAGE_WIDTH;
  const resolvedHeight = height ?? DEFAULT_IMAGE_HEIGHT;
  const alt = ensureString(properties.alt) ?? "";
  const sizes = ensureString(properties.sizes) ?? undefined;
  const title = ensureString(properties.title) ?? undefined;
  const loadingAttr = ensureString(properties.loading);
  const decodingAttr = ensureString(properties.decoding);
  const styleAttr =
    typeof properties.style === "string"
      ? parseStyleString(properties.style)
      : (baseProps.style as CSSProperties | undefined);

  for (const keyToRemove of [
    "src",
    "srcSet",
    "srcset",
    "width",
    "height",
    "alt",
    "sizes",
    "loading",
    "decoding",
    "placeholder",
    "blurDataURL",
    "style",
    "className",
    "title",
  ]) {
    delete (baseProps as Record<string, unknown>)[keyToRemove];
  }

  for (const key of Object.keys(baseProps)) {
    if (key.startsWith("data-") || key.startsWith("aria-")) {
      delete (baseProps as Record<string, unknown>)[key];
    }
  }

  const dataAttributes = collectDataAttributes(properties);

  if (webpSrc) {
    dataAttributes["data-webp"] = webpSrc;
  }

  if (originalSrc) {
    dataAttributes["data-original-src"] = originalSrc;
  }

  const className = ensureString(properties.className ?? properties.class) ?? undefined;

  const imageProps = {
    ...baseProps,
    src,
    alt,
    width: resolvedWidth,
    height: resolvedHeight,
    sizes,
    className,
    style: styleAttr,
    title,
    loading: loadingAttr === "eager" ? "eager" : "lazy",
    decoding: decodingAttr === "sync" ? "sync" : "async",
    placeholder: blurDataUrl ? "blur" : "empty",
    blurDataURL: blurDataUrl ?? undefined,
    ...dataAttributes,
  } as ImageProps & Record<string, unknown>;

  return <Image key={key} {...imageProps} />;
};

const renderNode = async (node: HastNode, key: string, context: RenderContext): Promise<ReactNode> => {
  if (isTextNode(node)) {
    if (context.insideCode) {
      return node.value;
    }

    return renderTextWithMath(node.value, key);
  }

  if (!isElementNode(node)) {
    return null;
  }

  if (node.tagName === "img") {
    return renderImageElement(node, key);
  }

  if (node.tagName === "pre") {
    const codeElement = node.children.find(
      (child): child is Element => isElementNode(child) && child.tagName === "code",
    );
    const rawCode = extractTextFromNodes(codeElement?.children ?? node.children).replace(/\r\n/g, "\n");
    const codeText = rawCode.endsWith("\n") ? rawCode.slice(0, -1) : rawCode;
    const rawLanguage = extractLanguageFromNode(codeElement) ?? extractLanguageFromNode(node);
    const language = formatLanguageLabel(rawLanguage);
    const props = convertProperties(node.properties);
    const codeContext = context.insideCode ? context : { ...context, insideCode: true };
    const children = await renderChildren(node.children, key, codeContext);

    return createElement(
      "div",
      { key, className: "relative" },
      createElement(CodeCopyButton, {
        code: codeText,
        language,
        className: "absolute right-3 top-3 z-10 sm:right-4 sm:top-4",
      }),
      createElement(node.tagName, { ...props }, ...children),
    );
  }

  const props = convertProperties(node.properties);
  const childContext =
    node.tagName === "code" || node.tagName === "pre"
      ? context.insideCode
        ? context
        : { ...context, insideCode: true }
      : context;
  const children = await renderChildren(node.children, key, childContext);

  return createElement(node.tagName, { ...props, key }, ...children);
};

export interface PostContentProps {
  html: string;
  className?: string;
}

export async function PostContent({ html, className }: PostContentProps) {
  const normalized = html?.trim();

  if (!normalized) {
    return null;
  }

  const root = processor.parse(normalized) as Root;
  const children = await renderChildren(root.children, "node", { insideCode: false });

  return <div className={className}>{children}</div>;
}
