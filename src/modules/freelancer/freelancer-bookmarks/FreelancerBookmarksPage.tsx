// src/modules/freelancer/freelancer-bookmarks/FreelancerBookmarksPage.tsx
"use client";

import React, { useEffect } from 'react';
import { useFreelancerBookmarks } from './hooks/useFreelancerBookmarks';
import { BookmarkHeader } from './components/BookmarkHeader';
import { BookmarkList } from './components/BookmarkList';

const FreelancerBookmarksPage: React.FC = () => {
  const {
    bookmarks,
    loading,
    fetchBookmarks,
    removeBookmark,
  } = useFreelancerBookmarks();

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  return (
    <div className="w-full p-4 sm:p-8">
      <BookmarkHeader />

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 bg-card rounded-xl border shadow-sm mb-6 max-md:py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-zinc-400 animate-pulse">Loading saved jobs...</span>
        </div>
      ) : (
        <BookmarkList bookmarks={bookmarks} onRemoveBookmark={removeBookmark} />
      )}
    </div>
  );
};

export default FreelancerBookmarksPage;
