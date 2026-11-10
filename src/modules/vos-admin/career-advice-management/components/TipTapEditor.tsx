// src/modules/vos-admin/career-advice-management/components/TipTapEditor.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Highlighter,
  Code,
  Table as TableIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TipTapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onOpenImageUploadModal?: () => void;
  onDropImageUpload?: (file: File) => Promise<{ file_url: string; file_id: string } | null>;
  className?: string;
}

export function TipTapEditor({
  content,
  onChange,
  placeholder = "Write your career advice article here...",
  onOpenImageUploadModal,
  onDropImageUpload,
  className,
}: TipTapEditorProps) {
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: true,
        allowBase64: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline hover:text-primary/80",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm md:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[460px] p-6 text-foreground text-sm leading-relaxed",
          "[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:text-foreground [&_h1]:tracking-tight",
          "[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-foreground",
          "[&_h3]:text-xl [&_h3]:font-medium [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-foreground",
          "[&_p]:mb-4 [&_p]:leading-relaxed",
          "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4",
          "[&_blockquote]:border-l-4 [&_blockquote]:border-cyan-500 [&_blockquote]:bg-cyan-500/10 dark:[&_blockquote]:bg-cyan-950/20 [&_blockquote]:py-3 [&_blockquote]:px-5 [&_blockquote]:rounded-r-lg [&_blockquote]:italic [&_blockquote]:my-5 [&_blockquote]:text-foreground/95",
          "[&_img]:rounded-xl [&_img]:my-6 [&_img]:max-h-[500px] [&_img]:w-auto [&_img]:object-cover [&_img]:shadow-md [&_img]:border [&_img]:border-border",
          "[&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:font-mono [&_pre]:text-xs [&_pre]:my-4",
          "[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs",
          "[&_table]:w-full [&_table]:border-collapse [&_table]:my-6 [&_table]:border [&_table]:border-border",
          "[&_th]:border [&_th]:border-border [&_th]:bg-muted/70 [&_th]:p-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-xs",
          "[&_td]:border [&_td]:border-border [&_td]:p-2.5 [&_td]:text-xs"
        ),
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            if (onDropImageUpload) {
              setIsUploadingImage(true);
              const toastId = toast.loading("Uploading image to Directus storage...");
              onDropImageUpload(file)
                .then((uploaded) => {
                  if (uploaded?.file_url) {
                    const { schema } = view.state;
                    const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                    const node = schema.nodes.image.create({ src: uploaded.file_url, alt: file.name });
                    const transaction = view.state.tr.insert(coordinates?.pos ?? view.state.selection.from, node);
                    view.dispatch(transaction);
                    toast.success("Image placed successfully", { id: toastId });
                  } else {
                    toast.error("Failed to upload image", { id: toastId });
                  }
                })
                .catch(() => {
                  toast.error("Image upload error", { id: toastId });
                })
                .finally(() => {
                  setIsUploadingImage(false);
                });
              return true;
            }
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith("image/")) {
              const file = items[i].getAsFile();
              if (file && onDropImageUpload) {
                event.preventDefault();
                setIsUploadingImage(true);
                const toastId = toast.loading("Uploading pasted image...");
                onDropImageUpload(file)
                  .then((uploaded) => {
                    if (uploaded?.file_url) {
                      editor?.chain().focus().setImage({ src: uploaded.file_url, alt: file.name }).run();
                      toast.success("Pasted image uploaded", { id: toastId });
                    }
                  })
                  .finally(() => setIsUploadingImage(false));
                return true;
              }
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
  }, [content, editor]);

  if (!editor) {
    return <div className="h-[460px] rounded-lg border border-border/50 animate-pulse bg-muted/20" />;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImageFromUrl = () => {
    if (onOpenImageUploadModal) {
      onOpenImageUploadModal();
      return;
    }
    const url = window.prompt("Enter image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-xs flex flex-col relative", className)}>
      {isUploadingImage && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2 rounded-full bg-background/95 px-3 py-1 shadow-md border border-border text-xs text-primary font-medium animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading to Directus...
        </div>
      )}

      {/* Floating Selection Bubble Menu - Appears immediately above highlighted text anywhere in long articles */}
      {editor && (
        <BubbleMenu
          editor={editor}
          className="flex items-center gap-1 rounded-lg border border-border bg-popover/95 p-1 shadow-lg backdrop-blur-md"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn("h-7 w-7 p-0", editor.isActive("bold") && "bg-muted text-primary font-bold")}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn("h-7 w-7 p-0", editor.isActive("italic") && "bg-muted text-primary")}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={cn("h-7 w-7 p-0", editor.isActive("underline") && "bg-muted text-primary font-bold")}
            title="Underline"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}
            className={cn("h-7 w-7 p-0", editor.isActive("highlight") && "bg-amber-200 text-amber-900")}
            title="Highlight"
          >
            <Highlighter className="h-3.5 w-3.5" />
          </Button>
          <div className="h-3.5 w-px bg-border mx-0.5" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn("h-7 w-7 p-0", editor.isActive("heading", { level: 2 }) && "bg-muted text-primary font-bold")}
            title="Heading 2"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn("h-7 w-7 p-0", editor.isActive("heading", { level: 3 }) && "bg-muted text-primary font-bold")}
            title="Heading 3"
          >
            <Heading3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn("h-7 w-7 p-0", editor.isActive("blockquote") && "bg-muted text-primary")}
            title="Callout Box"
          >
            <Quote className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={setLink}
            className={cn("h-7 w-7 p-0", editor.isActive("link") && "bg-muted text-primary")}
            title="Link"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </Button>
        </BubbleMenu>
      )}

      {/* Editor Main Toolbar - Sticky pinned directly beneath top header bar as user scrolls */}
      <div className="sticky top-[53px] z-10 flex flex-wrap items-center gap-1 border-b border-border/70 bg-card/95 p-2 backdrop-blur-md rounded-t-xl shadow-xs">
        {/* Text styling */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn("h-7 w-7 p-0", editor.isActive("bold") && "bg-muted text-primary font-bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("h-7 w-7 p-0", editor.isActive("italic") && "bg-muted text-primary")}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn("h-7 w-7 p-0", editor.isActive("underline") && "bg-muted text-primary font-bold")}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn("h-7 w-7 p-0", editor.isActive("strike") && "bg-muted text-primary")}
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}
          className={cn("h-7 w-7 p-0", editor.isActive("highlight") && "bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100")}
          title="Highlight Text"
        >
          <Highlighter className="h-3.5 w-3.5" />
        </Button>

        <div className="h-4 w-px bg-border/80 mx-1" />

        {/* Headings */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn("h-7 w-7 p-0", editor.isActive("heading", { level: 1 }) && "bg-muted text-primary font-bold")}
          title="Heading 1"
        >
          <Heading1 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn("h-7 w-7 p-0", editor.isActive("heading", { level: 2 }) && "bg-muted text-primary font-bold")}
          title="Heading 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn("h-7 w-7 p-0", editor.isActive("heading", { level: 3 }) && "bg-muted text-primary font-bold")}
          title="Heading 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </Button>

        <div className="h-4 w-px bg-border/80 mx-1" />

        {/* Alignment */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={cn("h-7 w-7 p-0", editor.isActive({ textAlign: "left" }) && "bg-muted text-primary")}
          title="Align Left"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={cn("h-7 w-7 p-0", editor.isActive({ textAlign: "center" }) && "bg-muted text-primary")}
          title="Align Center"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={cn("h-7 w-7 p-0", editor.isActive({ textAlign: "right" }) && "bg-muted text-primary")}
          title="Align Right"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={cn("h-7 w-7 p-0", editor.isActive({ textAlign: "justify" }) && "bg-muted text-primary")}
          title="Justify Text"
        >
          <AlignJustify className="h-3.5 w-3.5" />
        </Button>

        <div className="h-4 w-px bg-border/80 mx-1" />

        {/* Lists & Quotes */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn("h-7 w-7 p-0", editor.isActive("bulletList") && "bg-muted text-primary")}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn("h-7 w-7 p-0", editor.isActive("orderedList") && "bg-muted text-primary")}
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn("h-7 w-7 p-0", editor.isActive("blockquote") && "bg-muted text-primary")}
          title="Blockquote Callout"
        >
          <Quote className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={cn("h-7 w-7 p-0", editor.isActive("codeBlock") && "bg-muted text-primary font-mono")}
          title="Code Block"
        >
          <Code className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={insertTable}
          className="h-7 w-7 p-0"
          title="Insert Table (3x3)"
        >
          <TableIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="h-7 w-7 p-0"
          title="Horizontal Rule"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>

        <div className="h-4 w-px bg-border/80 mx-1" />

        {/* Media & Links */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={setLink}
          className={cn("h-7 w-7 p-0", editor.isActive("link") && "bg-muted text-primary")}
          title="Hyperlink"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addImageFromUrl}
          className="h-7 w-7 p-0"
          title="Insert Image (or Drag & Drop directly below)"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </Button>

        {/* History */}
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="h-7 w-7 p-0"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="h-7 w-7 p-0"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Editor Content Surface */}
      <div className="flex-1 cursor-text bg-background">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
