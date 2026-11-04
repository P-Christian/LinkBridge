import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/,
  ""
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function toPositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function getPHISOTimestamp(): string {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return dtf.format(now).replace(" ", "T") + "+08:00";
}

/**
 * Manila wall clock as `YYYY-MM-DD HH:mm:ss`, the form every other writer of
 * these columns uses (`getPHTimeString()` in registration, messaging and the
 * school queue) and the form their readers assume.
 *
 * `getPHISOTimestamp()` above sends the same instant with a `+08:00` suffix,
 * which Directus converts to UTC before it reaches the MySQL `datetime` column,
 * so the two spellings do not store the same digits. A `vs_company` row could
 * therefore carry a `created_at` from registration and a `verified_at` from this
 * route eight hours apart, and `formatDate()` renders the second one wrongly.
 * Only `vs_audit_trail`, whose reader treats naive digits as UTC, wants the
 * offset form.
 */
function getPHTimestampForDB(): string {
  return getPHISOTimestamp().slice(0, 19).replace("T", " ");
}

function getDirectusHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

/**
 * vs_company.industry_id / company_size_id / organization_type_id have no
 * Directus relation registered, so `fields=industry_id.*` returns nothing and
 * the lookup collections must be joined by hand.
 */
async function fetchLookupNames(
  collection: string,
  idField: string,
  nameField: string
): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  try {
    const res = await fetch(
      `${DIRECTUS_BASE}/items/${collection}?fields=${idField},${nameField}&limit=-1`,
      { headers: getDirectusHeaders(), cache: "no-store" }
    );
    if (!res.ok) return names;
    const json = await res.json();
    for (const row of (json.data || []) as Record<string, unknown>[]) {
      const name = String(row[nameField] ?? "").trim();
      if (name) names[String(row[idField])] = name;
    }
  } catch (err) {
    console.warn(`Failed to fetch ${collection} for name resolution:`, err);
  }
  return names;
}

function resolveLookupName(
  rawValue: unknown,
  names: Record<string, string>
): string | null {
  if (rawValue === null || rawValue === undefined) return null;
  const key = String(rawValue).trim();
  if (!key) return null;
  if (names[key]) return names[key];
  // Legacy rows stored the classification as free text instead of a foreign key.
  return Number.isNaN(Number(key)) ? key : null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized: no token provided" },
        { status: 401 }
      );
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json(
        { error: "Directus API base URL is not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    /**
     * Build Directus filter query for vs_company
     */
    const filter: Record<string, unknown> = {};

    if (status && status.toUpperCase() !== "ALL") {
      filter.verification_status = { _eq: status };
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter._or = [
        { company_name: { _icontains: q } },
        { company_legal_name: { _icontains: q } },
        { company_code: { _icontains: q } },
        { company_tin: { _icontains: q } },
        { registration_no: { _icontains: q } },
        { company_email: { _icontains: q } },
      ];
    }

    const queries: string[] = ["sort=-created_at", "limit=-1"];
    if (Object.keys(filter).length > 0) {
      queries.push(`filter=${encodeURIComponent(JSON.stringify(filter))}`);
    }

    const companyUrl = `${DIRECTUS_BASE}/items/vs_company?${queries.join("&")}`;
    const res = await fetch(companyUrl, {
      headers: getDirectusHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Directus fetch failed: ${res.statusText} (${errText})` },
        { status: res.status }
      );
    }

    const json = await res.json();
    const companies: Record<string, unknown>[] = json.data || [];

    if (companies.length === 0) {
      return NextResponse.json([]);
    }

    const companyIds = companies.map((c) => Number(c.company_id)).filter(Boolean);

    /**
     * Batch fetch related documents from vs_company_document
     */
    const docMap: Record<number, unknown[]> = {};
    if (companyIds.length > 0) {
      try {
        const docUrl = `${DIRECTUS_BASE}/items/vs_company_document?filter[company_id][_in]=${companyIds.join(",")}&limit=-1`;
        const docRes = await fetch(docUrl, { headers: getDirectusHeaders(), cache: "no-store" });
        if (docRes.ok) {
          const docJson = await docRes.json();
          const docs: Record<string, unknown>[] = docJson.data || [];
          docs.forEach((d) => {
            const cid = Number(d.company_id);
            if (!docMap[cid]) docMap[cid] = [];
            docMap[cid].push(d);
          });
        }
      } catch (err) {
        console.warn("Failed to fetch vs_company_document records:", err);
      }
    }

function resolveAssetUrl(idStr: unknown): string | null {
  if (!idStr || typeof idStr !== "string" || !idStr.trim()) return null;
  const t = idStr.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/api/assets/")) return t;
  if (t.startsWith("/assets/")) return `/api${t}`;
  const parts = t.split("/");
  const fileId = parts[parts.length - 1];
  return fileId ? `/api/assets/${fileId}` : null;
}

    /**
     * Batch fetch primary contacts / users from vs_company_user
     */
    const userMap: Record<number, unknown[]> = {};
    if (companyIds.length > 0) {
      try {
        const companyUserUrl = `${DIRECTUS_BASE}/items/vs_company_user?filter[company_id][_in]=${companyIds.join(",")}&limit=-1`;
        const cuRes = await fetch(companyUserUrl, { headers: getDirectusHeaders(), cache: "no-store" });
        if (cuRes.ok) {
          const cuJson = await cuRes.json();
          const cus: Record<string, unknown>[] = cuJson.data || [];
          
          // Get unique user IDs to resolve names/emails and government ID verifications
          const uidsFromCU = cus
            .map((cu) => {
              const rawId = typeof cu.user_id === "object" && cu.user_id !== null ? (cu.user_id as Record<string, unknown>).user_id : cu.user_id;
              return Number(rawId);
            })
            .filter(Boolean);
          const uidsFromCompanies = companies
            .map((c) => Number(c.created_by_user_id))
            .filter(Boolean);
          const uids = Array.from(new Set([...uidsFromCU, ...uidsFromCompanies]));

          const vsUserMap: Record<number, { user_fname?: string; user_lname?: string; user_email?: string; user_contact?: string; user_position?: string; gov_id_type?: string; gov_id_front_image_uuid?: string; gov_id_back_image_uuid?: string }> = {};
          const vsIdVerMap: Record<number, Record<string, unknown>> = {};

          if (uids.length > 0) {
            const [uRes, idVerRes] = await Promise.all([
              fetch(`${DIRECTUS_BASE}/items/vs_user?filter[user_id][_in]=${uids.join(",")}&fields=*&limit=-1`, { headers: getDirectusHeaders(), cache: "no-store" }),
              fetch(`${DIRECTUS_BASE}/items/vs_identity_verifications?filter[user_id][_in]=${uids.join(",")}&limit=-1`, { headers: getDirectusHeaders(), cache: "no-store" }),
            ]);

            if (uRes.ok) {
              const uJson = await uRes.json();
              const uList = uJson.data || [];
              uList.forEach((u: Record<string, unknown>) => {
                const uid = Number(u.user_id);
                vsUserMap[uid] = {
                  user_fname: (u.user_fname as string) || "",
                  user_lname: (u.user_lname as string) || "",
                  user_email: (u.user_email as string) || "",
                  user_contact: (u.user_contact as string) || "",
                  user_position: (u.user_position as string) || "",
                  gov_id_type: (u.gov_id_type as string) || "",
                  gov_id_front_image_uuid: (u.gov_id_front_image_uuid as string) || "",
                  gov_id_back_image_uuid: (u.gov_id_back_image_uuid as string) || "",
                };
              });
            }

            if (idVerRes.ok) {
              const idVerJson = await idVerRes.json();
              const idVerList = idVerJson.data || [];
              idVerList.forEach((v: Record<string, unknown>) => {
                const uid = Number(v.user_id);
                if (!vsIdVerMap[uid]) {
                  const frontUuid = (v.gov_id_front_image_uuid || v.gov_id_file_id) as string | null;
                  const backUuid = (v.gov_id_back_image_uuid) as string | null;

                  vsIdVerMap[uid] = {
                    id: v.id,
                    gov_id_type: v.gov_id_type || "Government ID",
                    gov_id_front_image_uuid: frontUuid,
                    gov_id_back_image_uuid: backUuid,
                    gov_id_front_url: resolveAssetUrl(frontUuid),
                    gov_id_back_url: resolveAssetUrl(backUuid),
                    status: v.status || "pending",
                    submitted_at: v.submitted_at || null,
                  };
                }
              });
            }
          }

          cus.forEach((cu) => {
            const cid = Number(cu.company_id);
            const rawUid = typeof cu.user_id === "object" && cu.user_id !== null ? (cu.user_id as Record<string, unknown>).user_id : cu.user_id;
            const uid = Number(rawUid);
            const uInfo = vsUserMap[uid] || {};
            const cuUserObj = typeof cu.user_id === "object" && cu.user_id !== null ? (cu.user_id as Record<string, unknown>) : null;

            const userFname = String(uInfo.user_fname ?? cuUserObj?.user_fname ?? cu.user_fname ?? "").trim();
            const userLname = String(uInfo.user_lname ?? cuUserObj?.user_lname ?? cu.user_lname ?? "").trim();
            const userEmail = String(uInfo.user_email ?? cuUserObj?.user_email ?? cu.user_email ?? "").trim();
            const userContact = String(uInfo.user_contact ?? cuUserObj?.user_contact ?? cu.user_contact ?? "").trim();
            const userPosition = String(uInfo.user_position ?? cuUserObj?.user_position ?? cu.user_position ?? "").trim();

            let idVer = vsIdVerMap[uid] || null;

            // Fallback to user-level ID fields if identity_verifications record was empty
            if (!idVer || (!idVer.gov_id_front_url && !idVer.gov_id_back_url)) {
              const fUuid = uInfo.gov_id_front_image_uuid || idVer?.gov_id_front_image_uuid;
              const bUuid = uInfo.gov_id_back_image_uuid || idVer?.gov_id_back_image_uuid;
              if (fUuid || bUuid) {
                idVer = {
                  id: idVer?.id || 0,
                  gov_id_type: idVer?.gov_id_type || uInfo.gov_id_type || "Government ID",
                  gov_id_front_image_uuid: fUuid || null,
                  gov_id_back_image_uuid: bUuid || null,
                  gov_id_front_url: resolveAssetUrl(fUuid),
                  gov_id_back_url: resolveAssetUrl(bUuid),
                  status: idVer?.status || "pending",
                  submitted_at: idVer?.submitted_at || null,
                };
              }
            }

            // Fallback to company documents if attached as GOV ID
            if (!idVer || (!idVer.gov_id_front_url && !idVer.gov_id_back_url)) {
              const companyDocs = (docMap[cid] || []) as Record<string, unknown>[];
              const govDocs = companyDocs.filter((d) => {
                const t = String(d.document_type || "").toUpperCase();
                const n = String(d.document_name || "").toUpperCase();
                return t.includes("GOVERN") || t.includes("GOV") || t.includes("ID") || n.includes("GOVERN") || n.includes("ID");
              });

              if (govDocs.length > 0) {
                const frontDoc = govDocs.find((d) => String(d.document_type || d.document_name || "").toUpperCase().includes("FRONT")) || govDocs[0];
                const backDoc = govDocs.find((d) => String(d.document_type || d.document_name || "").toUpperCase().includes("BACK")) || (govDocs.length > 1 ? govDocs[1] : null);

                idVer = {
                  id: 0,
                  gov_id_type: (frontDoc.document_name as string) || "Government ID",
                  gov_id_front_image_uuid: (frontDoc.directus_file_id as string) || null,
                  gov_id_back_image_uuid: (backDoc?.directus_file_id as string) || null,
                  gov_id_front_url: resolveAssetUrl(frontDoc.directus_file_id),
                  gov_id_back_url: resolveAssetUrl(backDoc?.directus_file_id),
                  status: "pending",
                  submitted_at: (frontDoc.uploaded_at as string) || null,
                };
              }
            }

            if (!userMap[cid]) userMap[cid] = [];
            userMap[cid].push({
              ...cu,
              user_fname: userFname,
              user_lname: userLname,
              user_email: userEmail,
              user_contact: userContact,
              user_position: userPosition,
              identity_verification: idVer,
            });
          });

          // Ensure every company has at least the creator user if no vs_company_user links exist
          companies.forEach((c) => {
            const cid = Number(c.company_id);
            const creatorId = Number(c.created_by_user_id);
            if (!userMap[cid] || userMap[cid].length === 0) {
              if (creatorId && vsUserMap[creatorId]) {
                const uInfo = vsUserMap[creatorId];
                userMap[cid] = [
                  {
                    company_user_id: 0,
                    company_id: cid,
                    user_id: creatorId,
                    company_user_role: "OWNER",
                    is_primary_contact: 1,
                    status: "ACTIVE",
                    user_fname: uInfo.user_fname || "",
                    user_lname: uInfo.user_lname || "",
                    user_email: uInfo.user_email || "",
                    user_contact: uInfo.user_contact || "",
                    user_position: uInfo.user_position || "",
                    identity_verification: vsIdVerMap[creatorId] || null,
                  },
                ];
              }
            }
          });
        }
      } catch (err) {
        console.warn("Failed to fetch vs_company_user records:", err);
      }
    }

    /**
     * Batch fetch verification attempts from vs_company_verifications
     */
    const verifMap: Record<number, unknown[]> = {};
    if (companyIds.length > 0) {
      try {
        const verifUrl = `${DIRECTUS_BASE}/items/vs_company_verifications?filter[company_id][_in]=${companyIds.join(",")}&sort=-created_at,-id&limit=-1`;
        const verifRes = await fetch(verifUrl, { headers: getDirectusHeaders(), cache: "no-store" });
        if (verifRes.ok) {
          const verifJson = await verifRes.json();
          const verifs: Record<string, unknown>[] = verifJson.data || [];

          // Collect user IDs for reviewer and submitter
          const verifUserIds = Array.from(
            new Set(
              verifs
                .flatMap((v) => [Number(v.reviewed_by), Number(v.submitted_by_user_id)])
                .filter((id): id is number => Boolean(id) && id > 0)
            )
          );

          const verifUserNames: Record<number, string> = {};
          if (verifUserIds.length > 0) {
            const vUserUrl = `${DIRECTUS_BASE}/items/vs_user?filter[user_id][_in]=${verifUserIds.join(",")}&fields=user_id,user_fname,user_lname,user_email&limit=-1`;
            const vUserRes = await fetch(vUserUrl, { headers: getDirectusHeaders(), cache: "no-store" });
            if (vUserRes.ok) {
              const vUserJson = await vUserRes.json();
              const vUserList = vUserJson.data || [];
              vUserList.forEach((u: { user_id: number; user_fname?: string; user_lname?: string; user_email?: string }) => {
                const name = `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim() || u.user_email || `User #${u.user_id}`;
                verifUserNames[u.user_id] = name;
              });
            }
          }

          verifs.forEach((v) => {
            const cid = Number(v.company_id);
            const rId = Number(v.reviewed_by);
            const sId = Number(v.submitted_by_user_id);
            if (!verifMap[cid]) verifMap[cid] = [];
            verifMap[cid].push({
              ...v,
              reviewer_name: rId ? verifUserNames[rId] || `Admin #${rId}` : null,
              submitter_name: sId ? verifUserNames[sId] || `User #${sId}` : null,
            });
          });
        }
      } catch (err) {
        console.warn("Failed to fetch vs_company_verifications records:", err);
      }
    }

    /**
     * Resolve company classification foreign keys to their master-data names
     */
    const [industryNames, companySizeNames, organizationTypeNames] = await Promise.all([
      fetchLookupNames("vs_industry", "industry_id", "industry_name"),
      fetchLookupNames("vs_company_size", "company_size_id", "company_size_name"),
      fetchLookupNames("vs_organization_type", "organization_type_id", "organization_type_name"),
    ]);

    /**
     * Combine records with documents, users, and verifications
     */
    const records = companies.map((c) => {
      const cid = Number(c.company_id);
      const companyVerifs = (verifMap[cid] || []) as Record<string, unknown>[];
      const latestVerif = companyVerifs.length > 0 ? companyVerifs[0] : null;

      const logoRaw = c.company_logo ? String(c.company_logo) : null;
      const logoUrl = logoRaw
        ? logoRaw.startsWith("http") || logoRaw.startsWith("/")
          ? logoRaw
          : `/assets/${logoRaw}`
        : null;

      const coverRaw = c.company_cover ? String(c.company_cover) : null;
      const coverUrl = coverRaw
        ? coverRaw.startsWith("http") || coverRaw.startsWith("/")
          ? coverRaw
          : `/assets/${coverRaw}`
        : null;

      return {
        ...c,
        company_logo: logoUrl,
        company_cover: coverUrl,
        industry_name: resolveLookupName(c.industry_id, industryNames),
        company_size_name: resolveLookupName(c.company_size_id, companySizeNames),
        organization_type_name: resolveLookupName(c.organization_type_id, organizationTypeNames),
        documents: docMap[cid] || [],
        users: userMap[cid] || [],
        verifications: companyVerifs,
        latest_verification: latestVerif,
        internal_notes: (latestVerif?.internal_notes as string) || (c.internal_notes as string) || null,
        rejection_reason: (latestVerif?.public_rejection_reason as string) || (c.rejection_reason as string) || null,
        submitted_at: (latestVerif?.submitted_at as string) || (c.submitted_at as string) || (c.created_at as string),
      };
    });

    return NextResponse.json(records);
  } catch (error: unknown) {
    const msg = safeErrorMessage(error, "Internal server error");
    console.error("API Route Error (company-verification):", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const adminId = auth.adminId;

    if (!DIRECTUS_BASE) {
      return NextResponse.json(
        { error: "Directus API base URL is not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { companyId: rawCompanyId, action, rejectionReason, internalNotes } = body;

    if (!rawCompanyId || !action) {
      return NextResponse.json(
        { error: "companyId and action are required" },
        { status: 400 }
      );
    }

    const companyId = toPositiveId(rawCompanyId);
    if (!companyId) {
      return NextResponse.json({ error: "Invalid companyId" }, { status: 400 });
    }

    let verifStatus = "PENDING_VERIFICATION";
    let companyStatus: string | null = null;
    let isPublic = 0;

    if (action === "approve") {
      companyStatus = "VERIFIED";
      verifStatus = "APPROVED";
      isPublic = 1;
    } else if (action === "suspend") {
      companyStatus = "SUSPENDED";
      verifStatus = "SUSPENDED";
    } else if (action === "request_revision") {
      // The applicant-side editing gates unlock off vs_company.verification_status,
      // so the company returns to DRAFT while the review workflow row carries the
      // CORRECTION_REQUIRED state that renders as "Needs Revision" in the queue.
      companyStatus = "DRAFT";
      verifStatus = "CORRECTION_REQUIRED";
    } else if (action === "start_review" || action === "in_review") {
      companyStatus = "PENDING_VERIFICATION";
      verifStatus = "IN_REVIEW";
    }

    const nowPH = getPHTimestampForDB();

    const patchPayload: Record<string, unknown> = {
      rejection_reason: rejectionReason || null,
      updated_by_user_id: adminId,
      updated_at: nowPH,
    };

    if (companyStatus) {
      patchPayload.verification_status = companyStatus;
    }

    if (action === "approve") {
      patchPayload.is_public = isPublic;
      patchPayload.verified_at = nowPH;
      patchPayload.verified_by_user_id = adminId;
    }

    // 1. Update vs_company in Directus
    const companyPatchUrl = `${DIRECTUS_BASE}/items/vs_company/${companyId}`;
    const patchRes = await fetch(companyPatchUrl, {
      method: "PATCH",
      headers: getDirectusHeaders(),
      body: JSON.stringify(patchPayload),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      return NextResponse.json(
        { error: `Failed to update vs_company: ${patchRes.statusText} (${errText})` },
        { status: patchRes.status }
      );
    }

    // The company row is the commit point: everything after it (owner cascade,
    // workflow log, audit trail) can still fail per row. Those are reported as
    // warnings, because an admin told the whole action failed will re-approve
    // and double-write the log.
    const warnings: string[] = [];

    // 1b. Automatically approve associated users and identity verifications when company is approved
    if (action === "approve") {
      try {
        const [cuRes, compRes] = await Promise.all([
          fetch(`${DIRECTUS_BASE}/items/vs_company_user?filter[company_id][_eq]=${companyId}&fields=user_id`, { headers: getDirectusHeaders(), cache: "no-store" }),
          fetch(`${DIRECTUS_BASE}/items/vs_company/${companyId}?fields=created_by_user_id`, { headers: getDirectusHeaders(), cache: "no-store" }),
        ]);

        const uids: number[] = [];
        if (cuRes.ok) {
          const cuJson = await cuRes.json();
          (cuJson.data || []).forEach((item: Record<string, unknown>) => {
            const raw = item.user_id;
            const uid = Number(typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>).user_id : raw);
            if (uid) uids.push(uid);
          });
        } else {
          // A failed lookup and an ownerless company both produce an empty uids
          // array; only one of them is a fact.
          warnings.push("The company's linked user accounts could not be read, so no owner was marked verified.");
        }

        if (compRes.ok) {
          const compJson = await compRes.json();
          const creatorId = Number(compJson.data?.created_by_user_id);
          if (creatorId) uids.push(creatorId);
        } else {
          warnings.push("The company creator could not be read, so that owner was not marked verified.");
        }

        const uniqueUids = Array.from(new Set(uids.filter((id) => id > 0)));
        if (uniqueUids.length > 0) {
          await Promise.all(
            uniqueUids.map(async (uid) => {
              try {
                const userPatchRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${uid}`, {
                  method: "PATCH",
                  headers: getDirectusHeaders(),
                  body: JSON.stringify({
                    verification_status: "VERIFIED",
                    verified_at: nowPH,
                    verified_by_user_id: adminId,
                    updated_at: nowPH,
                  }),
                });
                if (!userPatchRes.ok) {
                  warnings.push(`Owner #${uid} was not marked verified.`);
                }

                const idVerFindUrl = `${DIRECTUS_BASE}/items/vs_identity_verifications?filter[user_id][_eq]=${uid}&sort=-submitted_at&limit=1`;
                const idVerFindRes = await fetch(idVerFindUrl, { headers: getDirectusHeaders(), cache: "no-store" });
                if (idVerFindRes.ok) {
                  const idVerFindJson = await idVerFindRes.json();
                  const latestIdVer = idVerFindJson.data?.[0];
                  if (latestIdVer && latestIdVer.id) {
                    const idVerPatchRes = await fetch(
                      `${DIRECTUS_BASE}/items/vs_identity_verifications/${latestIdVer.id}`,
                      {
                        method: "PATCH",
                        headers: getDirectusHeaders(),
                        body: JSON.stringify({
                          status: "approved",
                          reviewed_at: nowPH,
                          reviewed_by: adminId,
                        }),
                      }
                    );
                    if (!idVerPatchRes.ok) {
                      warnings.push(`Owner #${uid}'s ID document was not approved.`);
                    }
                  }
                } else {
                  warnings.push(`Owner #${uid}'s ID document could not be found.`);
                }
              } catch (uErr) {
                console.warn(`Failed to auto-approve user #${uid}:`, uErr);
                warnings.push(`Owner #${uid} could not be updated.`);
              }
            })
          );
        }
      } catch (autoApproveErr) {
        console.warn("Failed during auto-approval of associated company users:", autoApproveErr);
        warnings.push("The owner-approval pass stopped early, so some company owners may not have been marked verified.");
      }
    }

    // 1c. Automatically suspend associated users and identity verifications when the company is suspended
    if (action === "suspend") {
      try {
        const [cuRes, compRes] = await Promise.all([
          fetch(`${DIRECTUS_BASE}/items/vs_company_user?filter[company_id][_eq]=${companyId}&fields=user_id`, { headers: getDirectusHeaders(), cache: "no-store" }),
          fetch(`${DIRECTUS_BASE}/items/vs_company/${companyId}?fields=created_by_user_id`, { headers: getDirectusHeaders(), cache: "no-store" }),
        ]);

        const uids: number[] = [];
        if (cuRes.ok) {
          const cuJson = await cuRes.json();
          (cuJson.data || []).forEach((item: Record<string, unknown>) => {
            const raw = item.user_id;
            const uid = Number(typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>).user_id : raw);
            if (uid) uids.push(uid);
          });
        } else {
          warnings.push("The company's linked user accounts could not be read, so no owner was suspended.");
        }

        if (compRes.ok) {
          const compJson = await compRes.json();
          const creatorId = Number(compJson.data?.created_by_user_id);
          if (creatorId) uids.push(creatorId);
        } else {
          warnings.push("The company creator could not be read, so that owner was not suspended.");
        }

        const uniqueUids = Array.from(new Set(uids.filter((id) => id > 0)));

        if (uniqueUids.length > 0) {
          await Promise.all(
            uniqueUids.map(async (uid) => {
              try {
                const userPatchRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${uid}`, {
                  method: "PATCH",
                  headers: getDirectusHeaders(),
                  body: JSON.stringify({
                    verification_status: "SUSPENDED",
                    rejection_reason: rejectionReason || null,
                    updated_at: nowPH,
                  }),
                });
                if (!userPatchRes.ok) {
                  warnings.push(`Owner #${uid} was not suspended.`);
                }

                const idVerFindUrl = `${DIRECTUS_BASE}/items/vs_identity_verifications?filter[user_id][_eq]=${uid}&sort=-submitted_at&limit=1`;
                const idVerFindRes = await fetch(idVerFindUrl, { headers: getDirectusHeaders(), cache: "no-store" });
                if (idVerFindRes.ok) {
                  const idVerFindJson = await idVerFindRes.json();
                  const latestIdVer = idVerFindJson.data?.[0];
                  if (latestIdVer && latestIdVer.id) {
                    const idVerPatchRes = await fetch(
                      `${DIRECTUS_BASE}/items/vs_identity_verifications/${latestIdVer.id}`,
                      {
                        method: "PATCH",
                        headers: getDirectusHeaders(),
                        body: JSON.stringify({
                          status: "suspended",
                          reviewed_at: nowPH,
                          reviewed_by: adminId,
                          ...(rejectionReason ? { rejection_note: rejectionReason } : {}),
                        }),
                      }
                    );
                    if (!idVerPatchRes.ok) {
                      warnings.push(`Owner #${uid}'s ID document was not suspended.`);
                    }
                  }
                } else {
                  warnings.push(`Owner #${uid}'s ID document could not be found.`);
                }
              } catch (uErr) {
                console.warn(`Failed to auto-suspend user #${uid}:`, uErr);
                warnings.push(`Owner #${uid} could not be updated.`);
              }
            })
          );
        }
      } catch (autoErr) {
        console.warn("Failed during auto-update of associated company users:", autoErr);
        warnings.push("The owner-suspension pass stopped early, so some company owners may still be active.");
      }
    }

    // 2. Log verification entry into vs_company_verifications
    try {
      let submittedByUserId: number | null = null;
      try {
        const compInfoRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_company/${companyId}?fields=created_by_user_id`,
          { headers: getDirectusHeaders(), cache: "no-store" }
        );
        if (compInfoRes.ok) {
          const compInfoJson = await compInfoRes.json();
          const creatorId = Number(compInfoJson.data?.created_by_user_id);
          if (creatorId) submittedByUserId = creatorId;
        }
      } catch {
        // non-fatal
      }

      const verifLogUrl = `${DIRECTUS_BASE}/items/vs_company_verifications`;
      const verifLogRes = await fetch(verifLogUrl, {
        method: "POST",
        headers: getDirectusHeaders(),
        body: JSON.stringify({
          company_id: companyId,
          submitted_by_user_id: submittedByUserId,
          verification_type: "INITIAL_REGISTRATION",
          status: verifStatus,
          submitted_at: nowPH,
          reviewed_at: nowPH,
          reviewed_by: adminId,
          public_rejection_reason: rejectionReason || null,
          internal_notes: internalNotes || null,
        }),
      });
      if (!verifLogRes.ok) {
        warnings.push("The review queue will not show this decision in its history.");
      }
    } catch (verifErr) {
      console.warn("Could not write to vs_company_verifications table:", verifErr);
      warnings.push("The review queue will not show this decision in its history.");
    }

    // 3. Log event into vs_audit_trail
    try {
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        req.headers.get("x-real-ip") ||
        "127.0.0.1";
      const userAgent = req.headers.get("user-agent") || null;
      const correlationId = req.headers.get("x-correlation-id") || `verif-${companyId}-${Date.now()}`;

      const auditUrl = `${DIRECTUS_BASE}/items/vs_audit_trail`;
      const auditRes = await fetch(auditUrl, {
        method: "POST",
        headers: getDirectusHeaders(),
        body: JSON.stringify({
          event_category: "VERIFICATION",
          event_type: `COMPANY_VERIFICATION_${action.toUpperCase()}`,
          action: action.toUpperCase(),
          status: "SUCCESS",
          actor_type: "ADMIN",
          actor_user_id: adminId,
          resource_type: "COMPANY",
          resource_id: String(companyId),
          ip_address: clientIp,
          user_agent: userAgent,
          correlation_id: correlationId,
          reason: rejectionReason || `Company verification state updated to ${companyStatus}`,
          // The audit read appends `Z` to naive values, so this table alone is
          // written with the explicit offset.
          created_at: getPHISOTimestamp(),
        }),
      });
      if (!auditRes.ok) {
        warnings.push("This decision was not written to the audit trail.");
      }
    } catch (auditErr) {
      console.warn("Could not write to vs_audit_trail:", auditErr);
      warnings.push("This decision was not written to the audit trail.");
    }

    return NextResponse.json({
      success: true,
      message: `Company ID ${companyId} status updated to ${companyStatus}`,
      verification_status: companyStatus,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error: unknown) {
    const msg = safeErrorMessage(error, "Internal server error");
    console.error("API Route Error (POST company-verification):", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
