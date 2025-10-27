"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";

import type { TableOfContentsItem } from "@/lib/toc";
import { cn } from "@/lib/utils";

const ACTIVE_HEADING_OFFSET = 160;
const SCROLL_TARGET_OFFSET = 96;

const flattenTocItems = (items: TableOfContentsItem[]): string[] => {
  const ids: string[] = [];

  items.forEach((item) => {
    ids.push(item.id);

    if (item.children.length) {
      ids.push(...flattenTocItems(item.children));
    }
  });

  return ids;
};

const itemHasActiveDescendant = (item: TableOfContentsItem, activeId: string | null): boolean => {
  if (!activeId) {
    return false;
  }

  if (item.id === activeId) {
    return true;
  }

  return item.children.some((child) => itemHasActiveDescendant(child, activeId));
};

export type TableOfContentsProps = {
  items: TableOfContentsItem[];
  className?: string;
};

export function TableOfContents({ items, className }: TableOfContentsProps) {
  const ids = useMemo(() => flattenTocItems(items), [items]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!ids.length) {
      setActiveId(null);
      return;
    }

    const currentHash = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : "";

    if (currentHash && ids.includes(currentHash)) {
      setActiveId(currentHash);
    } else {
      setActiveId(ids[0]);
    }
  }, [ids]);

  useEffect(() => {
    if (!ids.length) {
      return;
    }

    const handleScroll = () => {
      const scrollPosition = window.scrollY + ACTIVE_HEADING_OFFSET;
      let current: string | null = ids[0] ?? null;

      for (const id of ids) {
        const element = document.getElementById(id);

        if (!element) {
          continue;
        }

        const elementTop = element.getBoundingClientRect().top + window.scrollY;

        if (elementTop <= scrollPosition) {
          current = id;
        } else {
          break;
        }
      }

      setActiveId(current);
    };

    const handleHashChange = () => {
      const hash = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : "";

      if (hash && ids.includes(hash)) {
        setActiveId(hash);
      }
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [ids]);

  if (!items.length) {
    return null;
  }

  const handleItemClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();

    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    const prefersReducedMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targetPosition = Math.max(element.getBoundingClientRect().top + window.scrollY - SCROLL_TARGET_OFFSET, 0);

    window.history.replaceState(null, "", `#${id}`);
    window.scrollTo({
      top: targetPosition,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });

    setActiveId(id);
    setIsMobileOpen(false);
  };

  const renderItems = (nodes: TableOfContentsItem[], depth = 0): JSX.Element => (
    <ul className={cn("space-y-2 text-sm", depth > 0 ? "mt-2 border-l border-border/60 pl-4" : undefined)}>
      {nodes.map((item) => {
        const isActive = itemHasActiveDescendant(item, activeId);

        return (
          <li key={item.id} className="relative">
            <a
              href={`#${item.id}`}
              onClick={(event) => handleItemClick(event, item.id)}
              className={cn(
                "block rounded px-2 py-1 transition-colors hover:text-foreground",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground",
              )}
              aria-current={item.id === activeId ? "true" : undefined}
            >
              {item.text}
            </a>
            {item.children.length ? renderItems(item.children, depth + 1) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className={cn("w-full lg:w-72 lg:flex-none", className)}>
      <nav
        aria-label="Table of contents"
        className="rounded-lg border border-border bg-background/80 p-4 shadow-sm backdrop-blur lg:sticky lg:top-24"
      >
        <div className="flex items-center justify-between gap-4 lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">On this page</p>
          <button
            type="button"
            onClick={() => setIsMobileOpen((previous) => !previous)}
            className="flex items-center gap-1 text-sm font-medium text-foreground lg:hidden"
            aria-expanded={isMobileOpen}
          >
            {isMobileOpen ? (
              <>
                Hide <ChevronUp aria-hidden="true" className="h-4 w-4" />
              </>
            ) : (
              <>
                Show <ChevronDown aria-hidden="true" className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
        <div className={cn("mt-4", isMobileOpen ? "block" : "hidden lg:block")}>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-12rem)]">
            {renderItems(items)}
          </div>
        </div>
      </nav>
    </aside>
  );
}
