// src/app/api/shared/users/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { UserSearchResult } from "@/modules/shared/search/types";
import { authenticateRequest } from "@/lib/authenticated-session";
import { formatAssetUrl } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

function resolveAssetUrl(fileId?: string | null): string | undefined {
  if (!fileId) return undefined;
  return formatAssetUrl(fileId) ?? undefined;
}

function maskEmail(email?: string | null): string | undefined {
  if (!email || !email.includes("@")) return undefined;
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Authentication required to search directory." },
        { status: 401 }
      );
    }

    const callerRole = session.roleId || 0;

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim();

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const encodedQ = encodeURIComponent(query);

    // 1. Search Freelancers (vs_user where role_id = 1)
    const freelancerPromise = (async (): Promise<UserSearchResult[]> => {
      try {
        const url = `${DIRECTUS_BASE}/items/vs_user?limit=6&filter[role_id][_eq]=1&filter[_or][0][user_fname][_icontains]=${encodedQ}&filter[_or][1][user_lname][_icontains]=${encodedQ}&fields=user_id,user_fname,user_lname,user_email,role_id,profile_image_url,job_seeker_profile.*,vs_job_seeker_profile.*`;
        const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        const users = json.data || [];

        /* eslint-disable @typescript-eslint/no-explicit-any */
        return users
          .filter((u: any) => {
            const rawProfiles = u.job_seeker_profile || u.vs_job_seeker_profile || [];
            const profiles = Array.isArray(rawProfiles) ? rawProfiles : [rawProfiles];
            const profile = profiles[0];
            if (!profile) return true; // allow basic profile if registered

            const vis = (profile.profile_visibility || "public").toLowerCase();
            if (vis === "public") return true;
            if (vis === "recruiters only") return callerRole === 2;
            return false;
          })
          .map((u: any): UserSearchResult => {
            const rawProfiles = u.job_seeker_profile || u.vs_job_seeker_profile || [];
            const profiles = Array.isArray(rawProfiles) ? rawProfiles : [rawProfiles];
            const profile = profiles[0];
            const headline = profile?.professional_headline || "Freelancer";
            const avatar = resolveAssetUrl(u.profile_image_url);

            return {
              user_id: u.user_id,
              role_id: 1,
              name: `${u.user_fname || ""} ${u.user_lname || ""}`.trim() || "Freelancer",
              user_fname: u.user_fname,
              user_lname: u.user_lname,
              user_email: maskEmail(u.user_email),
              avatar_url: avatar,
              headline,
              entity_type: "freelancer",
              badge_label: "Freelancer",
            };
          });
      } catch (err) {
        console.error("Freelancer search error:", err);
        return [];
      }
    })();

    // 2. Search Companies (vs_company joined with vs_company_user / created_by_user_id)
    const companyPromise = (async (): Promise<UserSearchResult[]> => {
      try {
        const compUrl = `${DIRECTUS_BASE}/items/vs_company?limit=10&filter[_or][0][company_name][_icontains]=${encodedQ}&filter[_or][1][company_legal_name][_icontains]=${encodedQ}&filter[_or][2][company_description][_icontains]=${encodedQ}&filter[_or][3][company_city][_icontains]=${encodedQ}&filter[_or][4][company_tags][_icontains]=${encodedQ}&fields=company_id,company_name,company_description,company_logo,company_city,company_province,company_tags,created_by_user_id`;
        const res = await fetch(compUrl, { headers: getHeaders(), cache: "no-store" });
        if (!res.ok) {
          const errText = await res.text();
          console.error("Directus company search error:", errText);
          return [];
        }
        const json = await res.json();
        const companies = json.data || [];
        if (companies.length === 0) return [];

        const compIds = companies.map((c: any) => Number(c.company_id)).filter(Boolean);

        // Fetch company admin users from vs_company_user
        const compUserMap: Record<number, number> = {};
        if (compIds.length > 0) {
          try {
            const linkUrl = `${DIRECTUS_BASE}/items/vs_company_user?filter[company_id][_in]=${compIds.join(",")}&limit=50&fields=company_id,user_id,is_primary_contact`;
            const linkRes = await fetch(linkUrl, { headers: getHeaders(), cache: "no-store" });
            if (linkRes.ok) {
              const linkJson = await linkRes.json();
              const links: any[] = linkJson.data || [];
              links.forEach((l) => {
                const rawCid = typeof l.company_id === "object" && l.company_id !== null ? l.company_id.company_id : l.company_id;
                const rawUid = typeof l.user_id === "object" && l.user_id !== null ? l.user_id.user_id : l.user_id;
                const cid = Number(rawCid);
                const uid = Number(rawUid);
                if (cid && uid) {
                  // Prefer primary contact if already set
                  if (!compUserMap[cid] || Boolean(l.is_primary_contact)) {
                    compUserMap[cid] = uid;
                  }
                }
              });
            }
          } catch (err) {
            console.warn("Could not query vs_company_user:", err);
          }
        }

        return companies
          .map((c: any): UserSearchResult | null => {
            const userId = compUserMap[Number(c.company_id)] || Number(c.created_by_user_id);
            if (!userId) return null;

            const headlineParts = [c.company_city, c.company_province].filter(Boolean);
            const location = headlineParts.join(", ");
            const headline = c.company_tags || location || c.company_description || "Company";

            return {
              user_id: userId,
              role_id: 2,
              name: c.company_name || "Company",
              headline,
              avatar_url: resolveAssetUrl(c.company_logo),
              entity_type: "client",
              badge_label: "Company",
              location: location || undefined,
            };
          })
          .filter((item: UserSearchResult | null): item is UserSearchResult => item !== null);
      } catch (err) {
        console.error("Company search error:", err);
        return [];
      }
    })();

    // 3. Search Schools (vs_school joined with vs_school_admin / created_by)
    const schoolPromise = (async (): Promise<UserSearchResult[]> => {
      try {
        const schoolUrl = `${DIRECTUS_BASE}/items/vs_school?search=${encodedQ}&limit=20&fields=school_id,school_name,school_type,school_logo_url,city_municipality,province,school_status,verification_status,is_public,is_active,created_by`;
        const res = await fetch(schoolUrl, { headers: getHeaders(), cache: "no-store" });
        let schools: any[] = [];
        if (res.ok) {
          const json = await res.json();
          schools = json.data || [];
        }

        // Fallback to explicit filter if search param didn't return matches
        if (schools.length === 0) {
          const fallbackUrl = `${DIRECTUS_BASE}/items/vs_school?filter[_or][0][school_name][_icontains]=${encodedQ}&filter[_or][1][city_municipality][_icontains]=${encodedQ}&filter[_or][2][province][_icontains]=${encodedQ}&limit=20&fields=school_id,school_name,school_type,school_logo_url,city_municipality,province,school_status,verification_status,is_public,is_active,created_by`;
          const fbRes = await fetch(fallbackUrl, { headers: getHeaders(), cache: "no-store" });
          if (fbRes.ok) {
            const fbJson = await fbRes.json();
            schools = fbJson.data || [];
          }
        }

        // Filter for all 4 conditions: Active, Verified, is_public=1, is_active=1
        schools = schools.filter((s: any) => {
          const status = String(s.school_status || "").trim().toLowerCase();
          const verification = String(s.verification_status || "").trim().toLowerCase();
          const isPublic = s.is_public === 1 || s.is_public === true || s.is_public === "1" || s.is_public === "true";
          const isActive = s.is_active === 1 || s.is_active === true || s.is_active === "1" || s.is_active === "true";
          return status === "active" && verification === "verified" && isPublic && isActive;
        });

        if (schools.length === 0) return [];

        const schoolIds = schools.map((s: any) => Number(s.school_id)).filter(Boolean);

        // Fetch school admin users from vs_school_admin
        const schoolUserMap: Record<number, number> = {};
        if (schoolIds.length > 0) {
          try {
            const adminUrl = `${DIRECTUS_BASE}/items/vs_school_admin?filter[school_id][_in]=${schoolIds.join(",")}&limit=50&fields=school_id,user_id,is_active`;
            const adminRes = await fetch(adminUrl, { headers: getHeaders(), cache: "no-store" });
            if (adminRes.ok) {
              const adminJson = await adminRes.json();
              const admins: any[] = adminJson.data || [];
              admins.forEach((a) => {
                const rawSid = typeof a.school_id === "object" && a.school_id !== null ? a.school_id.school_id : a.school_id;
                const rawUid = typeof a.user_id === "object" && a.user_id !== null ? a.user_id.user_id : a.user_id;
                const sid = Number(rawSid);
                const uid = Number(rawUid);
                if (sid && uid) {
                  if (!schoolUserMap[sid] || a.is_active === 1 || a.is_active === true) {
                    schoolUserMap[sid] = uid;
                  }
                }
              });
            }
          } catch (err) {
            console.warn("Could not query vs_school_admin:", err);
          }
        }

        return schools
          .map((s: any): UserSearchResult | null => {
            const userId = schoolUserMap[Number(s.school_id)] || Number(s.created_by) || Number(s.school_id);
            if (!userId) return null;

            const headlineParts = [s.school_type, s.city_municipality].filter(Boolean);
            const headline = headlineParts.join(" • ") || "Educational Institution";
            const location = [s.city_municipality, s.province].filter(Boolean).join(", ");

            return {
              user_id: userId,
              role_id: 4,
              name: s.school_name || "School",
              headline,
              avatar_url: resolveAssetUrl(s.school_logo_url),
              entity_type: "school-admin",
              badge_label: "School",
              location: location || undefined,
            };
          })
          .filter((item: UserSearchResult | null): item is UserSearchResult => item !== null);
      } catch (err) {
        console.error("School search error:", err);
        return [];
      }
    })();
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const [freelancers, companies, schools] = await Promise.all([
      freelancerPromise,
      companyPromise,
      schoolPromise,
    ]);

    // Combine, deduplicate, and limit total results
    const combined = [...freelancers, ...companies, ...schools];
    const seen = new Set<string>();
    const combinedResults = combined
      .filter((item) => {
        const key = `${item.entity_type}-${item.user_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 15);

    return NextResponse.json({ results: combinedResults });
  } catch (err: unknown) {
    console.error("GET /api/shared/users/search error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

