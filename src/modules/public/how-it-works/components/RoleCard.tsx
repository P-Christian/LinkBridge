
"use client";

import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { ROLE_GUIDES } from "../config";
import { ROLE_THEME } from "../theme";
import type { RoleKey } from "../types";

interface Props {
  role: RoleKey;
  active: boolean;
  onSelect: (role: RoleKey) => void;
  className?: string;
}

export function RoleCard({
  role,
  active,
  onSelect,
  className = "",
}: Props) {
  const guide = ROLE_GUIDES[role];
  const theme = ROLE_THEME[role];
  const Icon = theme.icon;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={() => onSelect(role)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(role);
        }
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: active ? 1 : 1,
      }}
      whileHover={{
        y: -4,
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      whileTap={{ scale: 0.98 }}
      transition={{
        opacity: { duration: 0.35 },
        y: { duration: 0.35, ease: "easeOut" },
        scale: { duration: 0.2 },
      }}
      className={`h-full flex flex-col rounded-2xl border bg-card p-5 space-y-3 cursor-pointer transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? theme.cardActive : theme.cardIdle
        } ${className}`}
    >
      <div className="flex items-center gap-3">
        <motion.div
          animate={{
            scale: active ? 1.05 : 1,
            rotate: active ? 3 : 0,
          }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="p-2.5 rounded-xl border bg-background shrink-0"
        >
          <Icon className={`h-5 w-5 ${theme.text}`} />
        </motion.div>

        <div className="min-w-0">
          <h3 className="font-bold text-sm text-foreground">
            {guide.tabLabel}
          </h3>

          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            {guide.totalOnboardingTime}
          </span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        {guide.summary}
      </p>
 
   </motion.div>
  );
}
