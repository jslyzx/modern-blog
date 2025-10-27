import type { Element, Root, Text } from "hast";
import rehypeParse from "rehype-parse";
import { unified } from "unified";

export type TableOfContentsItem = {
  id: string;
  text: string;
  level: 2 | 3;
  children: TableOfContentsItem[];
};

const HEADING_TAGS = new Set(["h2", "h3"]);

const isElementNode = (node: unknown): node is Element =>
  Boolean(node) && typeof node === "object" && (node as Element).type === "element";

const isTextNode = (node: unknown): node is Text =>
  Boolean(node) && typeof node === "object" && (node as Text).type === "text";

const extractText = (element: Element): string => {
  const parts: string[] = [];

  const visit = (node: unknown): void => {
    if (isTextNode(node)) {
      const value = typeof node.value === "string" ? node.value : String(node.value ?? "");
      if (value.trim()) {
        parts.push(value.trim());
      }
      return;
    }

    if (isElementNode(node) && Array.isArray(node.children)) {
      const { ariaHidden } = node.properties ?? {};
      if (ariaHidden === true || ariaHidden === "true") {
        return;
      }

      node.children.forEach(visit);
    }
  };

  if (Array.isArray(element.children)) {
    element.children.forEach(visit);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
};

const getIdFromProperties = (properties: Element["properties"] | undefined): string | null => {
  if (!properties) {
    return null;
  }

  const { id } = properties;

  if (typeof id === "string") {
    return id;
  }

  if (Array.isArray(id)) {
    const first = id.find((value) => typeof value === "string" && value.trim());
    return first ?? null;
  }

  return null;
};

const collectHeadings = (root: Root): TableOfContentsItem[] => {
  const toc: TableOfContentsItem[] = [];
  let currentSection: TableOfContentsItem | null = null;

  const walk = (nodes: Root["children"]): void => {
    nodes.forEach((node) => {
      if (isElementNode(node)) {
        if (HEADING_TAGS.has(node.tagName)) {
          const id = getIdFromProperties(node.properties);
          const text = extractText(node);

          if (id && text) {
            const level = node.tagName === "h2" ? 2 : 3;
            const item: TableOfContentsItem = {
              id,
              text,
              level,
              children: [],
            };

            if (level === 2) {
              toc.push(item);
              currentSection = item;
            } else if (currentSection) {
              currentSection.children.push(item);
            } else {
              toc.push(item);
            }
          }
        }

        if (Array.isArray(node.children)) {
          walk(node.children as Root["children"]);
        }
      }
    });
  };

  if (Array.isArray(root.children) && root.children.length) {
    walk(root.children);
  }

  return toc;
};

export const generateToc = (html: string): TableOfContentsItem[] => {
  if (!html?.trim()) {
    return [];
  }

  try {
    const root = unified().use(rehypeParse, { fragment: true }).parse(html) as Root;
    return collectHeadings(root);
  } catch {
    return [];
  }
};

export const countTocItems = (items: TableOfContentsItem[]): number =>
  items.reduce((total, item) => total + 1 + countTocItems(item.children), 0);
