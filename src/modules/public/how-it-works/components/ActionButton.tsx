// src/modules/public/how-it-works/components/ActionButton.tsx
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RoleKey, StepAction } from "../types";
import { useRoleNavigation } from "./RoleNavigationProvider";

interface Props {
  action: StepAction;
  role: RoleKey;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}

/** Every CTA on the page goes through here, so routing rules live in one place. */
export function ActionButton({ action, role, size = "sm", variant, className = "" }: Props) {
  const { navigateSmart, loading } = useRoleNavigation();
  const classes = `font-bold gap-2 cursor-pointer ${className}`;
  const content = (
    <>
      {action.label}
      <ArrowRight className="h-3.5 w-3.5" />
    </>
  );

  if (action.kind === "link") {
    return (
      <Button asChild size={size} variant={variant} className={classes}>
        <Link href={action.route}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button size={size} variant={variant} disabled={loading} onClick={() => navigateSmart(action.route, role)} className={classes}>
      {content}
    </Button>
  );
}
