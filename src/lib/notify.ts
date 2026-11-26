/**
 * Toast helper: every toast is a short TITLE plus an optional SUBTITLE.
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * WHY: Sonner already supports `toast("Title", { description: "Subtitle" })`, but call sites were
 * passing one long sentence as the title. This wrapper gives one consistent shape, so the toast
 * styling in globals.css (bold title over muted subtitle) always has two levels to work with.
 *
 * Writing rules: title = what happened, 2-5 words, no trailing period.
 *                subtitle = what to do or what happens next, one short sentence.
 *
 * Usage:
 *   notify.error("No internet connection", "Check your network. We'll reconnect automatically.");
 *   notify.success("School saved");
 *   notify.error("No internet connection", "We'll reconnect automatically.", { id: "offline", duration: Infinity });
 *   notify.fromMessage("error", "No internet connection. Check your network. We'll reconnect automatically.");
 */

import { toast, type ExternalToast } from "sonner";

type ToastKind = "success" | "error" | "warning" | "info" | "loading";

const show = (kind: ToastKind, title: string, description?: string, options?: ExternalToast) =>
    toast[kind](title, { description, ...options });

/**
 * Splits a legacy one-string message at its first sentence break into title + subtitle.
 * "No internet connection. Check your network." -> title "No internet connection", subtitle "Check your network."
 * Use it to migrate old call sites without rewording them; prefer the explicit two-argument form for new code.
 */
const splitMessage = (message: string): { title: string; description?: string } => {
    const match = message.trim().match(/^(.+?[.!?])\s+(.+)$/s);
    if (!match) return { title: message.trim().replace(/[.!?]$/, '') };
    return { title: match[1].replace(/[.!?]$/, ''), description: match[2] };
};

export const notify = {
    success: (title: string, description?: string, options?: ExternalToast) => show("success", title, description, options),
    error: (title: string, description?: string, options?: ExternalToast) => show("error", title, description, options),
    warning: (title: string, description?: string, options?: ExternalToast) => show("warning", title, description, options),
    info: (title: string, description?: string, options?: ExternalToast) => show("info", title, description, options),
    loading: (title: string, description?: string, options?: ExternalToast) => show("loading", title, description, options),

    /** Legacy single-string messages: split automatically into title + subtitle. */
    fromMessage: (kind: ToastKind, message: string, options?: ExternalToast) => {
        const { title, description } = splitMessage(message);
        return show(kind, title, description, options);
    },

    dismiss: toast.dismiss,
};
