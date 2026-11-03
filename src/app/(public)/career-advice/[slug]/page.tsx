// src/app/(public)/career-advice/[slug]/page.tsx
import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatAssetUrl } from "@/lib/utils";
import { sanitizeArticleHtml } from "@/lib/sanitize-html";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Calendar, BookOpen } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

async function fetchArticleBySlug(slug: string) {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (DIRECTUS_TOKEN) headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;

    const queryParams = new URLSearchParams({
      "filter[slug][_eq]": slug,
      "filter[status][_eq]": "PUBLISHED",
      limit: "1",
    });

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_career_articles?${queryParams.toString()}`, {
      headers,
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;
    const json = await res.json();
    const article = json.data?.[0];
    if (!article) return null;

    return {
      ...article,
      featured_image_url: formatAssetUrl(article.featured_image_url) || article.featured_image_url,
    };
  } catch (err) {
    console.error("Error fetching article by slug:", err);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticleBySlug(slug);

  if (!article) {
    return {
      title: "Article Not Found | VOS Sync",
    };
  }

  return {
    title: `${article.seo_title || article.title} | VOS Sync Career Advice`,
    description: article.seo_description || article.excerpt,
    openGraph: {
      title: article.seo_title || article.title,
      description: article.seo_description || article.excerpt,
      images: article.featured_image_url ? [article.featured_image_url] : [],
      type: "article",
      publishedTime: article.published_at || article.created_at,
      authors: [article.author_name],
    },
  };
}

export default async function ArticleReaderPage({ params }: PageProps) {
  const { slug } = await params;
  const article = await fetchArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const publishedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : new Date(article.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

  return (
    <article className="min-h-screen bg-background text-foreground pt-24 pb-20 md:pt-32 md:pb-28">
      {/* Top Navigation Bar */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mb-8">
        <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground hover:text-foreground -ml-2 mb-4">
          <Link href="/career-advice">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Career Advice
          </Link>
        </Button>

        {/* Category & Read Time */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5">
            {article.category}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
            <Clock className="h-3 w-3" /> {article.read_time_minutes} min read
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {publishedDate}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15] mb-6">
          {article.title}
        </h1>

        {/* Subtitle / Excerpt */}
        {article.excerpt && (
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-normal mb-8 border-l-2 border-primary/40 pl-4 italic">
            {article.excerpt}
          </p>
        )}

        {/* Author Byline */}
        <div className="flex items-center justify-between border-y border-border/60 py-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {article.author_name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{article.author_name}</p>
              <p className="text-xs text-muted-foreground">{article.author_role || "Career Specialist"}</p>
            </div>
          </div>
        </div>

        {/* Hero Cover Banner (Full-Width of container) */}
        {article.featured_image_url && (
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border shadow-md mb-10 bg-muted">
            <Image
              src={article.featured_image_url}
              alt={article.title}
              fill
              className="object-cover"
              priority
              unoptimized
            />
          </div>
        )}

        {/* TipTap Rich HTML Body Content */}
        <div
          className="prose prose-base sm:prose-lg dark:prose-invert max-w-none leading-relaxed text-foreground/90
            [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-10 [&_h1]:mb-4
            [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4
            [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2
            [&_p]:mb-5 [&_p]:leading-relaxed
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-5
            [&_blockquote]:border-l-4 [&_blockquote]:border-cyan-500 [&_blockquote]:bg-cyan-500/10 dark:[&_blockquote]:bg-cyan-950/20 [&_blockquote]:p-5 [&_blockquote]:rounded-r-xl [&_blockquote]:italic [&_blockquote]:my-6 [&_blockquote]:text-foreground/95
            [&_img]:rounded-xl [&_img]:my-8 [&_img]:w-full [&_img]:shadow-md [&_img]:border [&_img]:border-border
            [&_table]:w-full [&_table]:border-collapse [&_table]:my-6 [&_table]:border [&_table]:border-border
            [&_th]:border [&_th]:border-border [&_th]:bg-muted/70 [&_th]:p-3 [&_th]:text-left [&_th]:font-semibold
            [&_td]:border [&_td]:border-border [&_td]:p-3
            [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:my-6
            [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs"
          dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(article.content) }}
        />

        {/* Bottom Navigation */}
        <div className="mt-14 pt-8 border-t border-border flex items-center justify-between">
          <Button variant="outline" size="sm" asChild className="text-xs">
            <Link href="/career-advice">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Career Advice
            </Link>
          </Button>

          <Button variant="secondary" size="sm" asChild className="text-xs">
            <Link href="/find-jobs">
              Explore Tech Jobs <BookOpen className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
