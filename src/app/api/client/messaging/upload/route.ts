import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import {
  MESSAGING_ATTACHMENT_UPLOAD_POLICY,
  getUploadedFile,
  validateUploadedFile,
} from "@/lib/file-upload";

import { safeErrorMessage } from "@/lib/api-error";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/,
  ""
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

// ─── POST — Upload a file attachment via Directus Files ────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json(
        { error: "Directus base URL not configured." },
        { status: 500 }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();

    let file: File;
    try {
      file = getUploadedFile(formData);
      await validateUploadedFile(file, MESSAGING_ATTACHMENT_UPLOAD_POLICY);
    } catch (error: unknown) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid file." },
        { status: 400 }
      );
    }

    // Forward to Directus files endpoint
    const uploadForm = new FormData();
    uploadForm.append("file", file, file.name);

    const uploadHeaders: Record<string, string> = {};
    if (DIRECTUS_TOKEN) {
      uploadHeaders["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
    }

    const uploadRes = await fetch(`${DIRECTUS_BASE}/files`, {
      method: "POST",
      headers: uploadHeaders,
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      console.error("Directus file upload error:", text);
      return NextResponse.json(
        { error: "Failed to upload file." },
        { status: uploadRes.status }
      );
    }

    const uploadJson = await uploadRes.json();
    const fileData = uploadJson.data;

    // Construct the public URL
    const fileUrl = `/api/assets/${fileData.id}`;

    return NextResponse.json({
      file_id: fileData.id,
      file_name: fileData.filename_download || file.name,
      file_path: fileUrl,
      file_size: file.size,
      mime_type: fileData.type || file.type,
    });
  } catch (err: unknown) {
    console.error("POST /api/client/messaging/upload error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}
