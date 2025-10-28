import Image, { type ImageProps } from "next/image";
import { createElement, type CSSProperties, type ReactNode } from "react";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import type { Element, Properties, Root, Text } from "hast";

import { loadImageMetadata } from "@/lib/image-metadata";

const processor = unified().use(rehypeParse, { fragment: true });

type HastNode = Root["children"][number];

const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_HEIGHT = 675;

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

const renderChildren = async (nodes: HastNode[] = [], keyPrefix: string): Promise<ReactNode[]> => {
  const rendered = await Promise.all(nodes.map((node, index) => renderNode(node, `${keyPrefix}-${index}`)));

  return rendered.filter((child): child is ReactNode => child !== null && child !== undefined);
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

const renderNode = async (node: HastNode, key: string): Promise<ReactNode> => {
  if (isTextNode(node)) {
    return node.value;
  }

  if (!isElementNode(node)) {
    return null;
  }

  if (node.tagName === "img") {
    return renderImageElement(node, key);
  }

  const props = convertProperties(node.properties);
  const children = await renderChildren(node.children, key);

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
  const children = await renderChildren(root.children, "node");

  return <div className={className}>{children}</div>;
}
