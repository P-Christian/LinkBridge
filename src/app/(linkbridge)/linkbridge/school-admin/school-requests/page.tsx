import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Legacy URL: School Requests and Course Requests now share one dashboard.
export default function SchoolAdminSchoolRequestsRoute() {
  redirect("/linkbridge/school-admin/requests");
}
