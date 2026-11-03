// src/app/api/vos-admin/career-articles/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator } from "@/lib/authenticated-session";
import { CareerArticleService } from "@/modules/vos-admin/career-advice-management/services/article.service";
import { UpdateCareerArticleSchema } from "@/modules/vos-admin/career-advice-management/types/article.schema";
import { safeErrorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const articleId = Number(id);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: "Invalid article ID" }, { status: 400 });
    }

    const article = await CareerArticleService.getArticleById(articleId);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json({ data: article });
  } catch (err: unknown) {
    console.error("[api/career-articles/[id] GET] Error:", err);
    const message = safeErrorMessage(err, "Failed to fetch article");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const articleId = Number(id);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: "Invalid article ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = UpdateCareerArticleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 422 });
    }

    const updated = await CareerArticleService.updateArticle(articleId, parsed.data);
    return NextResponse.json({ data: updated });
  } catch (err: unknown) {
    console.error("[api/career-articles/[id] PATCH] Error:", err);
    const message = safeErrorMessage(err, "Failed to update article");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const articleId = Number(id);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: "Invalid article ID" }, { status: 400 });
    }

    await CareerArticleService.deleteArticle(articleId);
    return NextResponse.json({ success: true, message: "Article deleted successfully" });
  } catch (err: unknown) {
    console.error("[api/career-articles/[id] DELETE] Error:", err);
    const message = safeErrorMessage(err, "Failed to delete article");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
