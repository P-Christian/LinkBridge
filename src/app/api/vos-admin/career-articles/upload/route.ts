// src/app/api/vos-admin/career-articles/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator } from "@/lib/authenticated-session";
import {
  CAREER_ARTICLE_ASSET_UPLOAD_POLICY,
  getUploadedFile,
  validateUploadedFile,
} from "@/lib/file-upload";
import { CareerArticleService } from "@/modules/vos-admin/career-advice-management/services/article.service";
import { AssetRole } from "@/modules/vos-admin/career-advice-management/types/article.types";
import { safeErrorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const TARGET_FOLDER_ID = "bc80f14e-57f8-4178-aa5c-b0a55999250c";

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdministrator(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const articleIdStr = formData.get("article_id") as string | null;
    const assetRole = (formData.get("asset_role") as string) || "INLINE_BODY";
    const caption = formData.get("caption") as string | null;

    let file: File;
    try {
      file = getUploadedFile(formData);
      await validateUploadedFile(file, CAREER_ARTICLE_ASSET_UPLOAD_POLICY);
    } catch (error: unknown) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid file." },
        { status: 400 }
      );
    }

    // Forward upload to Directus /files with specified folder
    const directusFormData = new FormData();
    directusFormData.append("folder", TARGET_FOLDER_ID);
    directusFormData.append("file", file);

    const headers: Record<string, string> = {};
    if (DIRECTUS_TOKEN) {
      headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
    }

    const uploadRes = await fetch(`${DIRECTUS_BASE}/files`, {
      method: "POST",
      headers,
      body: directusFormData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("[upload error from directus]:", errText);
      return NextResponse.json({ error: "Failed to upload file to Directus storage" }, { status: 502 });
    }

    const uploadJson = await uploadRes.json();
    const directusFile = uploadJson.data;
    const fileId: string = directusFile.id;
    // Use the application's authenticated asset proxy so browser images load correctly
    const fileUrl = `/api/assets/${fileId}`;

    let assetRecord = null;
    const articleId = articleIdStr ? Number(articleIdStr) : null;

    // If an article ID is already present, record in vs_career_article_assets junction table
    if (articleId && !isNaN(articleId)) {
      assetRecord = await CareerArticleService.attachAsset(articleId, {
        directus_file_id: fileId,
        file_url: fileUrl,
        file_name: directusFile.filename_download || file.name,
        file_type: directusFile.type || file.type,
        file_size_bytes: directusFile.filesize ? Number(directusFile.filesize) : file.size,
        asset_role: (assetRole as AssetRole) || "GALLERY",
        caption: caption || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        file_id: fileId,
        file_url: fileUrl,
        file_name: directusFile.filename_download || file.name,
        file_type: directusFile.type || file.type,
        file_size_bytes: directusFile.filesize || file.size,
        asset: assetRecord,
      },
    });
  } catch (err: unknown) {
    console.error("[api/career-articles/upload POST] Error:", err);
    const message = safeErrorMessage(err, "Failed to process upload");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
