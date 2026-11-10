// src/app/api/vos-admin/career-articles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator } from "@/lib/authenticated-session";
import { CareerArticleService } from "@/modules/vos-admin/career-advice-management/services/article.service";
import {
  CreateCareerArticleSchema,
  ArticleFilterSchema,
} from "@/modules/vos-admin/career-advice-management/types/article.schema";

import { safeErrorMessage } from "@/lib/api-error";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsedFilters = ArticleFilterSchema.safeParse({
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      status: searchParams.get("status") || undefined,
      is_featured: searchParams.get("is_featured") === "true" ? true : searchParams.get("is_featured") === "false" ? false : undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 10,
      sort_by: searchParams.get("sort_by") || "created_at",
      sort_order: searchParams.get("sort_order") || "desc",
    });

    if (!parsedFilters.success) {
      return NextResponse.json({ error: "Invalid filters", details: parsedFilters.error.format() }, { status: 400 });
    }

    const result = await CareerArticleService.listArticles(parsedFilters.data);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[api/career-articles GET] Error:", err);
    const message = safeErrorMessage(err, "Failed to fetch articles");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = CreateCareerArticleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 422 });
    }

    const created = await CareerArticleService.createArticle(parsed.data, auth.adminId);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err: unknown) {
    console.error("[api/career-articles POST] Error:", err);
    const message = safeErrorMessage(err, "Failed to create article");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
