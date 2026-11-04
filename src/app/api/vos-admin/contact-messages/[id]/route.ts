// src/app/api/vos-admin/contact-messages/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { getPHTimeString } from "@/lib/utils";
import {
  fetchContactMessageByIdRepo,
  patchContactMessageRepo,
  softDeleteContactMessageRepo,
  markAsReadRepo,
  type ContactMessageStatus,
} from "@/modules/vos-admin/contact-messages";

const VALID_STATUSES = new Set<ContactMessageStatus>(["new", "read", "resolved", "archived"]);

const patchSchema = z.object({
  status: z
    .string()
    .refine((v) => VALID_STATUSES.has(v as ContactMessageStatus), {
      message: "Invalid status value.",
    })
    .optional(),
  internal_note: z
    .string()
    .max(2000, "Internal note must be 2000 characters or less.")
    .optional(),
});

// ---------------------------------------------------------------------------
// GET /api/vos-admin/contact-messages/[id]
// Opening a 'new' message auto-advances it to 'read'.
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await authenticateRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdministratorSession(session)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return NextResponse.json({ error: "Invalid message ID." }, { status: 400 });
    }

    const msg = await fetchContactMessageByIdRepo(numId);
    if (!msg) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    const warnings: string[] = [];

    // Auto-advance 'new' → 'read'
    if (msg.status === "new") {
      const now = getPHTimeString();
      try {
        await markAsReadRepo(numId, Number(session.userId), now);
        msg.status = "read";
        msg.reviewed_by = Number(session.userId);
        msg.reviewed_at = now;
      } catch {
        // The body is still readable, but claiming it was read would move it out
        // of the "New" queue on screen while the row is untouched in Directus.
        warnings.push("The message opened, but it could not be marked as read.");
      }
    }

    return NextResponse.json({
      item: msg,
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (error: unknown) {
    console.error("[GET /api/vos-admin/contact-messages/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/vos-admin/contact-messages/[id]
// Update status and/or internal_note.
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await authenticateRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdministratorSession(session)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return NextResponse.json({ error: "Invalid message ID." }, { status: 400 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed." },
        { status: 400 }
      );
    }

    const { status, internal_note } = parsed.data;

    if (!status && internal_note === undefined) {
      return NextResponse.json(
        { error: "Provide at least one of: status, internal_note." },
        { status: 400 }
      );
    }

    const existing = await fetchContactMessageByIdRepo(numId);
    if (!existing) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    const now = getPHTimeString();
    const updated = await patchContactMessageRepo(numId, {
      ...(status ? { status: status as ContactMessageStatus } : {}),
      ...(internal_note !== undefined ? { internal_note } : {}),
      reviewed_by: Number(session.userId),
      reviewed_at: now,
      updated_at: now,
    });

    return NextResponse.json({ item: updated });
  } catch (error: unknown) {
    console.error("[PATCH /api/vos-admin/contact-messages/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/vos-admin/contact-messages/[id]
// Soft-delete only — sets deleted_at, never removes the row.
// ---------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await authenticateRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdministratorSession(session)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return NextResponse.json({ error: "Invalid message ID." }, { status: 400 });
    }

    const existing = await fetchContactMessageByIdRepo(numId);
    if (!existing) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    await softDeleteContactMessageRepo(numId, getPHTimeString());
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/vos-admin/contact-messages/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
