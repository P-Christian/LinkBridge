// src/modules/vos-admin/career-advice-management/components/ArticleEditorInline.tsx
"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  Globe,
  Sparkles,
  Save,
  Send,
  Clock,
  UserCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TipTapEditor } from "./TipTapEditor";
import { ImageUploader } from "./ImageUploader";
import { ArticleAssetGallery } from "./ArticleAssetGallery";
import { AiArticleAssistant } from "./AiArticleAssistant";
import { ArticleActionConfirmDialog, ConfirmActionType } from "./ArticleActionConfirmDialog";
import { MarkdownCheatsheetCard } from "./MarkdownCheatsheetCard";
import { DEFAULT_CAREER_CATEGORIES, generateSlug, calculateReadTime } from "../services/article.helpers";
import { CareerArticle, ArticleStatus, ArticleAsset } from "../types/article.types";
import { CreateCareerArticleInput } from "../types/article.schema";
import { useUserProfile } from "@/components/shared/providers/UserProfileProvider";

interface ArticleEditorInlineProps {
  article: CareerArticle | null;
  onBack: () => void;
  onSave: (data: CreateCareerArticleInput, articleId?: number) => Promise<void>;
  onUploadMedia: (
    file: File,
    articleId?: number,
    role?: string,
    caption?: string
  ) => Promise<{
    file_id: string;
    file_url: string;
    file_name?: string;
    file_type?: string;
    file_size_bytes?: number;
    asset?: ArticleAsset;
  } | null>;
  isSubmitting: boolean;
}

export function ArticleEditorInline({
  article,
  onBack,
  onSave,
  onUploadMedia,
  isSubmitting,
}: ArticleEditorInlineProps) {
  const profile = useUserProfile();

  // Confirmation Dialog State
  const [pendingAction, setPendingAction] = useState<ConfirmActionType | null>(null);

  // Form State
  const [prevArticleId, setPrevArticleId] = useState<number | undefined | null>(article?.article_id);
  const [title, setTitle] = useState(article?.title || "");
  const [slug, setSlug] = useState(article?.slug || "");
  const [category, setCategory] = useState<string>(article?.category || "Career Strategy");
  const [excerpt, setExcerpt] = useState(article?.excerpt || "");
  const [content, setContent] = useState(article?.content || "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(article?.featured_image_url || null);
  const [featuredImageId, setFeaturedImageId] = useState<string | null>(article?.featured_image_id || null);
  const [authorName, setAuthorName] = useState(
    article?.author_name || (profile?.name && profile.name !== "Guest" ? profile.name : "VOS Career Team")
  );
  const [authorRole, setAuthorRole] = useState(article?.author_role || "Career Specialist");
  const [readTime, setReadTime] = useState(article?.read_time_minutes || 5);
  const [status, setStatus] = useState<ArticleStatus>(article?.status || "DRAFT");
  const [isFeatured, setIsFeatured] = useState(article?.is_featured || false);
  const [aiGenerated, setAiGenerated] = useState(article?.ai_generated || false);
  const [seoTitle, setSeoTitle] = useState(article?.seo_title || "");
  const [seoDescription, setSeoDescription] = useState(article?.seo_description || "");
  const [assets, setAssets] = useState<ArticleAsset[]>(article?.assets || []);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);

  // Active right-sidebar inspector tab
  const [activeInspectorTab, setActiveInspectorTab] = useState<"settings" | "seo" | "media" | "ai">("settings");

  if (article?.article_id !== prevArticleId) {
    setPrevArticleId(article?.article_id);
    if (article) {
      setTitle(article.title);
      setSlug(article.slug);
      setCategory(article.category);
      setExcerpt(article.excerpt);
      setContent(article.content);
      setFeaturedImageUrl(article.featured_image_url || null);
      setFeaturedImageId(article.featured_image_id || null);
      setAuthorName(article.author_name);
      setAuthorRole(article.author_role);
      setReadTime(article.read_time_minutes);
      setStatus(article.status);
      setIsFeatured(article.is_featured);
      setAiGenerated(article.ai_generated);
      setSeoTitle(article.seo_title || "");
      setSeoDescription(article.seo_description || "");
      setAssets(article.assets || []);
    } else {
      const defaultName = profile?.name && profile.name !== "Guest" ? profile.name : "VOS Career Team";
      setTitle("");
      setSlug("");
      setCategory("Career Strategy");
      setExcerpt("");
      setContent("");
      setFeaturedImageUrl(null);
      setFeaturedImageId(null);
      setAuthorName(defaultName);
      setAuthorRole("Career Specialist");
      setReadTime(5);
      setStatus("DRAFT");
      setIsFeatured(false);
      setAiGenerated(false);
      setSeoTitle("");
      setSeoDescription("");
      setAssets([]);
    }
  }

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!article) {
      setSlug(generateSlug(val));
    }
  };

  const handleContentChange = (html: string) => {
    setContent(html);
    const calculated = calculateReadTime(html);
    setReadTime(calculated);
  };

  const submitArticle = async (targetStatus?: ArticleStatus) => {
    if (!title.trim() || !content.trim()) return;

    const chosenStatus = targetStatus || status;

    const payload: CreateCareerArticleInput = {
      title,
      slug: slug || generateSlug(title),
      category,
      excerpt: excerpt || title,
      content,
      featured_image_url: featuredImageUrl,
      featured_image_id: featuredImageId,
      author_name: authorName || "VOS Career Team",
      author_role: authorRole || "Career Specialist",
      read_time_minutes: readTime || 5,
      status: chosenStatus,
      is_featured: isFeatured,
      ai_generated: aiGenerated,
      seo_title: seoTitle || undefined,
      seo_description: seoDescription || undefined,
      assets: assets.map((a, idx) => ({
        ...a,
        display_order: a.display_order ?? idx,
      })),
    };

    await onSave(payload, article?.article_id);
  };

  const handleInlineImageDrop = async (file: File) => {
    const res = await onUploadMedia(file, article?.article_id, "INLINE_BODY");
    if (res?.file_url) {
      setAssets((prev) => [
        ...prev,
        {
          directus_file_id: res.file_id,
          file_url: res.file_url,
          file_name: res.file_name,
          asset_role: "INLINE_BODY",
        },
      ]);
      return { file_url: res.file_url, file_id: res.file_id };
    }
    return null;
  };

  const handleGalleryUpload = async (file: File) => {
    setIsUploadingGallery(true);
    try {
      const res = await onUploadMedia(file, article?.article_id, "GALLERY");
      if (res) {
        setAssets((prev) => [
          ...prev,
          {
            directus_file_id: res.file_id,
            file_url: res.file_url,
            file_name: res.file_name,
            asset_role: "GALLERY",
          },
        ]);
      }
    } finally {
      setIsUploadingGallery(false);
    }
  };

  // Dirty check: check if user modified anything from initial state
  const isDirty = (): boolean => {
    if (article) {
      return (
        title !== article.title ||
        slug !== article.slug ||
        category !== article.category ||
        excerpt !== article.excerpt ||
        content !== article.content ||
        featuredImageUrl !== (article.featured_image_url || null) ||
        authorName !== article.author_name ||
        authorRole !== article.author_role ||
        isFeatured !== article.is_featured ||
        seoTitle !== (article.seo_title || "") ||
        seoDescription !== (article.seo_description || "")
      );
    }
    // New article: dirty if title, excerpt, content, or featured image changed from blank
    return (
      title.trim() !== "" ||
      excerpt.trim() !== "" ||
      content.trim() !== "" ||
      featuredImageUrl !== null
    );
  };

  const handleBackClick = () => {
    if (isDirty()) {
      setPendingAction("DISCARD");
    } else {
      onBack();
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    if (pendingAction === "DISCARD") {
      setPendingAction(null);
      onBack();
    } else if (pendingAction === "DRAFT") {
      setPendingAction(null);
      await submitArticle("DRAFT");
    } else if (pendingAction === "PUBLISH") {
      setPendingAction(null);
      await submitArticle("PUBLISHED");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-background text-foreground">
      {/* Action Re-confirmation Dialog */}
      <ArticleActionConfirmDialog
        isOpen={pendingAction !== null}
        actionType={pendingAction}
        isSubmitting={isSubmitting}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
      />

      {/* Top Sticky Header Command Bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/95 px-4 md:px-8 py-3 backdrop-blur-md shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBackClick}
            className="text-xs h-8 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Articles
          </Button>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              {article ? `Editing: ${article.title}` : "New Career Advice Article"}
            </span>
            <Badge
              variant="outline"
              className="text-[10px] hidden sm:inline-flex items-center gap-1 font-mono uppercase"
            >
              <Clock className="h-2.5 w-2.5" /> {readTime} min read
            </Badge>
          </div>
        </div>

        {/* Action Buttons & Featured Switch */}
        <div className="flex items-center gap-3">
          {/* Top-Level Quick Featured Switch */}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground bg-muted/60 hover:bg-muted px-2.5 py-1.5 rounded-md border border-border/70 transition-colors">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="rounded border-input text-amber-500 focus:ring-amber-500 h-3.5 w-3.5"
            />
            <span className="flex items-center gap-1">
              <span className={isFeatured ? "text-amber-500 font-semibold" : "text-muted-foreground"}>
                ⭐ Featured
              </span>
            </span>
          </label>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting || !title.trim() || !content.trim()}
            onClick={() => setPendingAction("DRAFT")}
            className="text-xs h-8 shadow-xs"
          >
            {isSubmitting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
            Save Draft
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isSubmitting || !title.trim() || !content.trim()}
            onClick={() => setPendingAction("PUBLISH")}
            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            {isSubmitting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Send className="mr-1.5 h-3 w-3" />}
            Publish Article
          </Button>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 md:px-8 py-6 max-w-7xl mx-auto w-full flex-1 min-w-0">
        {/* Left Column: Writing Canvas (7 cols on lg, 8 on xl) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6 min-w-0">
          {/* Title input */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Article Title..."
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full text-2xl md:text-4xl font-bold tracking-tight bg-transparent border-0 border-b border-border/40 focus:border-primary focus:outline-none pb-2 text-foreground placeholder:text-muted-foreground/40"
            />

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
              <span className="font-mono">URL: /career-advice/{slug || "slug-preview"}</span>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <span>Category:</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-7 rounded border border-input bg-card px-2 text-xs font-medium text-foreground focus:outline-none"
                >
                  {DEFAULT_CAREER_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Excerpt input */}
          <div className="space-y-1.5 bg-card p-4 rounded-xl border border-border shadow-xs">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Card Excerpt / Hook</span>
              <span className="text-[10px] text-muted-foreground">{excerpt.length} / 200 chars</span>
            </label>
            <Textarea
              placeholder="A punchy 1-2 sentence preview to captivate readers on the landing page..."
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              maxLength={220}
              className="text-xs resize-none bg-background"
            />
          </div>

          {/* TipTap Rich Text Editor Surface */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Article Body & Content
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActiveInspectorTab("ai")}
                className="h-6 text-xs text-primary"
              >
                <Sparkles className="mr-1 h-3 w-3" /> Open Gemini Assistant
              </Button>
            </div>

            <TipTapEditor
              content={content}
              onChange={handleContentChange}
              onDropImageUpload={handleInlineImageDrop}
              onOpenImageUploadModal={() => setActiveInspectorTab("media")}
            />
          </div>
        </div>

        {/* Right Column: Settings & Inspector Sidebar (5 cols on lg, 4 on xl) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 min-w-0">
          {/* Inspector Tab Buttons */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-1 shadow-xs min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveInspectorTab("settings")}
              className={`flex-1 text-xs h-7 ${activeInspectorTab === "settings" ? "bg-muted font-semibold text-foreground shadow-xs" : "text-muted-foreground"}`}
            >
              Post
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveInspectorTab("seo")}
              className={`flex-1 text-xs h-7 ${activeInspectorTab === "seo" ? "bg-muted font-semibold text-foreground shadow-xs" : "text-muted-foreground"}`}
            >
              SEO
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveInspectorTab("media")}
              className={`flex-1 text-xs h-7 ${activeInspectorTab === "media" ? "bg-muted font-semibold text-foreground shadow-xs" : "text-muted-foreground"}`}
            >
              Media ({assets.length})
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveInspectorTab("ai")}
              className={`flex-1 text-xs h-7 text-primary ${activeInspectorTab === "ai" ? "bg-primary/10 font-semibold shadow-xs" : ""}`}
            >
              <Sparkles className="h-3 w-3 mr-1" /> AI
            </Button>
          </div>

          {/* Inspector Panel 1: Post Settings (Author, Status, Cover) */}
          {activeInspectorTab === "settings" && (
            <div className="space-y-4">
              {/* Cover Banner */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                <ImageUploader
                  label="Featured Hero Banner"
                  currentUrl={featuredImageUrl}
                  articleId={article?.article_id}
                  onUploaded={({ file_id, file_url }) => {
                    setFeaturedImageUrl(file_url);
                    setFeaturedImageId(file_id);
                  }}
                  onRemove={() => {
                    setFeaturedImageUrl(null);
                    setFeaturedImageId(null);
                  }}
                />

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground pt-2 border-t border-border/50">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                  />
                  Highlight in Top Landing Page Banner
                </label>
              </div>

              {/* Author & Publishing */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-primary" /> Author Byline
                </h4>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Author Name</label>
                  <Input
                    placeholder="e.g. Sarah Chen or VOS Career Team"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="text-xs h-8 bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Author Role / Title</label>
                  <Input
                    placeholder="e.g. Head of Talent Insights"
                    value={authorRole}
                    onChange={(e) => setAuthorRole(e.target.value)}
                    className="text-xs h-8 bg-background"
                  />
                </div>

                <div className="space-y-1 pt-2 border-t border-border/50">
                  <label className="text-[11px] text-muted-foreground">Publishing Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ArticleStatus)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="DRAFT">DRAFT (Hidden from landing page)</option>
                    <option value="PUBLISHED">PUBLISHED (Visible to readers)</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              {/* Markdown & Writing Shortcuts Cheat Sheet */}
              <MarkdownCheatsheetCard />
            </div>
          )}

          {/* Inspector Panel 2: SEO & Meta */}
          {activeInspectorTab === "seo" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-primary" /> Search Optimization
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveInspectorTab("ai")}
                    className="h-6 text-[11px] text-primary"
                  >
                    <Sparkles className="mr-1 h-3 w-3" /> Auto AI
                  </Button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                    <span>SEO Meta Title</span>
                    <span>{seoTitle.length} / 60</span>
                  </div>
                  <Input
                    placeholder="Custom Google title (defaults to article title)"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    maxLength={70}
                    className="text-xs h-8 bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                    <span>SEO Meta Description</span>
                    <span>{seoDescription.length} / 160</span>
                  </div>
                  <Textarea
                    placeholder="Snippet shown under search links..."
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    rows={3}
                    maxLength={180}
                    className="text-xs resize-none bg-background"
                  />
                </div>

                {/* Google Search Card Preview */}
                <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1 text-xs">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Google Search Preview</p>
                  <p className="text-blue-600 dark:text-blue-400 font-medium truncate">
                    {seoTitle || title || "Article Title Preview"} - LinkBridge
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-500 font-mono">
                    https://vos-sync.com/career-advice/{slug || "slug-preview"}
                  </p>
                  <p className="text-muted-foreground text-[11px] line-clamp-2">
                    {seoDescription || excerpt || "Your meta description or teaser excerpt will display here in search results."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Inspector Panel 3: Media & Asset Library */}
          {activeInspectorTab === "media" && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <ArticleAssetGallery
                assets={assets}
                onUploadNew={handleGalleryUpload}
                isUploading={isUploadingGallery}
                onSelectAsCover={(url, fileId) => {
                  setFeaturedImageUrl(url);
                  setFeaturedImageId(fileId);
                  setActiveInspectorTab("settings");
                }}
              />
            </div>
          )}

          {/* Inspector Panel 4: AI Writing Assistant */}
          {activeInspectorTab === "ai" && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <AiArticleAssistant
                currentTitle={title}
                currentContent={content}
                onApplyDraft={(draft) => {
                  if (draft.title) setTitle(draft.title);
                  if (draft.title && !slug) setSlug(generateSlug(draft.title));
                  if (draft.category) setCategory(draft.category);
                  if (draft.excerpt) setExcerpt(draft.excerpt);
                  if (draft.content) setContent(draft.content);
                  if (draft.seo_title) setSeoTitle(draft.seo_title);
                  if (draft.seo_description) setSeoDescription(draft.seo_description);
                  setAiGenerated(true);
                }}
                onApplySeo={(seo) => {
                  if (seo.seo_title) setSeoTitle(seo.seo_title);
                  if (seo.seo_description) setSeoDescription(seo.seo_description);
                  if (seo.excerpt && !excerpt) setExcerpt(seo.excerpt);
                  setActiveInspectorTab("seo");
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
