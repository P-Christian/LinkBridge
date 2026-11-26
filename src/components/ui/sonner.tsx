"use client"

/**
 * Global toast host (Sonner, shadcn wrapper).
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - FIX: the style vars were `var(--popover)`, but the theme tokens are bare HSL triplets
 *   ("0 0% 100%"), which is not a valid colour on its own. They are now wrapped in hsl(...).
 * - The visual design (neutral card, hairline border, tinted icon chip, title + subtitle) lives in
 *   globals.css under "SONNER TOAST THEMING". Do NOT pass `richColors` to <Toaster>: it paints
 *   error toasts pink with a red border and fights the neutral design.
 * - Icons stay at size-4; globals.css wraps them in a 28px tinted chip per status.
 */

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }