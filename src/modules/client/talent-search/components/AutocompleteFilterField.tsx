"use client";

// src/modules/client/talent-search/components/AutocompleteFilterField.tsx

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FilterSuggestion, FilterSuggestionType } from "../types";
import { MIN_SUGGESTION_TERM, useFilterSuggestions } from "../hooks/useFilterSuggestions";

type Row =
  | { kind: "suggestion"; key: string; suggestion: FilterSuggestion; added: boolean }
  | { kind: "create"; key: string; value: string };

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Rows drop in behind the panel so a long list reads as one gesture. */
const rowMotion = (index: number) => ({
  initial: { opacity: 0, y: -5 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18, delay: Math.min(index, 9) * 0.014, ease: EASE_OUT },
});

interface AutocompleteFilterFieldProps {
  type: FilterSuggestionType;
  placeholder: string;
  /** Values already applied as tags, matched case-insensitively to flag rows. */
  selected: string[];
  onPick: (suggestion: FilterSuggestion) => void;
  /** Allows Enter to apply a value the registry does not list. */
  onCreate?: (value: string) => void;
  disabled?: boolean;
  inputClassName?: string;
}

export default function AutocompleteFilterField({
  type,
  placeholder,
  selected,
  onPick,
  onCreate,
  disabled = false,
  inputClassName,
}: AutocompleteFilterFieldProps) {
  const { query, suggestions, loading, error, setQuery, reset } = useFilterSuggestions(type);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const typed = query.trim();

  const rows = useMemo<Row[]>(() => {
    const picked = new Set(selected.map((value) => value.toLowerCase()));
    const next: Row[] = suggestions.map((suggestion) => ({
      kind: "suggestion",
      key: `${suggestion.value}|${suggestion.label}`,
      suggestion,
      added:
        picked.has(suggestion.label.toLowerCase()) ||
        picked.has(suggestion.value.toLowerCase()),
    }));

    const alreadyListed = next.some(
      (row) => row.kind === "suggestion" && row.suggestion.label.toLowerCase() === typed.toLowerCase()
    );
    if (onCreate && typed.length >= MIN_SUGGESTION_TERM && !alreadyListed) {
      next.push({ kind: "create", key: `create|${typed}`, value: typed });
    }
    return next;
  }, [suggestions, selected, typed, onCreate]);

  const safeIndex = rows.length === 0 ? -1 : Math.min(activeIndex, rows.length - 1);
  const activeRow = open && safeIndex >= 0 ? rows[safeIndex] : undefined;

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, safeIndex]);

  const close = useCallback(() => {
    reset();
    setOpen(false);
    setActiveIndex(0);
  }, [reset]);

  const commit = (row: Row) => {
    if (row.kind === "create") {
      onCreate?.(row.value);
    } else {
      if (row.added) return;
      onPick(row.suggestion);
    }
    close();
    inputRef.current?.focus();
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    setOpen(value.trim().length >= MIN_SUGGESTION_TERM);
  };

  const moveActive = (step: 1 | -1) => {
    if (rows.length === 0) return;
    if (safeIndex < 0) {
      setActiveIndex(step === 1 ? 0 : rows.length - 1);
      return;
    }
    setActiveIndex((safeIndex + step + rows.length) % rows.length);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        if (typed.length >= MIN_SUGGESTION_TERM) setOpen(true);
        return;
      }
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Enter") {
      if (activeRow) {
        event.preventDefault();
        commit(activeRow);
        return;
      }
      if (onCreate && typed.length >= MIN_SUGGESTION_TERM) {
        event.preventDefault();
        onCreate(typed);
        close();
      }
      return;
    }

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }

    if (event.key === "Tab") setOpen(false);
  };

  const showEmptyHint = !loading && !error && rows.length === 0;

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setActiveIndex(0); }}>
      <PopoverAnchor asChild>
        <Input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && safeIndex >= 0 ? `${listId}-option-${safeIndex}` : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            // No focus ring: the dropdown is sized to the field's box, and a ring
            // would make the two edges disagree.
            "max-md:h-10 max-md:text-base md:h-8 md:text-xs rounded-lg border-border bg-background focus-visible:ring-0",
            inputClassName
          )}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        // Focus stays in the field so typing keeps filtering the list.
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[var(--radix-popover-trigger-width)] min-w-56 max-w-72 p-1 shadow-lg data-[state=closed]:hidden"
      >
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={`${type} suggestions`}
          className="max-h-56 overflow-y-auto"
        >
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 px-2 py-2.5 text-xs text-muted-foreground"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching the registry…
            </motion.div>
          ) : null}

          {error ? (
            <motion.p
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="px-2 py-2.5 text-xs text-destructive"
            >
              {error}
            </motion.p>
          ) : null}

          {rows.map((row, index) => {
            const isActive = index === safeIndex;
            if (row.kind === "create") {
              return (
                <motion.div
                  key={row.key}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commit(row)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-100 data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                  {...rowMotion(index)}
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate" title={row.value}>
                    Add &quot;{row.value}&quot;
                  </span>
                </motion.div>
              );
            }

            const { suggestion, added } = row;
            return (
              <motion.div
                key={suggestion.value + suggestion.label}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={added}
                aria-disabled={added || undefined}
                data-active={isActive}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(row)}
                {...rowMotion(index)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-100",
                  added ? "cursor-default opacity-60" : "cursor-pointer",
                  isActive && !added && "bg-accent text-accent-foreground"
                )}
              >
                {/* Fixed gutter so the tick can pop in without shifting the label. */}
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  <AnimatePresence initial={false}>
                    {added && (
                      <motion.span
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE_OUT }}
                        className="text-primary"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span className="min-w-0 flex-1 truncate" title={suggestion.label}>
                  {suggestion.label}
                </span>
                {suggestion.hint ? (
                  <span className="shrink-0 max-w-24 truncate text-[10px] text-muted-foreground" title={suggestion.hint}>
                    {suggestion.hint}
                  </span>
                ) : null}
                {added ? <span className="shrink-0 text-[10px] text-muted-foreground">Added</span> : null}
              </motion.div>
            );
          })}

          {showEmptyHint ? (
            <motion.p
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              className="px-2 py-2.5 text-xs text-muted-foreground"
            >
              Nothing in the registry matches &quot;{typed}&quot;.
            </motion.p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
