"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { PortalCommandPalette } from "./PortalCommandPalette";
import { PORTAL_SEARCH_CONFIG, resolvePortal } from "./portalSearchConfig";

export function UserSearchBar() {
  const [query, setQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  // On public profile pages the portal comes from ?portal=..., read safely with useSyncExternalStore to avoid hydration mismatch
  const portalParam = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("popstate", onStoreChange);
      return () => window.removeEventListener("popstate", onStoreChange);
    },
    () => new URLSearchParams(window.location.search).get("portal"),
    () => null
  );
  const isMac = useSyncExternalStore(
    () => () => { },
    () => /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || ""),
    () => false
  );
  const pathname = usePathname();

  const portal = resolvePortal(pathname, portalParam);
  const cfg = PORTAL_SEARCH_CONFIG[portal];

  // Ctrl/Cmd + K for every portal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div className="relative w-full">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          {/*
            No onFocus handler on purpose: when the dialog closes Radix returns focus to
            this input, which would immediately re-open the palette.
          */}
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPaletteOpen(true);
            }}
            onClick={() => setPaletteOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setPaletteOpen(true);
            }}
            placeholder={cfg.barPlaceholder}
            className="h-9 w-full rounded-full border border-input bg-background/50 pl-9 pr-16 text-sm outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted-foreground hover:text-background"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <div className="absolute right-2.5 flex items-center gap-1">
              <kbd
                onClick={() => setPaletteOpen(true)}
                className="cursor-pointer pointer-events-auto inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted/70 px-1.5 font-mono text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={isMac ? "Open command palette (⌘K)" : "Open command palette (Ctrl+K)"}
              >
                {isMac ? (
                  <>
                    <span className="text-[11px]">⌘</span>K
                  </>
                ) : (
                  <>
                    <span>Ctrl</span>
                    <span>K</span>
                  </>
                )}
              </kbd>
            </div>
          )}
        </div>
      </div>

      <PortalCommandPalette
        portal={portal}
        open={paletteOpen}
        onOpenChange={(val) => {
          setPaletteOpen(val);
          if (!val) setQuery("");
        }}
        initialQuery={query}
      />
    </>
  );
}