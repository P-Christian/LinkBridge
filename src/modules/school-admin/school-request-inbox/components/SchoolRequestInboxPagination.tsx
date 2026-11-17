"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SchoolRequestInboxPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
}

/** Windowed page list with ellipses, e.g. 1 … 4 5 6 … 12 */
function buildPageItems(page: number, totalPages: number): Array<number | "gap"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "gap"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) items.push("gap");
  for (let current = start; current <= end; current += 1) items.push(current);
  if (end < totalPages - 1) items.push("gap");
  items.push(totalPages);

  return items;
}

export function SchoolRequestInboxPagination({
  page,
  pageSize,
  total,
  onPageChange,
  label = "requests",
}: SchoolRequestInboxPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
      <p className="text-xs text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">
          {first}–{last}
        </span>{" "}
        of <span className="font-medium text-foreground">{total}</span>{" "}
        {label}
      </p>

      <nav aria-label="Request pagination" className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className="h-8 cursor-pointer px-2 max-md:min-h-9"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        {buildPageItems(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <span
              key={`gap-${String(index)}`}
              aria-hidden="true"
              className="px-1 text-xs text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              variant={item === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(item)}
              aria-label={`Page ${String(item)}`}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                "h-8 min-w-8 p-0 text-xs tabular-nums max-md:min-h-9 cursor-pointer",
                item === page && "font-semibold",
              )}
            >
              {item}
            </Button>
          ),
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className="h-8 cursor-pointer px-2 max-md:min-h-9"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  );
}
