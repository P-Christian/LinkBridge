"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpenCheck, ClipboardCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseRequestInboxPage } from "@/modules/school-admin/course-request-inbox/CourseRequestInboxPage";
import { SchoolRequestInboxPage } from "@/modules/school-admin/school-request-inbox/SchoolRequestInboxPage";

/**
 * Merged School Admin requests dashboard.
 *
 * One `activeTab` value drives the whole strip. Radix mounts only the selected
 * `TabsContent`, so exactly one inbox panel exists at a time: the hidden inbox
 * never fetches, renders, or holds decision state. Each inbox keeps its own
 * header, data hook, dialogs, and per-row feedback untouched. The shared tab
 * strip is rendered by the active inbox directly below its header card, so the
 * visual order is header card -> tab strip -> section content.
 */

const REQUEST_TAB_VALUES = ["school", "course"] as const;

type RequestTabValue = (typeof REQUEST_TAB_VALUES)[number];

function isRequestTabValue(value: string): value is RequestTabValue {
  return (REQUEST_TAB_VALUES as readonly string[]).includes(value);
}

export function SchoolAdminRequestsPage() {
  const [activeTab, setActiveTab] = useState<RequestTabValue>("school");
  const [counts, setCounts] = useState<{ school: number; course: number } | null>(null);

  const refreshCounts = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/school-admin/requests/summary", { cache: "no-store" });
      if (!res.ok) return;
      const body: unknown = await res.json();
      if (typeof body !== "object" || body === null) return;
      const { school, course } = body as { school?: unknown; course?: unknown };
      if (typeof school !== "number" || typeof course !== "number") return;
      setCounts({ school, course });
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refreshCounts awaits the fetch and sets counts only in its async callback
    void refreshCounts();
  }, [refreshCounts, activeTab]);

  // Radix reports the selected value as a plain string; only the two known
  // tab values are accepted so the state stays a `RequestTabValue`.
  const handleTabChange = useCallback((value: string) => {
    if (isRequestTabValue(value)) setActiveTab(value);
  }, []);

  // The strip is declared once here and rendered by the active inbox directly
  // below its own header card. Radix mounts only the selected `TabsContent`,
  // so exactly one strip is on screen at a time.
  const requestTabs = (
    <TabsList
      aria-label="Request types"
      className="bg-muted p-1 rounded-xl h-11 border border-border max-md:h-auto max-md:w-full"
    >
      <TabsTrigger
        value="school"
        className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs flex items-center gap-2 max-md:min-h-11 max-md:whitespace-normal max-md:px-2 max-md:text-center motion-reduce:transition-none"
      >
        <ClipboardCheck className="w-3.5 h-3.5" />
        School Requests
        {counts !== null ? (
          <Badge variant="secondary" className="h-4 min-w-4 rounded-full px-1.5 text-[10px] font-bold">
            {counts.school}
          </Badge>
        ) : null}
      </TabsTrigger>
      <TabsTrigger
        value="course"
        className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs flex items-center gap-2 max-md:min-h-11 max-md:whitespace-normal max-md:px-2 max-md:text-center motion-reduce:transition-none"
      >
        <BookOpenCheck className="w-3.5 h-3.5" />
        Course Requests
        {counts !== null ? (
          <Badge variant="secondary" className="h-4 min-w-4 rounded-full px-1.5 text-[10px] font-bold">
            {counts.course}
          </Badge>
        ) : null}
      </TabsTrigger>
    </TabsList>
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="space-y-6"
      data-testid="school-admin-requests"
    >
      <TabsContent value="school" className="mt-0 space-y-6 focus-visible:outline-none">
        <SchoolRequestInboxPage belowHeader={requestTabs} onCountsChanged={refreshCounts} />
      </TabsContent>

      <TabsContent value="course" className="mt-0 space-y-6 focus-visible:outline-none">
        <CourseRequestInboxPage belowHeader={requestTabs} onCountsChanged={refreshCounts} />
      </TabsContent>
    </Tabs>
  );
}
