// src/modules/client/applicants/components/ApplicantPagination.tsx
"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

interface ApplicantPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];

/** Windowed page list with ellipses, e.g. 1 … 4 5 6 … 12 */
function buildPageItems(page: number, totalPages: number): Array<number | "gap"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: Array<number | "gap"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) items.push("gap");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < totalPages - 1) items.push("gap");
  items.push(totalPages);

  return items;
}

export default function ApplicantPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: ApplicantPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
      <div className="flex items-center gap-2.5">
        <p className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">
            {first}–{last}
          </span>{" "}
          of <span className="font-medium text-foreground">{total}</span>{" "}
          {total === 1 ? "candidate" : "candidates"}
        </p>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Per page</span>
          <NativeSelect
            size="sm"
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Candidates per page"
            className="w-[68px] pr-8 text-xs"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={String(size)}>
                {size}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>

      <nav aria-label="Candidate list pages" className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className="h-8 w-8 p-0 max-md:min-h-9 max-md:min-w-9 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {buildPageItems(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <span
              key={`gap-${index}`}
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
              aria-label={`Page ${item}`}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                "h-8 min-w-8 p-0 text-xs tabular-nums max-md:min-h-9 cursor-pointer",
                item === page && "font-semibold"
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
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className="h-8 w-8 p-0 max-md:min-h-9 max-md:min-w-9 cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  );
}
