// src/app/api/freelancer/settings/data-requests/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { authenticateRequest } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";
import { deleteApplicationAiAnalysis } from "@/lib/gemini/applicationAiStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

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

async function getUserIdFromReq(req: NextRequest): Promise<number | null> {
  const session = await authenticateRequest(req);
  return session ? Number(session.userId) : null;
}

// GET: Fetch requests & artifacts
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromReq(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Query vs_account_data_request
    const requestsRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_account_data_request?filter[user_id][_eq]=${userId}&sort=-requested_at&limit=50`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!requestsRes.ok) {
      const text = await requestsRes.text();
      console.error("Directus GET requests error:", text);
      return NextResponse.json({ error: "Failed to fetch account data requests." }, { status: requestsRes.status });
    }

    const requestsJson = await requestsRes.json();
    const requests = requestsJson.data || [];

    // Query vs_data_export_artifact
    const artifactsRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_data_export_artifact?filter[user_id][_eq]=${userId}&limit=50`,
      { headers: getHeaders(), cache: "no-store" }
    );

    const artifacts = artifactsRes.ok ? (await artifactsRes.json()).data : [];

    return NextResponse.json({ requests, artifacts });
  } catch (err: unknown) {
    console.error("GET /api/freelancer/settings/data-requests error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// POST: Create request
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromReq(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { request_type, policy_version, idempotency_key } = body;

    if (!request_type || !["export", "deactivation", "deletion"].includes(request_type)) {
      return NextResponse.json({ error: "Invalid request type." }, { status: 400 });
    }

    if (!idempotency_key) {
      return NextResponse.json({ error: "Idempotency key is required." }, { status: 400 });
    }

    // 1. Check duplicate active requests of same type
    const activeRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_account_data_request?filter[user_id][_eq]=${userId}&filter[request_type][_eq]=${request_type}&filter[status][_in]=initiated,pending_confirmation,confirmed,processing&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (activeRes.ok) {
      const activeJson = await activeRes.json();
      if (activeJson.data && activeJson.data.length > 0) {
        return NextResponse.json(
          { error: `You already have an active ${request_type} request.` },
          { status: 409 }
        );
      }
    }

    // 2. Insert new request
    const payload = {
      user_id: userId,
      request_type,
      status: "initiated",
      policy_version: policy_version || "1.0",
      idempotency_key,
      requested_at: new Date().toISOString(),
      expires_at: request_type === "export" 
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Export link valid for 7 days
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),   // Confirmation valid for 24h
    };

    const insertRes = await fetch(`${DIRECTUS_BASE}/items/vs_account_data_request`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!insertRes.ok) {
      const text = await insertRes.text();
      console.error("Directus create data request error:", text);
      return NextResponse.json({ error: "Failed to create data request." }, { status: insertRes.status });
    }

    const requestData = (await insertRes.json()).data;

    // PRIV-009: a deletion request from the data subject must actually remove
    // the AI evaluations retained about them (current rows and the superseded
    // history). Rows are filtered on the authenticated requester's own user id.
    if (request_type === "deletion") {
      let aiAnalysesDeleted = 0;
      try {
        aiAnalysesDeleted = await deleteApplicationAiAnalysis({ userId });
      } catch (purgeErr) {
        console.error("POST /api/freelancer/settings/data-requests AI purge error:", purgeErr);
      }
      return NextResponse.json({ request: requestData, aiAnalysesDeleted });
    }

    // Optional: Auto-confirm/simulate worker completion for mock purposes, 
    // especially for Export which is completed instantly in this implementation.
    if (request_type === "export") {
      const confirmPayload = {
        status: "completed",
        confirmed_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };
      
      const updateRes = await fetch(`${DIRECTUS_BASE}/items/vs_account_data_request/${requestData.request_id}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify(confirmPayload),
      });

      if (updateRes.ok) {
        const updatedReq = (await updateRes.json()).data;
        
        // Create download artifact
        const fileContent = JSON.stringify({ requestId: updatedReq.request_id, userId, exportedAt: new Date().toISOString() });
        const integrityHash = `sha256-${createHash("sha256").update(fileContent).digest("hex")}`;

        const artifactPayload = {
          request_id: updatedReq.request_id,
          user_id: userId,
          storage_object_id: `export_file_${updatedReq.request_id}.json`,
          integrity_hash: integrityHash,
          status: "active",
          generated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };

        await fetch(`${DIRECTUS_BASE}/items/vs_data_export_artifact`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(artifactPayload),
        });
        
        return NextResponse.json({ request: { ...updatedReq, status: "completed" } });
      }
    }

    return NextResponse.json({ request: requestData });
  } catch (err: unknown) {
    console.error("POST /api/freelancer/settings/data-requests error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// PATCH: Cancel/confirm request
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserIdFromReq(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { request_id, status } = body; // status: 'cancelled' or 'confirmed'

    if (!request_id || !["cancelled", "confirmed", "completed"].includes(status)) {
      return NextResponse.json({ error: "Invalid parameters." }, { status: 400 });
    }

    // 1. Fetch request details to ensure ownership and current state
    const fetchRes = await fetch(`${DIRECTUS_BASE}/items/vs_account_data_request/${request_id}`, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!fetchRes.ok) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    const request = (await fetchRes.json()).data;
    if (request.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (status === "cancelled" && !["initiated", "pending_confirmation"].includes(request.status)) {
      return NextResponse.json({ error: "Request cannot be cancelled at this stage." }, { status: 409 });
    }

    // 2. Perform state update
    const updatePayload: Record<string, unknown> = { status };
    if (status === "confirmed") {
      updatePayload.confirmed_at = new Date().toISOString();
      updatePayload.status = "confirmed";
    } else if (status === "completed") {
      updatePayload.completed_at = new Date().toISOString();
      updatePayload.status = "completed";
    }

    const updateRes = await fetch(`${DIRECTUS_BASE}/items/vs_account_data_request/${request_id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updatePayload),
    });

    if (!updateRes.ok) {
      return NextResponse.json({ error: "Failed to update request." }, { status: updateRes.status });
    }

    const updatedData = (await updateRes.json()).data;
    return NextResponse.json({ request: updatedData });
  } catch (err: unknown) {
    console.error("PATCH /api/freelancer/settings/data-requests error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}
