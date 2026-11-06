// src/modules/vos-admin/career-advice-management/components/ArticleEditorModal.tsx
"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TipTapEditor } from "./TipTapEditor";
import { ImageUploader } from "./ImageUploader";
import { ArticleAssetGallery } from "./ArticleAssetGallery";
import { AiArticleAssistant } from "./AiArticleAssistant";
import { DEFAULT_CAREER_CATEGORIES, generateSlug, calculateReadTime } from "../services/article.helpers";
import { CareerArticle, ArticleStatus, ArticleAsset } from "../types/article.types";
import { CreateCareerArticleInput } from "../types/article.schema";
import { Sparkles, Image as ImageIcon, Globe, FileText, UserCheck, Loader2 } from "lucide-react";
import { useUserProfile } from "@/components/shared/providers/UserProfileProvider";

interface ArticleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: CareerArticle | null;
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

export function ArticleEditorModal({
  isOpen,
  onClose,
  article,
  onSave,
  onUploadMedia,
  isSubmitting,
}: ArticleEditorModalProps) {
  const profile = useUserProfile();

  const [activeTab, setActiveTab] = useState<string>("content");

  // Form State
  const [prevArticleId, setPrevArticleId] = useState<number | undefined | null>(article?.article_id);
  const [prevIsOpen, setPrevIsOpen] = useState<boolean>(isOpen);
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

  // Synchronize or reset form when modal opens or article changes
  if (article?.article_id !== prevArticleId || (isOpen && !prevIsOpen)) {
    setPrevArticleId(article?.article_id);
    setPrevIsOpen(isOpen);
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
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  // Auto-generate slug when title changes (only for new articles or if slug wasn't manually customized)
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!article) {
      setSlug(generateSlug(val));
    }
  };

  // Auto-update read time when content changes
  const handleContentChange = (html: string) => {
    setContent(html);
    const calculated = calculateReadTime(html);
    setReadTime(calculated);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      return;
    }

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
      status,
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-foreground">
              {article ? "Edit Career Article" : "Create Career Article"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="border-b border-border bg-muted/30 px-4">
            <TabsList className="bg-transparent h-10 p-0 gap-2">
              <TabsTrigger
                value="content"
                className="data-[state=active]:bg-background data-[state=active]:shadow-xs text-xs gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" /> Content
              </TabsTrigger>
              <TabsTrigger
                value="author"
                className="data-[state=active]:bg-background data-[state=active]:shadow-xs text-xs gap-1.5"
              >
                <UserCheck className="h-3.5 w-3.5" /> Author & Publishing
              </TabsTrigger>
              <TabsTrigger
                value="seo"
                className="data-[state=active]:bg-background data-[state=active]:shadow-xs text-xs gap-1.5"
              >
                <Globe className="h-3.5 w-3.5" /> SEO & Meta
              </TabsTrigger>
              <TabsTrigger
                value="media"
                className="data-[state=active]:bg-background data-[state=active]:shadow-xs text-xs gap-1.5"
              >
                <ImageIcon className="h-3.5 w-3.5" /> Media Library ({assets.length})
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="data-[state=active]:bg-background data-[state=active]:shadow-xs text-xs gap-1.5 text-primary font-medium"
              >
                <Sparkles className="h-3.5 w-3.5" /> AI Assistant
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Tab 1: Content */}
            <TabsContent value="content" className="m-0 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Article Title <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="e.g. 7 Resume Mistakes That Get You Ignored Instantly"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">URL Slug</label>
                  <Input
                    placeholder="e.g. 7-resume-mistakes"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {DEFAULT_CAREER_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Read Time (min)</label>
                  <Input
                    type="number"
                    min={1}
                    value={readTime}
                    onChange={(e) => setReadTime(Number(e.target.value))}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Card Excerpt / Teaser <span className="text-destructive">*</span>
                </label>
                <Textarea
                  placeholder="Short 1-2 sentence preview shown on article cards..."
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Article Body <span className="text-destructive">*</span>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("ai")}
                    className="h-6 text-[11px] text-primary"
                  >
                    <Sparkles className="mr-1 h-3 w-3" /> Assist with AI
                  </Button>
                </div>
                <TipTapEditor
                  content={content}
                  onChange={handleContentChange}
                  onOpenImageUploadModal={() => setActiveTab("media")}
                />
              </div>
            </TabsContent>

            {/* Tab 2: Author & Publishing */}
            <TabsContent value="author" className="m-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Author Display Name</label>
                  <Input
                    placeholder="e.g. Sarah Chen or VOS Career Team"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">The public byline shown on the article.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Author Role / Title</label>
                  <Input
                    placeholder="e.g. Head of Talent Insights"
                    value={authorRole}
                    onChange={(e) => setAuthorRole(e.target.value)}
                    className="text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">Subtitle shown beside the author name.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Publication Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ArticleStatus)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="DRAFT">DRAFT (Hidden from landing page)</option>
                    <option value="PUBLISHED">PUBLISHED (Visible to readers)</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    Feature in Landing Page Hero Banner
                  </label>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <ImageUploader
                  label="Featured Cover Banner"
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
              </div>
            </TabsContent>

            {/* Tab 3: SEO & Meta */}
            <TabsContent value="seo" className="m-0 space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Search Engine Optimization</h4>
                  <p className="text-[11px] text-muted-foreground">Customize how this post appears in Google and social shares.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("ai")}
                  className="h-7 text-xs text-primary"
                >
                  <Sparkles className="mr-1 h-3 w-3" /> Auto-Generate with AI
                </Button>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-foreground">SEO Meta Title</label>
                  <span className="text-[10px] text-muted-foreground">{seoTitle.length} / 60 chars</span>
                </div>
                <Input
                  placeholder="Custom title for Google search results (defaults to article title if empty)"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  maxLength={70}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-foreground">SEO Meta Description</label>
                  <span className="text-[10px] text-muted-foreground">{seoDescription.length} / 160 chars</span>
                </div>
                <Textarea
                  placeholder="Summary shown beneath link in search engines..."
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={3}
                  maxLength={180}
                  className="text-xs"
                />
              </div>

              {/* SERP Preview */}
              <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Google Search Preview</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate">
                  {seoTitle || title || "Article Title Preview"} - LinkBridge
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-500 font-mono">
                  https://linkbridge.com/career-advice/{slug || "slug-preview"}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {seoDescription || excerpt || "Your meta description or excerpt will display here in search results."}
                </p>
              </div>
            </TabsContent>

            {/* Tab 4: Media Library */}
            <TabsContent value="media" className="m-0 space-y-4">
              <ArticleAssetGallery
                assets={assets}
                onUploadNew={handleGalleryUpload}
                isUploading={isUploadingGallery}
                onSelectAsCover={(url, fileId) => {
                  setFeaturedImageUrl(url);
                  setFeaturedImageId(fileId);
                  setActiveTab("author");
                }}
              />
            </TabsContent>

            {/* Tab 5: AI Assistant */}
            <TabsContent value="ai" className="m-0 space-y-4">
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
                  setActiveTab("content");
                }}
                onApplySeo={(seo) => {
                  if (seo.seo_title) setSeoTitle(seo.seo_title);
                  if (seo.seo_description) setSeoDescription(seo.seo_description);
                  if (seo.excerpt && !excerpt) setExcerpt(seo.excerpt);
                  setActiveTab("seo");
                }}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Estimated: <span className="font-semibold text-foreground">{readTime} min read</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSubmitting || !title.trim() || !content.trim()}
              className="bg-primary text-primary-foreground shadow-xs"
            >
              {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {article ? "Update Article" : "Save Article"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
