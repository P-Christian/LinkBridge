"use client";

import React, { useEffect, useState } from 'react';
import { useFreelancerApplications } from './hooks/useFreelancerApplications';
import { useRealtime } from '@/modules/shared/providers/RealtimeProvider';
import { ApplicationHeader } from './components/ApplicationHeader';
import { ApplicationSummaryCards } from './components/ApplicationSummaryCards';
import { ApplicationTable } from './components/ApplicationTable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFreelancerBookmarks } from './hooks/useFreelancerBookmarks';
import { BookmarkList } from './components/BookmarkList';
import { BookmarkHeader } from './components/BookmarkHeader';
import { Input } from '@/components/ui/input';
import { Search, ClipboardList, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangeFilter } from './components/application-table/DateRangeFilter';

interface FreelancerApplicationsPageProps {
  defaultTab?: "applications" | "bookmarks";
}

const FreelancerApplicationsPage: React.FC<FreelancerApplicationsPageProps> = ({ 
  defaultTab = "applications" 
}) => {
  const {
    applications,
    summary,
    loading,
    fetchApplications,
    filterStatus,
    setFilterStatus,
    dateFilter,
    setDateFilter,
    statusOptions,
  } = useFreelancerApplications();

  const { subscribe } = useRealtime();

  useEffect(() => {
    const unsubscribe = subscribe("vs_job_application", ({ data }) => {
      if (data && data.length > 0) {
        fetchApplications();
      }
    });
    return () => unsubscribe();
  }, [subscribe, fetchApplications]);

  const {
    bookmarks,
    loading: bookmarksLoading,
    fetchBookmarks,
    removeBookmark,
  } = useFreelancerBookmarks();

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [bookmarkSearch, setBookmarkSearch] = useState("");
  const [applicationSearch, setApplicationSearch] = useState("");

  const filteredBookmarks = bookmarks.filter((bookmark) => {
    const query = bookmarkSearch.toLowerCase();
    return (
      (bookmark.job_title?.toLowerCase() || "").includes(query) ||
      (bookmark.company_name?.toLowerCase() || "").includes(query)
    );
  });

  // Read URL query parameter safely on mount to check if we should default to Bookmarks tab
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "saved") {
        Promise.resolve().then(() => {
          setActiveTab("bookmarks");
        });
      }
    }
  }, []);

  useEffect(() => {
    fetchApplications();
    fetchBookmarks();
  }, [fetchApplications, fetchBookmarks]);

  return (
    <div className="w-full p-4 sm:p-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-emerald-950 via-zinc-900 to-teal-950 dark:from-black dark:via-zinc-950 dark:to-zinc-900 text-white p-6 sm:p-8 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 h-40 w-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-white/10 backdrop-blur rounded-2xl border border-white/20">
            <ClipboardList className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Applications & Saved Jobs</h1>
            <p className="text-sm text-zinc-300 mt-1">
              Track your active job applications and manage bookmarked opportunities.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "applications" | "bookmarks")} className="w-full">
        <TabsList className="mb-6 bg-muted/60 p-1 border max-md:min-h-11">
          <TabsTrigger value="applications" className="px-4 py-2 font-semibold max-md:min-h-11">
            Job Applications
          </TabsTrigger>
          <TabsTrigger value="bookmarks" className="px-4 py-2 font-semibold max-md:min-h-11">
            Saved Jobs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="outline-none">
          <ApplicationHeader 
            totalOpportunities={summary.totalApplied} 
          />
          <ApplicationSummaryCards summary={summary} />

          {/* Mobile-only filter bar: search + status + date */}
          <div className="md:hidden mb-4 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search applications..."
                value={applicationSearch}
                onChange={(e) => setApplicationSearch(e.target.value)}
                className="rounded-lg pl-8 h-11 text-base"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={filterStatus}
                onValueChange={(val) => setFilterStatus(val)}
              >
                <SelectTrigger className="w-full max-md:min-h-11">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <SelectValue placeholder="Filter by status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DateRangeFilter
                value={dateFilter}
                onChange={setDateFilter}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 bg-card rounded-xl border shadow-sm mb-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-zinc-400 animate-pulse">Loading applications...</span>
            </div>
          ) : (
            <div className="mb-8">
              <ApplicationTable
                applications={applications}
                onRefresh={fetchApplications}
                mobileSearch={applicationSearch}
                filterStatus={filterStatus}
                onFilterChange={setFilterStatus}
                statusOptions={statusOptions}
                dateFilter={dateFilter}
                onDateFilterChange={setDateFilter}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="bookmarks" className="outline-none">
          <BookmarkHeader />

          <div className="mb-6 max-w-sm">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground max-md:top-1/2 max-md:-translate-y-1/2" />
              <Input
                placeholder="Search saved jobs..."
                value={bookmarkSearch}
                onChange={(e) => setBookmarkSearch(e.target.value)}
                className="rounded-lg pl-8 max-md:h-11"
              />
            </div>
          </div>

          {bookmarksLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 bg-card rounded-xl border shadow-sm mb-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-zinc-400 animate-pulse">Loading saved jobs...</span>
            </div>
          ) : (
            <div className="mb-8">
              <BookmarkList 
                bookmarks={filteredBookmarks} 
                onRemoveBookmark={removeBookmark} 
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FreelancerApplicationsPage;
