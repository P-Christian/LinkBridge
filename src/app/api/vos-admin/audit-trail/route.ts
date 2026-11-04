// src/app/api/vos-admin/audit-trail/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchAuditLogsRepo, fetchAuditKPIsRepo, createAuditRecordStrictRepo, AuditFilters } from "@/modules/vos-admin/audit-trail";
import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PAGE_LIMIT = 200;
const EXPORT_MAX_ROWS = 5000;

/** SEC-029: neutralize CSV injection / record splitting for every exported cell. */
function csvCell(value: unknown): string {
  let cell = value === null || value === undefined ? "" : String(value);
  cell = cell.replace(/[\r\n]+/g, " ");
  if (/^[=+\-@\t\f]/.test(cell)) cell = `'${cell}`;
  if (cell.includes('"') || cell.includes(",")) cell = `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

function toBoundedInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isAdministratorSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Access restricted to administrators" : "Unauthorized: Invalid or missing token" },
        { status: session ? 403 : 401 }
      );
    }

    const adminId = Number(session.userId);

    const { searchParams } = new URL(req.url);
    const isExport = searchParams.get("export") === "csv";

    const filters: AuditFilters = {
      page: toBoundedInt(searchParams.get("page"), 1, 100000),
      limit: isExport
        ? toBoundedInt(searchParams.get("limit"), EXPORT_MAX_ROWS, EXPORT_MAX_ROWS)
        : toBoundedInt(searchParams.get("limit"), 10, MAX_PAGE_LIMIT),
      search: searchParams.get("search") || undefined,
      event_category: searchParams.get("event_category") || undefined,
      action: searchParams.get("action") || undefined,
      status: searchParams.get("status") || undefined,
      actor_type: searchParams.get("actor_type") || undefined,
      organization_type: searchParams.get("organization_type") || undefined,
      resource_type: searchParams.get("resource_type") || undefined,
      actor_user_id: toBoundedInt(searchParams.get("actor_user_id"), 0, Number.MAX_SAFE_INTEGER) || undefined,
      date_from: searchParams.get("date_from") || undefined,
      date_to: searchParams.get("date_to") || undefined,
    };

    const { records, total } = await fetchAuditLogsRepo(filters);

    // CSV export mode
    if (isExport) {
      // An export of the audit trail that is not itself logged is unauditable, so
      // the download waits for the record instead of firing it and forgetting.
      try {
        await createAuditRecordStrictRepo({
          event_type: "AUDIT_EXPORT",
          event_category: "ADMIN",
          action: "EXPORT",
          status: "SUCCESS",
          actor_type: "ADMIN",
          actor_user_id: adminId,
          reason: `Exported ${records.length} of ${total} audit records to CSV`,
        });
      } catch (auditErr) {
        console.error("Audit export could not be logged:", auditErr);
        return NextResponse.json(
          { error: "The export could not be recorded in the audit trail, so it was not released." },
          { status: 502 }
        );
      }

      const headers = [
        "Audit ID",
        "Timestamp",
        "Category",
        "Event Type",
        "Action",
        "Status",
        "Actor Type",
        "Actor User ID",
        "Actor Name",
        "Resource Type",
        "Resource ID",
        "Organization Type",
        "Reason",
        "IP Address",
        "Correlation ID",
      ];

      const csvRows = [headers.join(",")];

      records.forEach((r) => {
        const row = [
          csvCell(r.audit_id),
          csvCell(r.created_at),
          csvCell(r.event_category),
          csvCell(r.event_type),
          csvCell(r.action),
          csvCell(r.status),
          csvCell(r.actor_type),
          csvCell(r.actor_user_id ?? ""),
          csvCell(r.actor_name),
          csvCell(r.resource_type),
          csvCell(r.resource_id),
          csvCell(r.organization_type),
          csvCell(r.reason),
          csvCell(r.ip_address),
          csvCell(r.correlation_id),
        ];
        csvRows.push(row.join(","));
      });

      const csvString = csvRows.join("\n");
      const fileName = `audit_trail_${new Date().toISOString().split("T")[0]}.csv`;

      return new NextResponse(csvString, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "X-Total-Records": String(total),
          "X-Export-Truncated": total > records.length ? "true" : "false",
        },
      });
    }

    // Normal JSON response with KPIs
    const kpis = await fetchAuditKPIsRepo(filters);

    return NextResponse.json({
      records,
      total,
      kpis,
    });
  } catch (error: unknown) {
    console.error("API Route Error (audit-trail):", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Internal server error") },
      { status: 500 }
    );
  }
}
