import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl?: string;
}

export function Pagination({ currentPage, totalPages, baseUrl = "" }: PaginationProps) {
  if (totalPages <= 1) return null;

  const createPageUrl = (page: number) => {
    if (page === 1) return baseUrl || "/";
    return `${baseUrl}?page=${page}`;
  };

  const pages: (number | "ellipsis")[] = [];
  const showEllipsis = totalPages > 7;

  if (!showEllipsis) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    if (currentPage <= 3) {
      for (let i = 1; i <= 4; i++) pages.push(i);
      pages.push("ellipsis");
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1);
      pages.push("ellipsis");
      for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push("ellipsis");
      pages.push(currentPage - 1);
      pages.push(currentPage);
      pages.push(currentPage + 1);
      pages.push("ellipsis");
      pages.push(totalPages);
    }
  }

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      {currentPage > 1 && (
        <Link
          href={createPageUrl(currentPage - 1)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          ← Previous
        </Link>
      )}

      <div className="flex gap-1">
        {pages.map((page, index) => {
          if (page === "ellipsis") {
            return (
              <span key={`ellipsis-${index}`} className="flex h-9 w-9 items-center justify-center">
                …
              </span>
            );
          }

          const isActive = page === currentPage;

          return (
            <Link
              key={page}
              href={createPageUrl(page)}
              className={cn(
                buttonVariants({
                  variant: isActive ? "default" : "outline",
                  size: "sm",
                }),
                "h-9 w-9",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {page}
            </Link>
          );
        })}
      </div>

      {currentPage < totalPages && (
        <Link
          href={createPageUrl(currentPage + 1)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Next →
        </Link>
      )}
    </nav>
  );
}
