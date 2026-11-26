import { NextResponse } from "next/server";

export async function GET(request: Request) {
    // Lightweight liveness probe for the realtime client: answers from this Next
    // server only and never calls Directus, so probing during an outage adds no load.
    if (new URL(request.url).searchParams.get("probe") === "1") {
        return NextResponse.json(
            { server: true },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    }

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    let databaseOnline = false;
    let databaseLatencyMs = 0;
    const startTime = Date.now();

    if (apiBase) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            // Ping directus server or user endpoint to test database/backend connectivity
            const res = await fetch(`${apiBase.replace(/\/$/, "")}/server/ping`, {
                method: "GET",
                signal: controller.signal,
                cache: "no-store",
            });
            clearTimeout(timeoutId);

            // If /server/ping returns 200 "pong" or any valid status response, database backend is online
            if (res.ok || res.status === 401 || res.status === 403) {
                databaseOnline = true;
            } else {
                // Fallback attempt: check /items/vs_user with limit 1
                const fallbackRes = await fetch(`${apiBase.replace(/\/$/, "")}/items/vs_user?limit=1`, {
                    method: "GET",
                    headers: process.env.DIRECTUS_STATIC_TOKEN 
                        ? { Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` } 
                        : {},
                    cache: "no-store",
                });
                if (fallbackRes.ok || fallbackRes.status === 401 || fallbackRes.status === 403) {
                    databaseOnline = true;
                }
            }
            databaseLatencyMs = Date.now() - startTime;
        } catch {
            databaseOnline = false;
            databaseLatencyMs = Date.now() - startTime;
        }
    }

    // Format PH Local Time (+8 hours UTC)
    const phTime = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace("Z", "+08:00");

    const status = databaseOnline ? "healthy" : "degraded";
    const httpStatus = databaseOnline ? 200 : 503;

    return NextResponse.json(
        {
            status,
            server: true,
            database: databaseOnline,
            latencyMs: databaseLatencyMs,
            timestamp: phTime,
            message: databaseOnline 
                ? "All systems operational" 
                : "Database backend is currently unreachable or undergoing maintenance.",
        },
        { status: httpStatus }
    );
}
