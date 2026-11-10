// src/modules/career-advice/CareerAdvice.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Search,
  Clock,
  ChevronRight,
  TrendingUp,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PublicArticle {
  article_id: number;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  featured_image_url?: string | null;
  author_name: string;
  author_role: string;
  read_time_minutes: number;
  is_featured: boolean;
  published_at?: string | null;
  created_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Resume Tips": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  "Interview Prep": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  "Salary Guides": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  "Salary Guide": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  "Job Search": "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
  "Remote Work": "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20",
  "Career Change": "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
  "Career Strategy": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
  "Skill Building": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20",
  "Leadership": "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
  "Freelancing": "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/20",
};

const DEFAULT_CATEGORIES = [
  "All",
  "Resume Tips",
  "Interview Prep",
  "Salary Guides",
  "Career Strategy",
  "Remote Work",
  "Leadership",
  "Freelancing",
  "Job Search",
  "Skill Building",
];

export default function CareerAdvice() {
  const [articles, setArticles] = useState<PublicArticle[]>([]);
  const [featuredArticle, setFeaturedArticle] = useState<PublicArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    async function loadArticles() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCategory !== "All") params.append("category", selectedCategory);
        if (searchQuery.trim()) params.append("search", searchQuery.trim());
        params.append("limit", "20");

        const res = await fetch(`/api/public/career-articles?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setArticles(json.articles || []);
          if (json.featuredArticle) {
            setFeaturedArticle(json.featuredArticle);
          }
        }
      } catch (err) {
        console.error("Failed to load career advice articles:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadArticles();
  }, [selectedCategory, searchQuery]);

  // Compute live category article counts
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    articles.forEach((a) => {
      counts[a.category] = (counts[a.category] || 0) + 1;
    });
    return counts;
  }, [articles]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Recently added";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="text-foreground font-sans md:pt-16 min-h-screen">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide uppercase shadow-2xs mb-5">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Career Advice & Resources</span>
          </div>

          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6 max-w-4xl mx-auto leading-tight">
            Level up your{" "}
            <span className="text-primary underline decoration-primary/30 underline-offset-8">
              career game.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Expert articles, step-by-step guides, and real-world strategies for every stage of your career journey.
          </p>

          {/* Search Bar */}
          <div className="max-w-md mx-auto mb-8 relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search guides, resume tips, interview prep..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 text-xs rounded-full bg-card shadow-sm border-border"
            />
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
            {DEFAULT_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-medium transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "border-border/80 text-foreground bg-card hover:border-primary/50"
                  }`}
                >
                  {cat}
                  {cat !== "All" && categoryCounts[cat] !== undefined && (
                    <span className="opacity-70 text-[10px]">({categoryCounts[cat]})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURED SPOTLIGHT ARTICLE (Click navigates to full dedicated reader page) */}
      {featuredArticle && selectedCategory === "All" && !searchQuery && (
        <section className="py-10 md:py-14 border-t border-border/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Editor&apos;s Pick</p>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Featured Article</h2>
              </div>
            </div>

            <Link
              href={`/career-advice/${featuredArticle.slug}`}
              className="group block border border-border/80 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 bg-card"
            >
              <div className="grid grid-cols-1 lg:grid-cols-5">
                {/* Hero Visual */}
                <div className="lg:col-span-2 relative min-h-[220px] lg:min-h-[320px] bg-muted overflow-hidden">
                  {featuredArticle.featured_image_url ? (
                    <Image
                      src={featuredArticle.featured_image_url}
                      alt={featuredArticle.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 p-8 flex flex-col justify-between text-white">
                      <TrendingUp className="w-8 h-8 text-white" />
                      <div>
                        <p className="text-xs font-medium text-white/90">{featuredArticle.author_name}</p>
                        <p className="text-[11px] text-white/70">{featuredArticle.author_role}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="lg:col-span-3 p-6 md:p-10 flex flex-col justify-center">
                  <Badge
                    className={`w-fit mb-4 text-xs font-semibold ${
                      CATEGORY_COLORS[featuredArticle.category] || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {featuredArticle.category}
                  </Badge>

                  <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4 leading-snug group-hover:text-primary transition-colors">
                    {featuredArticle.title}
                  </h3>

                  <p className="text-muted-foreground mb-6 leading-relaxed line-clamp-3">
                    {featuredArticle.excerpt}
                  </p>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {featuredArticle.read_time_minutes} min read
                      </span>
                      <span>·</span>
                      <span>{formatDate(featuredArticle.published_at)}</span>
                      <span>·</span>
                      <span className="font-medium text-foreground">{featuredArticle.author_name}</span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all text-xs"
                    >
                      Read full article <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* ARTICLES GRID: INITIAL CARD VIEW (Clicking any card expands to dedicated page) */}
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
                {selectedCategory !== "All" ? selectedCategory : "Latest Releases"}
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {selectedCategory !== "All" ? `${selectedCategory} Articles` : "Recent Articles"}
              </h2>
            </div>
            {selectedCategory !== "All" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategory("All")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> View all
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="rounded-2xl border border-border p-5 space-y-4 animate-pulse bg-muted/20">
                  <div className="aspect-video bg-muted rounded-xl" />
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-full" />
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card">
              <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-foreground">No published articles found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                {searchQuery
                  ? `No articles match "${searchQuery}". Try a different keyword.`
                  : "New career advice guides and articles will be released soon."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <Link
                  key={article.article_id}
                  href={`/career-advice/${article.slug}`}
                  className="group border border-border/80 rounded-2xl overflow-hidden bg-card shadow-xs hover:shadow-lg hover:border-primary/40 transition-all duration-300 flex flex-col"
                >
                  {/* Article Card Thumbnail */}
                  <div className="relative aspect-video w-full bg-muted overflow-hidden">
                    {article.featured_image_url ? (
                      <Image
                        src={article.featured_image_url}
                        alt={article.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-primary/10 to-primary/5 text-primary">
                        <BookOpen className="w-8 h-8 opacity-40" />
                      </div>
                    )}
                    <Badge
                      className={`absolute top-3 left-3 text-[10px] font-semibold backdrop-blur-md shadow-xs ${
                        CATEGORY_COLORS[article.category] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {article.category}
                    </Badge>
                  </div>

                  {/* Article Card Details */}
                  <div className="p-5 flex flex-col flex-1 justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors leading-snug line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {article.excerpt}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{article.read_time_minutes} min</span>
                        <span>·</span>
                        <span className="truncate max-w-[100px]">{article.author_name}</span>
                      </div>
                      <span className="inline-flex items-center font-medium text-primary text-[11px] group-hover:translate-x-1 transition-transform">
                        Read <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
