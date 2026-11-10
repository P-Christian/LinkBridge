"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function HomeSearchBar() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) {
      params.set("q", keyword.trim());
    }
    if (location.trim()) {
      params.set("location", location.trim());
    }
    const query = params.toString();
    router.push(query ? `/find-jobs?${query}` : "/find-jobs");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-4xl mx-auto bg-white/90 dark:bg-card/75 backdrop-blur-xl p-2 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-border/80 flex flex-col md:flex-row gap-2 relative z-10"
      role="search"
      aria-label="Find jobs search"
    >
      <div className="flex-1 flex items-center px-4 py-2 min-h-10 md:min-h-0 border-b md:border-b-0 md:border-r border-border">
        <Search className="w-5 h-5 text-muted-foreground mr-3 shrink-0" />
        <Input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Job title, keywords, or company"
          className="border-0 shadow-none focus-visible:ring-0 px-0 text-base h-auto py-1 bg-transparent"
        />
      </div>
      <div className="flex-1 flex items-center px-4 py-2 min-h-10 md:min-h-0">
        <MapPin className="w-5 h-5 text-muted-foreground mr-3 shrink-0" />
        <Input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, state, or 'Remote'"
          className="border-0 shadow-none focus-visible:ring-0 px-0 text-base h-auto py-1 bg-transparent"
        />
      </div>
      <Button
        type="submit"
        size="lg"
      
        className="rounded-xl w-full md:w-auto px-8 py-6 text-base shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Search Jobs
      </Button>
    </form>
  );
}
