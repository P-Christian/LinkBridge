// Requests a link-only school admin invitation and validates the response shape.
export interface SchoolInviteResult {
  readonly invitationUrl: string;
  readonly expiresAt: string;
}

export async function requestSchoolInvite(
  schoolId: number,
  email: string,
): Promise<SchoolInviteResult | null> {
  try {
    const res = await fetch("/api/vos-admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school_id: schoolId, invited_email: email }),
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    if (typeof json !== "object" || json === null) return null;
    const { invitation_url, expires_at } = json as Record<string, unknown>;
    if (typeof invitation_url !== "string" || typeof expires_at !== "string") return null;
    return { invitationUrl: invitation_url, expiresAt: expires_at };
  } catch {
    return null;
  }
}
