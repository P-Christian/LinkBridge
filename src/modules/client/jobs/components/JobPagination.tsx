"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const JOB_PAGE_SIZES = [10, 25, 50];

/** 1 … 4 5 [6] 7 8 … 20 — always keeps both ends and the neighbours of the current page. */
function pageItems(current: number, total: number): (number | "gap")[] {
  const items: (number | "gap")[] = [];
  for (let page = 1; page <= total; page++) {
    const isEdge = page === 1 || page === total;
    const isNear = Math.abs(page - current) <= 1;
    const item: number | "gap" = isEdge || isNear ? page : "gap";
    if (items[items.length - 1] !== item) items.push(item);
  }
  return items;
}

interface JobPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export default function JobPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: JobPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Job postings pagination"
      className="mt-4 flex flex-col gap-3 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm md:text-xs text-muted-foreground">
        <span>
          Showing{" "}
          <span className="font-medium text-foreground">
            {from}&ndash;{to}
          </span>{" "}
          of {total} {total === 1 ? "posting" : "postings"}
        </span>
        <span className="flex items-center gap-1.5">
          Per page
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-7 w-[70px] px-2 text-xs md:text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {JOB_PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={`${size}`} className="text-xs md:text-xs">
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="h-7 gap-1 rounded-lg px-2 text-xs font-medium max-md:min-h-9"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </Button>

        {pageItems(page, totalPages).map((item, idx) =>
          item === "gap" ? (
            <span key={`gap-${idx}`} className="px-1 text-xs text-muted-foreground select-none">
              …
            </span>
          ) : (
            <Button
              type="button"
              key={item}
              variant={item === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                "h-7 w-7 rounded-lg p-0 text-xs font-semibold",
                item === page && "shadow-xs"
              )}
            >
              {item}
            </Button>
          )
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="h-7 gap-1 rounded-lg px-2 text-xs font-medium max-md:min-h-9"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </nav>
  );
}
