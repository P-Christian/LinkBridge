// src/app/api/vos-admin/career-articles/assets/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator } from "@/lib/authenticated-session";
import { CareerArticleService } from "@/modules/vos-admin/career-advice-management/services/article.service";
import { safeErrorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdministrator(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const assetId = Number(id);
    if (isNaN(assetId)) {
      return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const updated = await CareerArticleService.updateAsset(assetId, {
      caption: body.caption,
      asset_role: body.asset_role,
      display_order: body.display_order,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: unknown) {
    console.error("[api/career-articles/assets/[id] PATCH] Error:", err);
    const message = safeErrorMessage(err, "Failed to update asset");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdministrator(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const assetId = Number(id);
    if (isNaN(assetId)) {
      return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
    }

    await CareerArticleService.removeAsset(assetId);
    return NextResponse.json({ success: true, message: "Asset deleted" });
  } catch (err: unknown) {
    console.error("[api/career-articles/assets/[id] DELETE] Error:", err);
    const message = safeErrorMessage(err, "Failed to delete asset");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
