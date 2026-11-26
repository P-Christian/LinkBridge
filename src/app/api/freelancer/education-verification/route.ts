import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/authenticated-session";
import {
  EDUCATION_PROOF_DOCUMENT_TYPES,
  EducationProofError,
  submitEducationProof,
  type EducationProofDocumentType,
} from "@/modules/education-verification/education-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof EducationProofError) {
    switch (error.code) {
      case "INVALID_INPUT":
        return NextResponse.json({ error: error.message }, { status: 400 });
      case "NOT_FOUND":
        return NextResponse.json({ error: error.message }, { status: 404 });
      case "CONFLICT":
        return NextResponse.json({ error: error.message }, { status: 409 });
      case "DEPENDENCY_FAILURE":
        return NextResponse.json({ error: "Education verification storage is unavailable." }, { status: 502 });
    }
  }
  console.error("[freelancer-education-verification] Submit failed:", error);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const userId = Number(session.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "A multipart form body is required." }, { status: 400 });
    }

    const educationRaw = formData.get("educationId");
    const educationId = Number(typeof educationRaw === "string" ? educationRaw.trim() : educationRaw);
    if (!Number.isSafeInteger(educationId) || educationId <= 0) {
      return NextResponse.json({ error: "A valid education is required." }, { status: 400 });
    }

    const documentTypesRaw = formData.get("documentTypes");
    if (typeof documentTypesRaw !== "string" || !documentTypesRaw.trim()) {
      return NextResponse.json({ error: "documentTypes must be a JSON array of strings." }, { status: 400 });
    }
    let documentTypes: unknown;
    try {
      documentTypes = JSON.parse(documentTypesRaw);
    } catch {
      return NextResponse.json({ error: "documentTypes must be a JSON array of strings." }, { status: 400 });
    }
    if (!Array.isArray(documentTypes) || documentTypes.length < 1 || documentTypes.length > 5) {
      return NextResponse.json({ error: "Submit between 1 and 5 proof documents." }, { status: 400 });
    }
    for (const entry of documentTypes) {
      if (typeof entry !== "string" || !EDUCATION_PROOF_DOCUMENT_TYPES.includes(entry as EducationProofDocumentType)) {
        return NextResponse.json({ error: "Unsupported proof document type." }, { status: 400 });
      }
    }
    const typedDocumentTypes = documentTypes as EducationProofDocumentType[];

    const fileValues = formData.getAll("files").filter((value): value is File => value instanceof File);
    const legacyFileValues = fileValues.length === 0
      ? formData.getAll("file").filter((value): value is File => value instanceof File)
      : [];
    const files = fileValues.length > 0 ? fileValues : legacyFileValues;
    if (files.length < 1 || files.length > 5) {
      return NextResponse.json({ error: "Submit between 1 and 5 proof documents." }, { status: 400 });
    }
    if (typedDocumentTypes.length !== files.length) {
      return NextResponse.json({ error: "documentTypes and files must have the same length." }, { status: 400 });
    }

    const documents = typedDocumentTypes.map((documentType, index) => {
      const file = files[index];
      if (!isRecord(file) || !(file instanceof File)) {
        throw new Error("A valid file is required.");
      }
      return { documentType, file };
    });

    const result = await submitEducationProof({ userId, educationId, documents });
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    return toErrorResponse(error);
  }
}
