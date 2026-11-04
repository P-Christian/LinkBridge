import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator } from "@/lib/authenticated-session";

export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "")
  .split("#")[0]
  .trim()
  .replace(/\/$/, "");
const DIRECTUS_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || "")
  .split("#")[0]
  .trim();

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdministrator(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json({ error: "Directus API base URL not configured" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Limit size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });
    }

    const directusFormData = new FormData();
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
      console.error("[Platform Company Upload Directus Error]:", errText);
      return NextResponse.json({ error: "Failed to upload image to Directus" }, { status: 502 });
    }

    const uploadJson = await uploadRes.json();
    const fileId: string = uploadJson.data?.id;
    const fileUrl = `/api/assets/${fileId}`;

    return NextResponse.json({
      file_id: fileId,
      file_url: fileUrl,
      title: uploadJson.data?.title || file.name,
      filename_download: uploadJson.data?.filename_download || file.name,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
