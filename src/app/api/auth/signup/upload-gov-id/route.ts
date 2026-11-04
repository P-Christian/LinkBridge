import { NextRequest, NextResponse } from "next/server";
import { legacyRegistrationRetiredResponse } from "@/modules/auth/registration";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/,
  ""
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

/**
 * POST /api/auth/signup/upload-gov-id
 *
 * Uploads a government-issued ID file to Directus storage using the static
 * service token. No user auth required — safe to call during employer signup
 * before the account has been created.
 *
 * Body: multipart/form-data
 *   file     — The image or PDF file (.jpg, .png, .pdf, max 5MB)
 *   govIdType — e.g. "Philippine Passport"
 *
 * Returns: { fileId: string }
 */
export async function POST(req: NextRequest) {
  const retired = legacyRegistrationRetiredResponse();
  if (retired) return retired;
  try {
    if (!DIRECTUS_BASE) {
      return NextResponse.json(
        { error: "Directus base URL is not configured." },
        { status: 500 }
      );
    }

    if (!DIRECTUS_TOKEN) {
      return NextResponse.json(
        { error: "Directus token is not configured." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const folder = formData.get("folder");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided." },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only .jpg, .jpeg, .png, .pdf, and .docx files are accepted.",
        },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the 10MB limit." },
        { status: 400 }
      );
    }

    // Upload to Directus using static token
    const directusForm = new FormData();
    directusForm.append("file", file);
    if (folder) {
      directusForm.append("folder", String(folder));
    }

    const res = await fetch(`${DIRECTUS_BASE}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      },
      body: directusForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[upload-gov-id] Directus upload failed:", errText);
      return NextResponse.json(
        { error: `Upload to storage failed: ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const fileId = data?.data?.id as string | undefined;

    if (!fileId) {
      return NextResponse.json(
        { error: "Upload succeeded but no file ID was returned from storage." },
        { status: 502 }
      );
    }

    return NextResponse.json({ fileId });
  } catch (error: unknown) {
    const msg =
      safeErrorMessage(error, "Internal server error");
    console.error("[upload-gov-id] Error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
