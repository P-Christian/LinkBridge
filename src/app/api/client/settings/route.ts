// src/app/api/client/settings/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { revokeOtherUserSessions } from "@/modules/auth/sessions/session.repo";
import { getPHTimeString } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/,
  ""
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

/**
 * The projection the browser is allowed to read back. Both the GET and the
 * profile PATCH use it so a Directus column that is not listed here (password
 * hashes, OTP, block flags, role id) can never be echoed to the client.
 */
const PROFILE_FIELDS =
  "user_id,user_email,user_fname,user_mname,user_lname,suffix_name,nickname,user_contact,user_position,user_department,user_province,user_city,user_brgy,gender,user_bday,civil_status,profile_image_url,user_image,role";

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) {
    headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
  }
  return headers;
}

// ─── GET — Fetch user profile info ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }
    const userId = session.userId;

    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_user/${userId}?fields=${PROFILE_FIELDS}`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Directus fetch user error:", text);
      return NextResponse.json(
        { error: "Failed to fetch user profile." },
        { status: res.status }
      );
    }

    const json = await res.json();
    return NextResponse.json({ user: json.data });
  } catch (err: unknown) {
    console.error("GET /api/client/settings error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// ─── PATCH — Update user profile or change password ───────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }
    const userId = session.userId;

    const body = await req.json().catch(() => ({}));
    const type = body?.type;
    const payload = body?.payload;

    if (type === "PROFILE") {
      const cleanVal = (val: unknown) => {
        if (val === undefined) return undefined;
        if (typeof val === "string" && val.trim() === "") return null;
        return val;
      };

      const updateData: Record<string, unknown> = {};
      if (payload?.user_fname !== undefined) updateData.user_fname = payload.user_fname;
      if (payload?.user_mname !== undefined) updateData.user_mname = cleanVal(payload.user_mname);
      if (payload?.user_lname !== undefined) updateData.user_lname = payload.user_lname;
      if (payload?.suffix_name !== undefined) updateData.suffix_name = cleanVal(payload.suffix_name);
      if (payload?.nickname !== undefined) updateData.nickname = cleanVal(payload.nickname);
      if (payload?.user_contact !== undefined) updateData.user_contact = payload.user_contact;
      if (payload?.user_position !== undefined) updateData.user_position = cleanVal(payload.user_position);
      if (payload?.user_province !== undefined) updateData.user_province = cleanVal(payload.user_province);
      if (payload?.user_city !== undefined) updateData.user_city = cleanVal(payload.user_city);
      if (payload?.user_brgy !== undefined) updateData.user_brgy = cleanVal(payload.user_brgy);
      if (payload?.gender !== undefined) updateData.gender = cleanVal(payload.gender);
      if (payload?.user_bday !== undefined) updateData.user_bday = cleanVal(payload.user_bday);
      if (payload?.civil_status !== undefined) updateData.civil_status = cleanVal(payload.civil_status);
      if (payload?.profile_image_url !== undefined) updateData.profile_image_url = cleanVal(payload.profile_image_url);
      if (payload?.user_image !== undefined) updateData.user_image = cleanVal(payload.user_image);

      const res = await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}?fields=${PROFILE_FIELDS}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Directus update profile error:", text);
        return NextResponse.json(
          { error: "Failed to update profile." },
          { status: res.status }
        );
      }

      const json = await res.json();
      return NextResponse.json({ user: json.data });
    }

    if (type === "PASSWORD") {
      const currentPassword = String(payload?.current_password ?? "").trim();
      const newPassword = String(payload?.new_password ?? "").trim();
      const revokeOtherSessions = Boolean(payload?.revoke_other_sessions);

      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { error: "Current password and new password are required." },
          { status: 400 }
        );
      }

      // Fetch stored password hash
      const userRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_user/${userId}?fields=user_id,user_password,hash_password`,
        { headers: getHeaders(), cache: "no-store" }
      );

      if (!userRes.ok) {
        return NextResponse.json(
          { error: "Failed to verify account credentials." },
          { status: 500 }
        );
      }

      const userJson = await userRes.json();
      const storedUser = userJson.data;
      const storedHash = storedUser?.hash_password || storedUser?.user_password;

      // Fail closed: without a stored hash there is nothing to verify, so the
      // current password can never be proven and the change must be refused.
      if (!storedHash) {
        return NextResponse.json(
          { error: "This account has no password on record. Use the password reset flow." },
          { status: 403 }
        );
      }

      const matches = await bcrypt.compare(currentPassword, storedHash);
      if (!matches) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 400 }
        );
      }

      // Hash new password
      const newHash = await bcrypt.hash(newPassword, 10);

      const updateData: Record<string, unknown> = {
        hash_password: newHash,
        user_password: newHash,
      };

      if (revokeOtherSessions) {
        // Also update session_epoch to invalidate any legacy session tokens lacking sid
        updateData.session_epoch = getPHTimeString();
      }

      const patchRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify(updateData),
      });

      if (!patchRes.ok) {
        const text = await patchRes.text();
        console.error("Directus update password error:", text);
        return NextResponse.json(
          { error: "Failed to update password." },
          { status: patchRes.status }
        );
      }

      // Revoke all other active sessions in vs_user_sessions
      if (revokeOtherSessions) {
        const currentSid =
          typeof session.payload.sid === "string" ? session.payload.sid : null;
        await revokeOtherUserSessions(Number(userId), currentSid, "PASSWORD_RESET");
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action type." }, { status: 400 });
  } catch (err: unknown) {
    console.error("PATCH /api/client/settings error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}
