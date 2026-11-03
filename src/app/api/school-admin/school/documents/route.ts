import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  hasRole,
  isAdministratorSession,
  AuthenticatedSession,
} from "@/lib/authenticated-session";
import {
  SCHOOL_DOCUMENT_UPLOAD_POLICY,
  getUploadedFile,
  validateUploadedFile,
} from "@/lib/file-upload";
import { getPHTimeString } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const TARGET_FOLDER = "12bdc284-8351-4c3b-bf17-80cf37536ce3";

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

function isSchoolAdminSession(session: AuthenticatedSession): boolean {
  return hasRole(session, [4], ["SCHOOL_ADMIN", "SCHOOL ADMINISTRATOR", "SCHOOLADMIN"]);
}

async function getSchoolIdForUser(userId: number): Promise<number | null> {
  try {
    const adminUrl = `${DIRECTUS_BASE}/items/vs_school_admin?filter[user_id][_eq]=${userId}&filter[is_active][_eq]=true&limit=1`;
    const adminRes = await fetch(adminUrl, { headers: getHeaders(), cache: "no-store" });
    if (!adminRes.ok) return null;
    const adminJson = await adminRes.json();
    return adminJson.data?.[0]?.school_id || null;
  } catch {
    return null;
  }
}

interface SchoolDoc {
  school_document_id?: number | string;
  school_id: number;
  document_type: string;
  document_name: string;
  directus_file_id: string;
  uploaded_by_user_id?: number | null;
  uploaded_at?: string;
}

interface DirectusFile {
  id: string;
  filesize?: number | string;
}

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const isAdmin = isAdministratorSession(session);
    const isSchoolAdmin = isSchoolAdminSession(session);
    if (!isAdmin && !isSchoolAdmin) {
      return NextResponse.json(
        { error: "Forbidden: School administrators only." },
        { status: 403 }
      );
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json({ error: "Directus base URL not configured." }, { status: 500 });
    }

    const userId = Number(session.userId);
    const userSchoolId = await getSchoolIdForUser(userId);

    const { searchParams } = new URL(req.url);
    const schoolIdParam = searchParams.get("schoolId");

    let targetSchoolId: number | null = null;
    if (isAdmin && schoolIdParam) {
      targetSchoolId = Number(schoolIdParam);
    } else {
      targetSchoolId = userSchoolId;
      if (schoolIdParam && Number(schoolIdParam) !== userSchoolId) {
        return NextResponse.json(
          { error: "Forbidden: You cannot access documents for another school." },
          { status: 403 }
        );
      }
    }

    if (!targetSchoolId) {
      return NextResponse.json({ error: "Missing school assignment." }, { status: 400 });
    }

    const documentType = searchParams.get("documentType");

    let docsUrl = `${DIRECTUS_BASE}/items/vs_school_document?filter[school_id][_eq]=${targetSchoolId}&fields=*`;
    if (documentType) {
      docsUrl += `&filter[document_type][_eq]=${encodeURIComponent(documentType)}`;
    }
    const docsRes = await fetch(docsUrl, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!docsRes.ok) {
      const errText = await docsRes.text();
      console.warn(`Directus vs_school_document query warning (${docsRes.status}):`, errText);
      return NextResponse.json([]);
    }

    const docsJson = await docsRes.json();
    const docs: SchoolDoc[] = docsJson.data || [];

    const fileIds = docs.map((d) => d.directus_file_id).filter(Boolean);
    const fileSizes: Record<string, number> = {};

    if (fileIds.length > 0) {
      try {
        const filesUrl = `${DIRECTUS_BASE}/files?filter[id][_in]=${fileIds.join(",")}&fields=id,filesize`;
        const filesRes = await fetch(filesUrl, {
          headers: getHeaders(),
          cache: "no-store",
        });
        if (filesRes.ok) {
          const filesJson = await filesRes.json();
          const filesData: DirectusFile[] = filesJson.data || [];
          filesData.forEach((f) => {
            fileSizes[f.id] = f.filesize ? Number(f.filesize) : 0;
          });
        }
      } catch (err) {
        console.error("Failed to fetch filesizes:", err);
      }
    }

    const result = docs.map((d) => ({
      id: d.directus_file_id,
      school_document_id: d.school_document_id,
      document_type: d.document_type,
      name: d.document_name,
      size: fileSizes[d.directus_file_id] || 0,
      uploaded_at: d.uploaded_at || null,
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("GET /api/school-admin/school/documents error:", error);
    const msg = safeErrorMessage(error, "Internal server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const isAdmin = isAdministratorSession(session);
    const isSchoolAdmin = isSchoolAdminSession(session);
    if (!isAdmin && !isSchoolAdmin) {
      return NextResponse.json(
        { error: "Forbidden: School administrators only." },
        { status: 403 }
      );
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json({ error: "Directus base URL not configured." }, { status: 500 });
    }

    const userId = Number(session.userId);
    const userSchoolId = await getSchoolIdForUser(userId);

    const formData = await req.formData();
    const documentType = (formData.get("document_type") as string) || "OTHER_DOCUMENT";
    const schoolIdStr = formData.get("school_id") as string | null;

    let file: File;
    try {
      file = getUploadedFile(formData);
      await validateUploadedFile(file, SCHOOL_DOCUMENT_UPLOAD_POLICY);
    } catch (error: unknown) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid file." },
        { status: 400 }
      );
    }

    let targetSchoolId: number | null = null;
    if (isAdmin && schoolIdStr) {
      targetSchoolId = Number(schoolIdStr);
    } else {
      targetSchoolId = userSchoolId;
      if (schoolIdStr && Number(schoolIdStr) !== userSchoolId) {
        return NextResponse.json(
          { error: "Forbidden: You cannot upload documents for another school." },
          { status: 403 }
        );
      }
    }

    if (!targetSchoolId) {
      return NextResponse.json({ error: "Missing school assignment." }, { status: 400 });
    }

    // 1. Upload file to Directus storage
    const uploadUrl = `${DIRECTUS_BASE}/files`;
    const directusFormData = new FormData();
    directusFormData.append("file", file);
    directusFormData.append("folder", TARGET_FOLDER);

    const uploadHeaders: Record<string, string> = {};
    if (DIRECTUS_TOKEN) uploadHeaders["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: uploadHeaders,
      body: directusFormData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return NextResponse.json(
        { error: `Failed to upload file to storage: ${errText}` },
        { status: uploadRes.status }
      );
    }

    const uploadData = await uploadRes.json();
    const fileId = uploadData.data?.id || uploadData.id;

    if (!fileId) {
      return NextResponse.json({ error: "File upload returned invalid response." }, { status: 500 });
    }

    // 2. If it is a singular document type, clean up any existing document record for this type
    if (documentType !== "OTHER_DOCUMENT") {
      try {
        const existingUrl = `${DIRECTUS_BASE}/items/vs_school_document?filter[school_id][_eq]=${encodeURIComponent(String(targetSchoolId))}&filter[document_type][_eq]=${encodeURIComponent(documentType)}&fields=school_document_id,directus_file_id,school_id,document_type`;
        const existingRes = await fetch(existingUrl, { headers: getHeaders(), cache: "no-store" });
        if (existingRes.ok) {
          const existingJson = await existingRes.json();
          const existingDocs: SchoolDoc[] = existingJson.data || [];
          for (const oldDoc of existingDocs) {
            if (Number(oldDoc.school_id) !== Number(targetSchoolId) || oldDoc.document_type !== documentType) {
              continue;
            }
            // Delete metadata row
            await fetch(`${DIRECTUS_BASE}/items/vs_school_document/${oldDoc.school_document_id}`, {
              method: "DELETE",
              headers: getHeaders(),
            });
            // Delete old file asset if different
            if (oldDoc.directus_file_id && oldDoc.directus_file_id !== fileId) {
              await fetch(`${DIRECTUS_BASE}/files/${oldDoc.directus_file_id}`, {
                method: "DELETE",
                headers: getHeaders(),
              });
            }
          }
        }
      } catch (cleanErr) {
        console.warn("Cleanup of prior school document had non-fatal error:", cleanErr);
      }
    }

    // 3. Insert record into vs_school_document
    const nowPH = getPHTimeString();
    const docPayload = {
      school_id: targetSchoolId,
      document_type: documentType,
      document_name: file.name,
      directus_file_id: fileId,
      uploaded_by_user_id: userId,
      uploaded_at: nowPH,
    };

    const insertUrl = `${DIRECTUS_BASE}/items/vs_school_document`;
    const insertRes = await fetch(insertUrl, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(docPayload),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      return NextResponse.json(
        { error: `Failed to create document record: ${errText}` },
        { status: insertRes.status }
      );
    }

    const insertedJson = await insertRes.json();
    return NextResponse.json({
      success: true,
      data: {
        id: fileId,
        school_document_id: insertedJson.data?.school_document_id,
        document_type: documentType,
        name: file.name,
        size: file.size,
        uploaded_at: nowPH,
      },
    });
  } catch (error: unknown) {
    console.error("POST /api/school-admin/school/documents error:", error);
    const msg = safeErrorMessage(error, "Internal server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const isAdmin = isAdministratorSession(session);
    const isSchoolAdmin = isSchoolAdminSession(session);
    if (!isAdmin && !isSchoolAdmin) {
      return NextResponse.json(
        { error: "Forbidden: School administrators only." },
        { status: 403 }
      );
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json({ error: "Directus base URL not configured." }, { status: 500 });
    }

    const userId = Number(session.userId);
    const userSchoolId = await getSchoolIdForUser(userId);

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("id");

    if (!fileId) {
      return NextResponse.json({ error: "Missing document file ID." }, { status: 400 });
    }

    // 1. Find the vs_school_document record matching directus_file_id
    const findUrl = `${DIRECTUS_BASE}/items/vs_school_document?filter[directus_file_id][_eq]=${encodeURIComponent(fileId)}&fields=school_document_id,school_id`;
    const findRes = await fetch(findUrl, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!findRes.ok) {
      return NextResponse.json(
        { error: "Failed to locate school document." },
        { status: findRes.status }
      );
    }

    const findJson = await findRes.json();
    const records: SchoolDoc[] = findJson.data || [];
    if (records.length === 0) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    // Verify ownership of the document
    if (!isAdmin) {
      const unauthorizedDoc = records.find(
        (rec) => Number(rec.school_id) !== Number(userSchoolId)
      );
      if (unauthorizedDoc) {
        return NextResponse.json(
          {
            error:
              "Forbidden: You do not have permission to delete documents belonging to another school.",
          },
          { status: 403 }
        );
      }
    }

    for (const record of records) {
      await fetch(`${DIRECTUS_BASE}/items/vs_school_document/${record.school_document_id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
    }

    // 2. Delete asset in Directus storage
    const delFileUrl = `${DIRECTUS_BASE}/files/${fileId}`;
    const delFileRes = await fetch(delFileUrl, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (!delFileRes.ok && delFileRes.status !== 404) {
      console.warn(`Failed to delete asset ${fileId} in Directus: ${delFileRes.status}`);
    }

    return NextResponse.json({ success: true, message: "School document deleted successfully." });
  } catch (error: unknown) {
    console.error("DELETE /api/school-admin/school/documents error:", error);
    const msg = safeErrorMessage(error, "Internal server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
