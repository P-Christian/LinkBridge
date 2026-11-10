// src/modules/client/jobs/components/RichTextEditor.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bold, List, ListOrdered, Sparkles, Loader2, Wand2, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { sanitizeHtml } from "@/lib/sanitize-html";

interface RichTextEditorProps {
  id: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  fieldType?: "job_description" | "job_responsibilities" | "job_qualifications";
  jobTitle?: string;
}

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  error,
  fieldType = "job_description",
  jobTitle = "",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [successAction, setSuccessAction] = useState<string | null>(null);

  // Stored content is HTML that the editor parses, so it is sanitized before it
  // is assigned to innerHTML. Markdown conversion above stays plain-text in,
  // markup out, and its output goes through the same sanitizer.
  const formatToHtml = (val: string | null | undefined): string => {
    if (!val) return "";
    let html = val;
    if (!/<[a-z][\s\S]*>/i.test(html)) {
      html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
      const lines = html.split("\n");
      const isList = lines.length > 1 && lines.some((l) => /^[-*•]\s/.test(l.trim()));
      if (isList) {
        html = `<ul>${lines.map((l) => `<li>${l.replace(/^[-*•]\s/, "")}</li>`).join("")}</ul>`;
      } else {
        html = lines.join("<br>");
      }
    }
    return sanitizeHtml(html);
  };

  useEffect(() => {
    if (editorRef.current) {
      const targetHtml = formatToHtml(value);
      const currentHtml = editorRef.current.innerHTML;
      if (currentHtml !== targetHtml && document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = targetHtml;
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const exec = (command: string, arg?: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleRefine = async (action: string, customInstruction = "") => {
    setIsRefining(true);
    setActiveAction(action);
    setSuccessAction(null);

    try {
      const currentHtml = editorRef.current?.innerHTML || value || "";
      const res = await fetch("/api/client/jobs/refine-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: currentHtml,
          action,
          custom_prompt: customInstruction,
          field_type: fieldType,
          job_title: jobTitle,
        }),
      });

      const data = await res.json();
      const refinedHtml = res.ok ? sanitizeHtml(data.refined_html) : "";
      if (refinedHtml) {
        if (editorRef.current) {
          editorRef.current.innerHTML = refinedHtml;
        }
        onChange(refinedHtml);
        setSuccessAction(action);
        setTimeout(() => setSuccessAction(null), 2500);
      }
    } catch (err) {
      console.error("Failed to refine text:", err);
    } finally {
      setIsRefining(false);
      setActiveAction(null);
      setCustomPopoverOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // Bold: Ctrl+B
    if (isCtrlOrCmd && !e.shiftKey && key === "b") {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      exec("bold");
      return;
    }

    // Bullet List: Ctrl+Shift+8 or Ctrl+Shift+L
    if (isCtrlOrCmd && e.shiftKey && (key === "8" || key === "*" || key === "l")) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      exec("insertUnorderedList");
      return;
    }

    // Numbered List: Ctrl+Shift+7 or Ctrl+Shift+O
    if (isCtrlOrCmd && e.shiftKey && (key === "7" || key === "&" || key === "o")) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      exec("insertOrderedList");
      return;
    }

    // Auto-convert to list when typing "- " or "1. " followed by Space
    if (e.key === " ") {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          const textBeforeCursor = text.substring(0, range.startOffset);
          if (textBeforeCursor === "-" || textBeforeCursor === "*" || textBeforeCursor === "•") {
            e.preventDefault();
            node.textContent = text.substring(range.startOffset);
            exec("insertUnorderedList");
            return;
          }
          if (textBeforeCursor === "1.") {
            e.preventDefault();
            node.textContent = text.substring(range.startOffset);
            exec("insertOrderedList");
            return;
          }
        }
      }
    }

    // Handle Enter key inside an empty list item to exit list
    if (e.key === "Enter" && !e.shiftKey) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let node: Node | null = range.startContainer;
        let liElement: HTMLLIElement | null = null;
        while (node && node !== editorRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "LI") {
            liElement = node as HTMLLIElement;
            break;
          }
          node = node.parentNode;
        }

        if (liElement) {
          const liText = (liElement.textContent || "").replace(/\u200B/g, "").trim();
          if (!liText) {
            e.preventDefault();
            e.stopPropagation();
            exec("insertUnorderedList");
            return;
          }
        }
      }
    }

    // Handle Backspace at beginning of list item or empty list item to remove bullet
    if (e.key === "Backspace") {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        let node: Node | null = range.startContainer;
        let liElement: HTMLLIElement | null = null;
        while (node && node !== editorRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "LI") {
            liElement = node as HTMLLIElement;
            break;
          }
          node = node.parentNode;
        }

        if (liElement) {
          const isAtStart = range.startOffset === 0 && (node === liElement || node === liElement.firstChild);
          const isEmpty = (liElement.textContent || "").replace(/\u200B/g, "").trim() === "";
          if (isAtStart || isEmpty) {
            e.preventDefault();
            e.stopPropagation();
            exec("insertUnorderedList");
            return;
          }
        }
      }
    }
  };

  return (
    <div
      className={`border rounded-xl overflow-hidden bg-white dark:bg-zinc-950 transition-colors ${
        error
          ? "border-rose-500 focus-within:ring-rose-500"
          : "border-zinc-200 dark:border-zinc-800 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500"
      }`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
        <span className="text-xs md:text-[11px] text-zinc-400 font-medium select-none">
          Formatting: Bold (Ctrl+B) | List (Ctrl+Shift+8)
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("bold");
            }}
            title="Bold (Ctrl+B)"
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 font-bold transition-colors cursor-pointer max-md:size-10 max-md:p-0"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("insertUnorderedList");
            }}
            title="Bullet List (Ctrl+Shift+8 or type '- ' + Space)"
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer max-md:size-10 max-md:p-0"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("insertOrderedList");
            }}
            title="Numbered List (Ctrl+Shift+7 or type '1. ' + Space)"
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer max-md:size-10 max-md:p-0"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Editor Surface */}
      <div
        id={id}
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className="min-h-[140px] max-h-[300px] p-3.5 md:text-sm max-md:text-base leading-relaxed outline-none focus:outline-none overflow-y-auto text-zinc-800 dark:text-zinc-200 empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_b]:font-bold [&_strong]:font-bold"
      />

      {/* In-Editor AI Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-1.5 border-t border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 text-sm md:text-xs">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs md:text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">AI Assist:</span>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isRefining}
            onClick={() => handleRefine("improve")}
            className="h-6 px-2 text-xs md:text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-md max-md:min-h-10"
          >
            {isRefining && activeAction === "improve" ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1 text-emerald-600" />
            ) : successAction === "improve" ? (
              <Check className="h-3 w-3 mr-1 text-emerald-600" />
            ) : null}
            ✨ Improve
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isRefining}
            onClick={() => handleRefine("concise")}
            className="h-6 px-2 text-xs md:text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-md max-md:min-h-10"
          >
            {isRefining && activeAction === "concise" ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1 text-emerald-600" />
            ) : successAction === "concise" ? (
              <Check className="h-3 w-3 mr-1 text-emerald-600" />
            ) : null}
            ✂ Make Concise
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isRefining}
            onClick={() => handleRefine("technical")}
            className="h-6 px-2 text-xs md:text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-md max-md:min-h-10"
          >
            {isRefining && activeAction === "technical" ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1 text-emerald-600" />
            ) : successAction === "technical" ? (
              <Check className="h-3 w-3 mr-1 text-emerald-600" />
            ) : null}
            ⚙ More Technical
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isRefining}
            onClick={() => handleRefine("regenerate")}
            className="h-6 px-2 text-xs md:text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-md max-md:min-h-10"
          >
            {isRefining && activeAction === "regenerate" ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1 text-emerald-600" />
            ) : successAction === "regenerate" ? (
              <Check className="h-3 w-3 mr-1 text-emerald-600" />
            ) : null}
            🔄 Regenerate
          </Button>

          {/* Custom Instruction Popover */}
          <Popover open={customPopoverOpen} onOpenChange={setCustomPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isRefining}
                className="h-6 px-2 text-xs md:text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-md gap-1 max-md:min-h-10"
              >
                {isRefining && activeAction === "custom" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : successAction === "custom" ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Wand2 className="h-3 w-3" />
                )}
                Custom
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3 max-md:w-[calc(100vw-2rem)]" align="end">
              <div className="space-y-2">
                <span className="text-sm md:text-xs font-semibold block text-foreground">Custom AI Instruction</span>
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder="e.g. Make suitable for entry-level..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (customPrompt.trim()) handleRefine("custom", customPrompt.trim());
                      }
                    }}
                    className="h-8 md:text-xs max-md:min-h-10 max-md:text-base"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={isRefining || !customPrompt.trim()}
                    onClick={() => handleRefine("custom", customPrompt.trim())}
                    className="h-8 w-8 p-0 bg-[#14a800] hover:bg-[#118f00] text-white max-md:size-10"
                  >
                    {isRefining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
