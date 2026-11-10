// src/modules/auth/google/identity.repo.ts
import crypto from "crypto";

export interface UserIdentityRecord {
  identity_id: string;
  user_id: number;
  provider: string;
  provider_subject: string;
  provider_key: string;
  user_provider_key: string;
  provider_email: string;
  provider_name?: string | null;
  email_verified: boolean;
  linked_at: string;
  last_login_at: string;
}

function getDirectusConfig() {
  const baseUrl = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).replace(/\/$/, "");
  const token = process.env.DIRECTUS_STATIC_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("Directus API URL or Static Token is not configured.");
  }

  return { baseUrl, token };
}

export function getPHDateTimeString(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .substring(0, 19);
}

/** Looks up a federated identity by provider and subject claim (e.g. Google sub) */
export async function getUserIdentityBySubject(
  provider: string,
  subject: string
): Promise<UserIdentityRecord | null> {
  const { baseUrl, token } = getDirectusConfig();
  const url = `${baseUrl}/items/vs_user_identity?filter[provider][_eq]=${encodeURIComponent(
    provider
  )}&filter[provider_subject][_eq]=${encodeURIComponent(subject)}&limit=1`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to query vs_user_identity: HTTP ${res.status}`);
  }

  const json = (await res.json()) as { data?: UserIdentityRecord[] };
  if (Array.isArray(json.data) && json.data.length > 0) {
    return json.data[0];
  }
  return null;
}

/** Looks up a federated identity by user_id and provider */
export async function getUserIdentityByUserId(
  userId: string | number,
  provider: string
): Promise<UserIdentityRecord | null> {
  const { baseUrl, token } = getDirectusConfig();
  const numId = Number(userId);
  const url = `${baseUrl}/items/vs_user_identity?filter[user_id][_eq]=${numId}&filter[provider][_eq]=${encodeURIComponent(
    provider
  )}&limit=1`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to query vs_user_identity for user: HTTP ${res.status}`);
  }

  const json = (await res.json()) as { data?: UserIdentityRecord[] };
  if (Array.isArray(json.data) && json.data.length > 0) {
    return json.data[0];
  }
  return null;
}

/** Atomically links or updates a provider identity for a user */
export async function linkUserIdentity(params: {
  userId: string | number;
  provider: string;
  providerSubject: string;
  providerEmail: string;
  providerName?: string | null;
}): Promise<UserIdentityRecord> {
  const { baseUrl, token } = getDirectusConfig();
  const numUserId = Number(params.userId);
  const nowPH = getPHDateTimeString();

  const existing = await getUserIdentityByUserId(numUserId, params.provider);

  if (existing) {
    const updatePayload: Record<string, unknown> = {
      provider_subject: params.providerSubject,
      provider_key: `${params.provider}:${params.providerSubject}`,
      provider_email: params.providerEmail,
      email_verified: true,
      last_login_at: nowPH,
    };

    if (params.providerName !== undefined) {
      updatePayload.provider_name = params.providerName;
    }

    const res = await fetch(`${baseUrl}/items/vs_user_identity/${existing.identity_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Failed to update vs_user_identity: HTTP ${res.status} ${errText}`);
    }

    const json = await res.json();
    return json.data;
  }

  const identityId = crypto.randomUUID();
  const newRecord: Record<string, unknown> = {
    identity_id: identityId,
    user_id: numUserId,
    provider: params.provider,
    provider_subject: params.providerSubject,
    provider_key: `${params.provider}:${params.providerSubject}`,
    user_provider_key: `${numUserId}:${params.provider}`,
    provider_email: params.providerEmail,
    provider_name: params.providerName ?? null,
    email_verified: true,
    linked_at: nowPH,
    last_login_at: nowPH,
  };

  const res = await fetch(`${baseUrl}/items/vs_user_identity`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(newRecord),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Failed to create vs_user_identity: HTTP ${res.status} ${errText}`);
  }

  const json = await res.json();
  return json.data;
}

/** Unlinks a provider identity for a user */
export async function unlinkUserIdentity(
  userId: string | number,
  provider: string
): Promise<boolean> {
  const { baseUrl, token } = getDirectusConfig();
  const existing = await getUserIdentityByUserId(userId, provider);

  if (!existing) {
    return false;
  }

  const res = await fetch(`${baseUrl}/items/vs_user_identity/${existing.identity_id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete vs_user_identity: HTTP ${res.status}`);
  }

  return true;
}

/** Updates last_login_at timestamp for a provider identity in PH time */
export async function updateIdentityLastLogin(identityId: string): Promise<void> {
  const { baseUrl, token } = getDirectusConfig();
  const nowPH = getPHDateTimeString();

  await fetch(`${baseUrl}/items/vs_user_identity/${identityId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ last_login_at: nowPH }),
  }).catch(() => {});
}
