"use client";

// src/modules/client/talent-search/components/TalentSearchBar.tsx

import React, { useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

interface TalentSearchBarProps {
  keyword: string;
  jobIdForMatch: string;
  onKeywordChange: (v: string) => void;
  onJobIdChange: (v: string) => void;
  onSearch: () => void;
  onReset: () => void;
  loading: boolean;
}

export default function TalentSearchBar({
  keyword,
  jobIdForMatch,
  onKeywordChange,
  onSearch,
  onReset,
  loading,
}: TalentSearchBarProps) {
  const [keywordFocused, setKeywordFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
  };

  return (
    <div className="flex flex-col gap-3 !mb-0">
      {/* Primary search */}
      <div className="relative flex-1 flex gap-2 max-md:flex-wrap">
        <div className="relative flex-1 min-w-0">
          <motion.span
            aria-hidden
            initial={false}
            style={{ y: "-50%" }}
            animate={{ scale: keywordFocused ? 1.12 : 1 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="pointer-events-none absolute left-3.5 top-1/2 text-muted-foreground"
          >
            <Search className="h-4 w-4" />
          </motion.span>
          <Input
            id="talent-search-keyword"
            placeholder="Search by name, skill, title, school…"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setKeywordFocused(true)}
            onBlur={() => setKeywordFocused(false)}
            className="pl-10 pr-9 h-10 rounded-xl border-border bg-background text-foreground shadow-2xs md:text-sm max-md:text-base focus-visible:border-primary/60 focus-visible:ring-0"
          />
          {/* Focus halo drawn as an overlay so it can grow without moving the box */}
          <motion.span
            aria-hidden
            initial={false}
            animate={{ opacity: keywordFocused ? 1 : 0, scale: keywordFocused ? 1 : 0.97 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="pointer-events-none absolute -inset-px rounded-xl border border-primary/45 shadow-md shadow-primary/25"
          />
          <AnimatePresence>
            {keyword && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onKeywordChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                title="Clear input"
              >
                <X className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            id="talent-search-btn"
            onClick={onSearch}
            disabled={loading}
            className="h-10 px-6 max-md:px-4 rounded-xl font-semibold text-sm gap-2 shrink-0 shadow-2xs"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
        </motion.div>

        {(keyword || jobIdForMatch) && (
          <motion.div whileTap={{ scale: 0.98 }}>
            <Button
              id="talent-search-reset"
              variant="outline"
              onClick={onReset}
              className="h-10 px-4 max-md:px-3 rounded-xl text-sm max-md:text-xs shrink-0 shadow-2xs"
            >
              Clear All
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
