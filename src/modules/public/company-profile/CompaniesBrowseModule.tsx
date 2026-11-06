"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Search, MapPin, SlidersHorizontal, Loader2, Check, Building2, Briefcase, DollarSign, MessageSquare, Filter, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PublicCompanyProfile, TrustedCompany } from "./types";
import { TrustedEmployersMarquee } from "./components/TrustedEmployersMarquee";
import { CompanyBrowseCard } from "./components/CompanyBrowseCard";
import { CompanyBrowseSkeleton } from "./components/CompanyBrowseSkeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface BrowseModuleProps {
  initialCompanies: PublicCompanyProfile[];
  initialTotal: number;
  industries: { industry_id: number; industry_name: string }[];
  sizes: { company_size_id: number; company_size_name: string }[];
  trustedCompanies: TrustedCompany[];
}

export default function CompaniesBrowseModule({
  initialCompanies,
  initialTotal,
  industries,
  sizes,
  trustedCompanies,
}: BrowseModuleProps) {
  // Search states
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedLocation, setAppliedLocation] = useState("");
  const [industry, setIndustry] = useState("ALL");
  const [size, setSize] = useState("ALL");
  const [activeJobsOnly, setActiveJobsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Loaded data state
  const [companies, setCompanies] = useState<PublicCompanyProfile[]>(initialCompanies);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);

  const limit = 10;
  const totalPages = Math.ceil(total / limit);

  // Industry & Size options formatted for SearchableSelect
  const industryOptions = useMemo(() => {
    return [
      { value: "ALL", label: "All Industries" },
      ...industries.map((ind) => ({
        value: String(ind.industry_id),
        label: ind.industry_name,
      })),
    ];
  }, [industries]);

  const sizeOptions = useMemo(() => {
    return [
      { value: "ALL", label: "All Sizes" },
      ...sizes.map((s) => ({
        value: String(s.company_size_id),
        label: s.company_size_name,
      })),
    ];
  }, [sizes]);

  // Trigger AJAX data fetching with minimum 250ms threshold for smooth shimmer
  const fetchCompanies = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const params = new URLSearchParams();
      if (appliedSearch.trim()) params.append("search", appliedSearch.trim());
      if (appliedLocation.trim()) params.append("location", appliedLocation.trim());
      if (industry !== "ALL") params.append("industry", industry);
      if (size !== "ALL") params.append("size", size);
      if (activeJobsOnly) params.append("activeJobsOnly", "true");
      params.append("page", String(page));
      params.append("limit", String(limit));

      const res = await fetch(`/api/public/companies?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();

        const elapsed = Date.now() - startTime;
        if (elapsed < 250) {
          await new Promise((r) => setTimeout(r, 250 - elapsed));
        }

        setCompanies(json.companies || []);
        setTotal(json.total || 0);
      }
    } catch (e) {
      console.error("Failed to fetch companies:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time filter trigger (fires only on committed search and filter changes)
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, appliedLocation, industry, size, activeJobsOnly, page]);


  // Handle manual submit search triggers
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search);
    setAppliedLocation(location);
    setPage(1);
  };

  const activeFilterCount =
    (appliedSearch.trim() ? 1 : 0) +
    (appliedLocation.trim() ? 1 : 0) +
    (industry !== "ALL" ? 1 : 0) +
    (size !== "ALL" ? 1 : 0) +
    (activeJobsOnly ? 1 : 0);

  const handleResetFilters = () => {
    setSearch("");
    setLocation("");
    setAppliedSearch("");
    setAppliedLocation("");
    setIndustry("ALL");
    setSize("ALL");
    setActiveJobsOnly(false);
    setPage(1);
  };


  // Single source of truth for the filter panel: rendered inline at >=768px and inside the mobile sheet below md.
  const filterPanel = (
    <>
      <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
        <span className="font-bold text-foreground flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          Filters
        </span>
        <button
          onClick={handleResetFilters}
          className="text-xs font-semibold text-primary hover:underline cursor-pointer max-md:inline-flex max-md:items-center max-md:min-h-6 max-md:px-2 max-md:-mx-2 rounded-md"
        >
          Clear all
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="space-y-6">
        {/* Search text */}
        <div>
          <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-2">
            Company Name
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl"
            />
          </div>
        </div>

        {/* Location filter */}
        <div>
          <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-2">
            City Location
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="e.g. Malolos..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-9 h-10 rounded-xl"
            />
          </div>
        </div>

        {/* Industry Searchable Dropdown */}
        <div>
          <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-2">
            Industry
          </label>
          <SearchableSelect
            options={industryOptions}
            value={industry}
            onValueChange={(val) => {
              setIndustry(val);
              setPage(1);
            }}
            placeholder="Search industry..."
            className="h-10 rounded-xl text-xs font-medium"
          />
        </div>

        {/* Size Searchable Dropdown */}
        <div>
          <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-2">
            Company Size
          </label>
          <SearchableSelect
            options={sizeOptions}
            value={size}
            onValueChange={(val) => {
              setSize(val);
              setPage(1);
            }}
            placeholder="Search company size..."
            className="h-10 rounded-xl text-xs font-medium"
          />
        </div>

        {/* Active Jobs Only — the whole row is the control so the touch target is the row, not the 20px box */}
        <button
          type="button"
          role="switch"
          aria-checked={activeJobsOnly}
          onClick={() => {
            setActiveJobsOnly(!activeJobsOnly);
            setPage(1);
          }}
          className="w-full pt-2 border-t border-border flex items-center justify-between cursor-pointer group"
        >
          <span className="text-xs font-bold text-foreground uppercase tracking-wider select-none text-left">
            Has Active Jobs Only
          </span>
          <span
            className={`w-5 h-5 max-md:w-6 max-md:h-6 rounded border flex items-center justify-center transition-all ${activeJobsOnly
                ? "bg-primary border-primary text-primary-foreground"
                : "border-input group-hover:border-zinc-400 bg-background"
              }`}
          >
            {activeJobsOnly && <Check className="w-3.5 h-3.5 max-md:w-4 max-md:h-4 stroke-[3px]" />}
          </span>
        </button>

        <Button type="submit" disabled={isLoading} className="w-full h-10 rounded-xl font-medium shadow-sm cursor-pointer gap-2">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {isLoading ? "Searching..." : "Apply Search"}
        </Button>
      </form>
    </>
  );

  return (
    <div className="w-full pb-20 font-sans">
      {/* 1. Header Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 md:pt-12 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          Get the full picture before you apply
        </h1>
        <p className="text-muted-foreground mt-4 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Learn about company culture, explore open roles, and discover what it&apos;s like to work there before making your next career move.
        </p>
      </div>

      {/* 2. Marquee section */}
      <div className="mt-8 md:mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4 text-center">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
            Trusted employers hiring on LinkBridge
          </p>
        </div>
        <TrustedEmployersMarquee companies={trustedCompanies} />
      </div>


      {/* Browse Container + Research Guide — listings lead on mobile, the guide leads on md+ */}
      <div className="flex flex-col">
        {/* Main Browse Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 max-md:mt-10 md:order-2">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Find a company that&apos;s right for you
              </h2>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                Explore verified employers and discover opportunities that align with your career goals, values, and expectations.
              </p>
            </div>
            <div className="text-sm font-semibold text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border select-none">
              Showing {companies.length} of {total} {total === 1 ? "Company" : "Companies"}
            </div>
          </div>

          {/* 2. Filters & Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Mobile filter trigger (below md only; the inline panel stays at >=768px) */}
            <div className="md:hidden">
              <Button
                type="button"
                onClick={() => setIsFilterSheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={isFilterSheetOpen}
                className="w-full h-11 justify-between text-sm font-semibold shadow-sm cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </span>
                <span className="flex items-center gap-2">
                  {activeFilterCount > 0 && (
                    <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4" />
                </span>
              </Button>
            </div>

            {/* Filters Sidebar (inline at >=768px; below md the same panel renders in the sheet) */}
            <div className="hidden md:block lg:col-span-1 bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] h-fit sticky top-24">
              {filterPanel}
            </div>

            {/* Results List */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading-skeletons"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-6"
                  >
                    {[1, 2, 3, 4].map((i) => (
                      <CompanyBrowseSkeleton key={i} />
                    ))}
                  </motion.div>
                ) : companies.length === 0 ? (
                  <motion.div
                    key="empty-companies"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col items-center justify-center border border-dashed rounded-3xl py-20 px-4 bg-muted/10 text-center"
                  >
                    <SlidersHorizontal className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-bold text-foreground mb-1">No employers found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      We couldn&apos;t find any companies matching your filter criteria. Try adjusting your settings.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleResetFilters}
                      className="mt-6 rounded-xl font-semibold cursor-pointer"
                    >
                      Reset all filters
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`companies-grid-${appliedSearch}-${appliedLocation}-${industry}-${size}-${page}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col gap-6"
                  >
                    {/* Company Browse Cards */}
                    <div className="flex flex-col gap-6">
                      {companies.map((c, idx) => (
                        <CompanyBrowseCard key={c.company_id} company={c} index={idx} />
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between border-t border-border pt-6 mt-4">
                        <Button
                          variant="outline"
                          disabled={page === 1 || isLoading}
                          onClick={() => setPage((p) => Math.max(p - 1, 1))}
                          className="rounded-xl font-medium cursor-pointer"
                        >
                          Previous
                        </Button>
                        <span className="text-sm font-semibold text-muted-foreground">
                          Page {page} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          disabled={page === totalPages || isLoading}
                          onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                          className="rounded-xl font-medium cursor-pointer"
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 3. Mobile Filter Sheet (below md only; the inline panel stays at >=768px) */}
          <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
            <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto overscroll-contain p-0 pb-4">
              <SheetHeader className="border-b pb-3">
                <SheetTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" />
                  Filter Companies
                </SheetTitle>
              </SheetHeader>
              <div className="px-4 pt-4">{filterPanel}</div>
            </SheetContent>
          </Sheet>
        </div>
        {/* 3. Research Experience Guide Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 border-b border-border mb-10 md:mb-16 md:order-1">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 items-start">
            <div className="lg:sticky lg:top-24">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Explore companies with confidence
              </h2>
              <p className="text-muted-foreground mt-3 text-sm sm:text-base leading-relaxed">
                Get to know potential employers in one place — from their mission and workplace culture to open positions and employee insights.
              </p>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* About Card */}
              <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">About</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed mt-1">
                    Learn what the company does, what it stands for, where it&apos;s located, and the story behind its organization.
                  </p>
                </div>
              </div>

              {/* Life & Culture Card */}
              <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">

                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Life & Culture</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed mt-1">
                    Discover the company&apos;s values, workplace culture, benefits, and what they aim to offer their people.
                  </p>
                </div>
              </div>

              {/* Open Jobs Card */}
              <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Open Jobs</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed mt-1">
                    Explore current opportunities, compare roles, and find positions that match your skills, experience, and career goals.
                  </p>
                </div>
              </div>

              {/* Salary Insights Card */}
              <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Salary Insights</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed mt-1">
                    Get a better understanding of compensation expectations and make more informed career decisions.
                  </p>
                </div>
              </div>

              {/* Employee Reviews Card */}
              <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 flex gap-4 sm:col-span-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Employee Reviews</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed mt-1">
                    Hear from people with experience at the company and gain additional perspectives before you apply.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

