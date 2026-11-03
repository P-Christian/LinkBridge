// src/app/api/vos-admin/job-roles/tester/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator } from "@/lib/authenticated-session";
import {
  runMatchingEngine,
  normalizeRawCandidate,
  MatchMode,
  analyzeQuery,
  resolveTaxonomyFromDB,
} from "@/modules/matching-engine";

import { safeErrorMessage } from "@/lib/api-error";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdministrator(req))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const keyword = (body.keyword || "").trim();
    if (!keyword) {
      return NextResponse.json({ error: "Search keyword is required." }, { status: 400 });
    }

    // 1. Fetch DB tables in parallel for 100% data-driven taxonomy resolution
    const [aliasRes, rolesRes, catRes] = await Promise.all([
      fetch(`${DIRECTUS_BASE}/items/vs_role_title_alias?limit=-1`, { headers: getHeaders(), cache: "no-store" }),
      fetch(`${DIRECTUS_BASE}/items/vs_role_title?limit=-1`, { headers: getHeaders(), cache: "no-store" }),
      fetch(`${DIRECTUS_BASE}/items/vs_role_category?limit=-1`, { headers: getHeaders(), cache: "no-store" }),
    ]);

    // The whole point of this studio is to explain why a match did or did not
    // happen. Read as empty, an unreadable taxonomy table answered "nothing
    // matched" while the rules themselves were missing.
    if (!aliasRes.ok || !rolesRes.ok || !catRes.ok) {
      return NextResponse.json(
        { error: "The job taxonomy could not be read, so the match test was not run." },
        { status: 502 }
      );
    }

    const aliasList = (await aliasRes.json()).data ?? [];
    const rolesList = (await rolesRes.json()).data ?? [];
    const catList = (await catRes.json()).data ?? [];

    // Algorithmic query analysis & pure DB-driven taxonomy resolution
    const analyzed = analyzeQuery(keyword);
    const taxonomyContext = resolveTaxonomyFromDB(analyzed, { aliasList, rolesList, catList });

    // 2. Candidate profile (Default / Custom from body)
    const defaultRawCandidate = {
      user_id: body.candidate_id || 999,
      name: "Laplace Dummy",
      email: "laplace@example.com",
      headline: "Full-Stack Web Developer",
      summary: "Passionate Full-Stack Web Developer with over 3 years of experience building scalable web applications and enterprise solutions.",
      location: "Anda, CSC Regional Office No. 1",
      availability_status: "EMPLOYED",
      skills: ["React", "Next.js", "TypeScript", "Tailwind CSS", "JavaScript", "Spring Boot", "MySQL", "Docker"],
      work_experience: [
        {
          company_name: "Vertex Technologies Corporation",
          job_title: "Full-Stack Web Developer",
          job_description: "Building production ERP systems and Next.js React web apps.",
          start_date: "2023-03-01",
          is_current_role: true,
        },
        {
          company_name: "Acme Digital Agency",
          job_title: "Freelance Web Developer",
          job_description: "Created client websites using HTML, CSS, JavaScript, and React.",
          start_date: "2022-01-01",
          end_date: "2023-02-28",
          is_current_role: false,
        },
      ],
      education: [
        {
          id: 1,
          status: "Verified",
          school_name: "University of Pangasinan",
          course_name: "Bachelor of Science in Information Technology",
          start_date: "2018-06-01",
          end_date: "2022-05-01",
        },
      ],
      certifications: [
        { certificate_name: "Meta Front-End Developer Certificate", issuing_organization: "Meta" },
        { certificate_name: "Responsive Web Design Certificate", issuing_organization: "freeCodeCamp" },
      ],
      social_links: [
        { platform_name: "GitHub", profile_url: "https://github.com/example" },
        { platform_name: "Portfolio", profile_url: "https://example.com" },
      ],
    };

    const rawCandidate = body.candidate
      ? {
          ...defaultRawCandidate,
          ...body.candidate,
          skills: body.candidate.skills ?? defaultRawCandidate.skills,
          work_experience: body.candidate.work_experience ?? defaultRawCandidate.work_experience,
          certifications: body.candidate.certifications ?? defaultRawCandidate.certifications,
        }
      : defaultRawCandidate;

    const normalizedCandidate = normalizeRawCandidate(rawCandidate);

    // 3. Execute Data-Driven Matching Engine
    const engineResult = runMatchingEngine(normalizedCandidate, {
      mode: MatchMode.ROLE_SIMILARITY,
      keyword,
      taxonomyContext,
    });

    return NextResponse.json({
      keyword,
      candidate: rawCandidate,
      resolvedContext: taxonomyContext,
      overallScore: engineResult.compatibility.score,
      rankingScore: engineResult.ranking.score,
      confidence: engineResult.confidence,
      sections: engineResult.compatibility.sections,
      strengths: engineResult.explanation.strengths,
      evidence: engineResult.evidence.map((e) => ({ label: e.label, value: e.value })),
      trace: engineResult.trace,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: safeErrorMessage(err, "Simulation error.") }, { status: 500 });
  }
}
