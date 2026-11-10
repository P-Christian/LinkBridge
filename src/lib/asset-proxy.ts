import { NextRequest, NextResponse } from "next/server";
import { AuthenticatedSession } from "@/lib/authenticated-session";
import { authorizeAssetAccess } from "@/lib/protected-assets";

function getDirectusConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = (
    process.env.DIRECTUS_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || ""
  ).replace(/\/$/u, "");
  const token = process.env.DIRECTUS_STATIC_TOKEN?.trim() || "";
  return baseUrl && token ? { baseUrl, token } : null;
}

/**
 * Inline-render allowlist (SEC-011). Anything the browser could execute or
 * parse as markup — and any type not imagined when this list was written — is
 * forced to download instead. `image/svg+xml` is excluded on purpose: it is an
 * XML document that runs script inline, and `application/xhtml+xml` was the
 * gap in the previous denylist.
 */
const INLINE_SAFE_CONTENT_TYPES =
  /^image\/(?:png|jpeg|jpg|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)|^application\/pdf/i;

/** Shared protected/public asset proxy used by the legacy URL aliases. */
export async function proxyDirectusAsset(
  req: NextRequest,
  id: string,
  session: AuthenticatedSession | null,
): Promise<NextResponse> {
  if (!id || id === "undefined" || id === "null" || id.includes("/")) {
    return NextResponse.json({ error: "Missing asset ID" }, { status: 400 });
  }

  const config = getDirectusConfig();
  if (!config) return NextResponse.json({ error: "Directus base URL not configured." }, { status: 500 });

  const access = await authorizeAssetAccess(id, session);
  if (!access.allowed) {
    if (access.notFound) return new NextResponse(null, { status: 404 });
    return NextResponse.json(
      { error: session ? "You are not authorized to access this asset." : "Unauthorized." },
      { status: session ? 403 : 401 },
    );
  }

  try {
    const query = new URL(req.url).searchParams.toString();
    const url = `${config.baseUrl}/assets/${encodeURIComponent(id)}${query ? `?${query}` : ""}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.token}` },
      cache: "no-store",
    });
    if (!response.ok) return new NextResponse(null, { status: response.status });

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const isSafeInline = INLINE_SAFE_CONTENT_TYPES.test(contentType);

    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": access.protected
        ? "private, no-store"
        : response.headers.get("cache-control") || "public, max-age=31536000",
    };
    if (!isSafeInline) {
      responseHeaders["Content-Disposition"] = "attachment";
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    return new NextResponse(Buffer.from(await response.arrayBuffer()), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Assets proxy route error:", error);
    return NextResponse.json({ error: "Asset retrieval failed." }, { status: 502 });
  }
}

