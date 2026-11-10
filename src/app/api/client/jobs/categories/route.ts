// src/app/api/client/jobs/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

export interface RoleCategory {
  category_id: number;
  category_code: string;
  category_name: string;
  description?: string | null;
  is_active?: boolean;
}

const FALLBACK_CATEGORIES: RoleCategory[] = [
  { category_id: 1, category_code: "marketing", category_name: "Digital Marketing & Social Media", description: "Marketing, content, SEO, social" },
  { category_id: 2, category_code: "frontend", category_name: "Frontend Software Engineering", description: "React, Vue, Angular, UI" },
  { category_id: 3, category_code: "backend", category_name: "Backend Software Engineering", description: "APIs, services, databases" },
  { category_id: 4, category_code: "fullstack", category_name: "Full Stack Software Engineering", description: "End-to-end web development" },
  { category_id: 5, category_code: "mobile", category_name: "Mobile App Development", description: "iOS, Android, Flutter, React Native" },
  { category_id: 6, category_code: "devops", category_name: "DevOps & Cloud Infrastructure", description: "AWS, Azure, Kubernetes, CI/CD" },
  { category_id: 7, category_code: "data", category_name: "Data Engineering & Analytics", description: "ETL, SQL, warehousing, data science, AI" },
  { category_id: 8, category_code: "qa", category_name: "Quality Assurance & Software Testing", description: "QA, automation, manual testing" },
  { category_id: 9, category_code: "design", category_name: "UI/UX & Product Design", description: "Figma, UX research, interface design" },
];

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json({ categories: FALLBACK_CATEGORIES });
    }

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_category?limit=-1&sort=category_name`, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ categories: FALLBACK_CATEGORIES });
    }

    const json = await res.json();
    const categories: RoleCategory[] = (json.data ?? []).filter(
      (c: RoleCategory) => c.is_active !== false
    );

    return NextResponse.json({
      categories: categories.length > 0 ? categories : FALLBACK_CATEGORIES,
    });
  } catch (err: unknown) {
    console.error("Error fetching job categories from Directus:", err);
    return NextResponse.json({ categories: FALLBACK_CATEGORIES });
  }
}
