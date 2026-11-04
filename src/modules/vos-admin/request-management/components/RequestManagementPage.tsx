// src/modules/vos-admin/request-management/components/RequestManagementPage.tsx
//
// School-demand dashboard for unresolved school requests. The hook loads the
// Pending rows once; the pure selectors under `dashboard/` split them into the
// unrouted queue and the exact-school-id awaiting-account groups. One tab
// selection drives both the tab strip and the KPI cards, so exactly one demand
// section renders at a time. Group rows only summarize: the grouped table hands
// one exact group to the detail sheet, and every decision remains scoped to one
// concrete `school_request_id`.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRequests } from "../hooks/useRequests";
import {
  deriveSchoolDemandKpis,
  type AwaitingSchoolGroup,
} from "../dashboard/school-demand.selectors";
import { SchoolDemandKpis, type SchoolDemandKpiFilter } from "./SchoolDemandKpis";
import { KpiPending } from "@/components/shared/KpiValue";
import { UnroutedSchoolRequestsSection } from "./UnroutedSchoolRequestsSection";
import { SchoolDemandTable } from "./SchoolDemandTable";
import { SchoolDemandDetailSheet } from "./SchoolDemandDetailSheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SchoolDraftOutcome } from "../types/request.types";
import type { SchoolRequestsMode } from "./school-requests/school-request-mode";

/** Client-side mirror of the server-only education verification mode. Kept
 *  local (not imported) because the gate module is `server-only` and this is a
 *  client component; the server page passes the value down as a prop. */
export type RequestManagementMode = SchoolRequestsMode;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

/** Collapse internal whitespace and trim; empty collapses to null. */
function normalizeIdentityPart(value: string | null): string | null {
  if (value === null) return null;
  const collapsed = value.trim().replace(/\s+/g, " ");
  return collapsed === "" ? null : collapsed;
}

/** The three server-classified routes a draft outcome may carry. */
function isSchoolDraftRoute(value: unknown): value is SchoolDraftOutcome["verification_route"] {
  return value === "DIRECT_REVIEW" || value === "AWAITING_ACTIVATION" || value === "AWAITING_REGISTRATION";
}

/** Explicit fetch-boundary guard for the POST /api/vos-admin/schools success payload. */
function parseSchoolDraftOutcome(json: unknown): SchoolDraftOutcome | null {
  if (!isRecord(json)) return null;
  const school = json.school;
  if (!isRecord(school)) return null;
  const schoolId = school.school_id;
  if (typeof schoolId !== "number" || !Number.isInteger(schoolId)) return null;
  const schoolName = readStringField(school, "school_name");
  if (schoolName === null || schoolName.trim() === "") return null;
  const verificationRoute = school.verification_route;
  if (!isSchoolDraftRoute(verificationRoute)) return null;
  const reused = json.reused;
  if (typeof reused !== "boolean") return null;
  return {
    school_id: schoolId,
    school_name: schoolName,
    city_municipality: readStringField(school, "city_municipality"),
    province: readStringField(school, "province"),
    verification_route: verificationRoute,
    reused,
  };
}

interface Props {
  mode: RequestManagementMode;
}

export function RequestManagementPage({ mode }: Props) {
  const {
    schoolRequests,
    loading,
    error,
    fetchSchoolRequests,
    reviewSchoolRequest,
    generateSchoolInvite,
    decideSchoolRequest,
    searchSchoolsForRouting,
    schoolsForRouting,
    schoolSearchLoading,
    schoolSearchError,
    schoolFeedback,
    schoolDecisionBusy,
  } = useRequests();

  const [activeTab, setActiveTab] = useState<SchoolDemandKpiFilter>("unrouted");
  const [detailGroup, setDetailGroup] = useState<AwaitingSchoolGroup | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // Mount-time clock for the pure selector: age is whole days, so re-renders
  // need no newer clock, and render stays free of impure calls.
  const [now] = useState(() => Date.now());

  // The dashboard's single fetch site: only Pending unresolved demand loads.
  useEffect(() => {
    void fetchSchoolRequests("Pending");
  }, [fetchSchoolRequests]);

  const refetchSchools = useCallback(() => {
    void fetchSchoolRequests("Pending");
  }, [fetchSchoolRequests]);

  // Age comes from the newest rows; recomputed only when the rows change.
  const kpis = useMemo(() => deriveSchoolDemandKpis(schoolRequests, now), [schoolRequests, now]);

  // The cards and the tab pills both render these counts, so neither may show a
  // count until the first queue fetch has something to count.
  const kpisPending = loading && schoolRequests.length === 0;

  // Radix reports the selected value as a plain string; only the two known
  // filter values are accepted so the state stays a `SchoolDemandKpiFilter`.
  const handleTabChange = useCallback((value: string) => {
    if (value === "unrouted" || value === "awaiting-school") setActiveTab(value);
  }, []);

  const handleFilterSelect = useCallback((filter: SchoolDemandKpiFilter) => {
    setActiveTab(filter);
  }, []);

  const openDetail = useCallback((group: AwaitingSchoolGroup) => {
    setDetailGroup(group);
    setDetailOpen(true);
  }, []);

  /**
   * Guarded normalized draft-school creation via POST /api/vos-admin/schools.
   * Accepts both the legacy Add-modal shape ({requested_school_name,...}) and the
   * decision-dialog shape ({school_name,...}); both are normalized (trim + collapse
   * internal whitespace) before sending. Blank names are rejected locally. The
   * success payload is parsed with an explicit guard so callers can select the
   * created or reused school; any failure resolves null after toasting.
   */
  const createSchoolPlaceholder = useCallback(async (data: unknown): Promise<SchoolDraftOutcome | null> => {
    if (!isRecord(data)) {
      toast.error("School name must not be empty.");
      return null;
    }
    const rawName = readStringField(data, "school_name") ?? readStringField(data, "requested_school_name");
    const rawCity = readStringField(data, "city_municipality");
    const rawProvince = readStringField(data, "province");
    const school_name = rawName === null ? null : normalizeIdentityPart(rawName);
    if (school_name === null) {
      toast.error("School name must not be empty.");
      return null;
    }
    const body: Record<string, string> = { school_name };
    const city_municipality = normalizeIdentityPart(rawCity);
    const province = normalizeIdentityPart(rawProvince);
    if (city_municipality !== null) body.city_municipality = city_municipality;
    if (province !== null) body.province = province;
    try {
      const res = await fetch("/api/vos-admin/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json: unknown = await res.json();
        const message =
          isRecord(json) && typeof json.error === "string" ? json.error : "The school draft could not be created.";
        toast.error(message);
        return null;
      }
      const json: unknown = await res.json();
      const outcome = parseSchoolDraftOutcome(json);
      if (outcome === null) {
        toast.error("The school draft response was malformed.");
        return null;
      }
      toast.success(outcome.reused ? "Existing school found for this name." : "Draft school created.");
      refetchSchools();
      return outcome;
    } catch {
      toast.error("School storage is temporarily unavailable.");
      return null;
    }
  }, [refetchSchools]);

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 bg-secondary/10 motion-reduce:[&_.animate-pulse]:animate-none motion-reduce:[&_.animate-spin]:animate-none motion-reduce:[&_.animate-in]:animate-none">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Request Management</h1>
        <p className="text-muted-foreground mt-1">
          School requests that are not resolved yet. Match a request to a school, or set the school
          up if it is not in the system.
        </p>
      </div>

      <section aria-labelledby="school-demand-kpis-heading">
        <h2 id="school-demand-kpis-heading" className="sr-only">
          Unresolved demand summary
        </h2>
        <SchoolDemandKpis kpis={kpis} loading={kpisPending} onFilterSelect={handleFilterSelect} currentFilter={activeTab} />
      </section>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList
          aria-label="Unresolved school demand sections"
          className="bg-muted p-1 rounded-xl h-11 border border-border max-md:h-auto max-md:w-full"
        >
          <TabsTrigger
            value="unrouted"
            className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs flex items-center gap-2 max-md:min-h-11 max-md:whitespace-normal max-md:px-2 max-md:text-center motion-reduce:transition-none"
          >
            Unrouted requests
            <span
              className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums text-primary"
              data-testid="unrouted-request-count"
            >
              {kpisPending ? <KpiPending /> : kpis.unroutedCount}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="awaiting-school"
            className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs flex items-center gap-2 max-md:min-h-11 max-md:whitespace-normal max-md:px-2 max-md:text-center motion-reduce:transition-none"
          >
            Schools awaiting account
            <span className="inline-flex shrink-0 items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium tabular-nums text-warning">
              {kpisPending ? <KpiPending /> : kpis.awaitingSchoolCount}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unrouted" className="mt-0 focus-visible:outline-none">
          <UnroutedSchoolRequestsSection
            rows={schoolRequests}
            mode={mode}
            loading={loading}
            error={error}
            onRetry={refetchSchools}
            onCreate={createSchoolPlaceholder}
            onCreatePlaceholder={createSchoolPlaceholder}
            onReview={reviewSchoolRequest}
            onDecide={decideSchoolRequest}
            onSearchSchools={searchSchoolsForRouting}
            candidatesFor={(id) => schoolsForRouting[id] ?? []}
            candidatesLoadingFor={(id) => schoolSearchLoading[id] ?? false}
            candidatesErrorFor={(id) => schoolSearchError[id] ?? null}
            decisionBusyFor={(id) => schoolDecisionBusy[id] ?? false}
            feedbackFor={(id) => schoolFeedback[id]}
            onDecided={refetchSchools}
          />
        </TabsContent>

        <TabsContent value="awaiting-school" className="mt-0 focus-visible:outline-none">
          <section aria-labelledby="awaiting-account-heading" aria-busy={loading} className="space-y-4">
            <div className="space-y-1">
              <h2 id="awaiting-account-heading" className="sr-only">
                Schools awaiting account
              </h2>
              <p className="max-w-3xl text-sm text-muted-foreground">
                These requests have already been matched to a school that does not have an account
                yet. Each row shows how many requests are waiting for that school; open one to work
                on a single request.
              </p>
            </div>
            <SchoolDemandTable
              rows={schoolRequests}
              isLoading={loading}
              error={error}
              onRetry={refetchSchools}
              onViewRequests={openDetail}
            />
          </section>
        </TabsContent>
      </Tabs>

      <SchoolDemandDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        group={detailGroup}
        mode={mode}
        onSearchSchools={searchSchoolsForRouting}
        searchErrorFor={(id) => schoolSearchError[id] ?? null}
        feedbackFor={(id) => schoolFeedback[id]}
        decisionBusyFor={(id) => schoolDecisionBusy[id] ?? false}
        candidatesFor={(id) => schoolsForRouting[id] ?? []}
        candidatesLoadingFor={(id) => schoolSearchLoading[id] ?? false}
        candidatesErrorFor={(id) => schoolSearchError[id] ?? null}
        onReview={reviewSchoolRequest}
        onDecide={decideSchoolRequest}
        onCreatePlaceholder={createSchoolPlaceholder}
        onGenerateInvite={generateSchoolInvite}
        onDecided={refetchSchools}
      />
    </div>
  );
}
