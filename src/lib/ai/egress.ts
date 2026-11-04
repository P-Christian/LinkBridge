// src/lib/ai/egress.ts
// Server-side egress guard for outbound AI provider calls (SSRF / internal port scan).
// Node runtime only: uses the OS resolver, so /etc/hosts entries still work.

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Hostnames that always point at cloud metadata / private service discovery. */
const BLOCKED_HOSTNAMES = new Set([
  "metadata",
  "instance-data",
  "metadata.goog",
]);

const BLOCKED_SUFFIXES = [".internal", ".local", ".metadata.goog"];

const MAX_EGRESS_HOPS = 3;

const UNSAFE = "Egress target is not reachable from this server: it resolves to a loopback, link-local, private or metadata address.";

/**
 * Private/loopback egress is only refused in production. A developer pointing a
 * provider at 127.0.0.1:11434 (Ollama) or a LAN vLLM box keeps working; in
 * production an operator must opt in explicitly with
 * AI_EGRESS_ALLOW_PRIVATE_NETWORKS=true (used for self-hosted models on a
 * trusted private network).
 */
function privateNetworksAllowed(): boolean {
  if (process.env.AI_EGRESS_ALLOW_PRIVATE_NETWORKS === "true") return true;
  return process.env.NODE_ENV !== "production";
}

function parseIntegerPart(part: string, radix: 8 | 10 | 16): number | null {
  if (!part) return null;
  const pattern = radix === 16 ? /^[0-9a-fA-F]+$/u : radix === 8 ? /^[0-7]+$/u : /^[0-9]+$/u;
  if (!pattern.test(part)) return null;
  const value = Number.parseInt(part, radix);
  return Number.isSafeInteger(value) ? value : null;
}

function parseOctetPart(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  if (text.startsWith("0x") || text.startsWith("0X")) return parseIntegerPart(text.slice(2), 16);
  if (text.length > 1 && text.startsWith("0")) return parseIntegerPart(text.slice(1), 8);
  return parseIntegerPart(text, 10);
}

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/**
 * inet_aton-style IPv4 parser: accepts dotted quad, short forms (127.1),
 * decimal (2852039166), hex (0xa9fea9fe) and octal-encoded literals.
 * Returns a 32-bit unsigned value or null when the text is not an IPv4 literal.
 */
function parseIpv4Literal(raw: string): number | null {
  const host = stripBrackets(raw.trim().toLowerCase());
  if (!host || host.includes(":")) return null;

  const parts = host.split(".");
  if (parts.length < 1 || parts.length > 4) return null;
  if (parts.some((p) => !p)) return null;

  const values: number[] = [];
  for (const part of parts) {
    const value = parseOctetPart(part);
    if (value === null) return null;
    values.push(value);
  }

  let result = 0;
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] > 255) return null;
    result = result * 256 + values[i];
  }

  const trailingGroups = 4 - (values.length - 1);
  const last = values[values.length - 1];
  if (last >= Math.pow(256, trailingGroups)) return null;
  result = result * Math.pow(256, trailingGroups) + last;

  return result >>> 0;
}

const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 8], // 0.0.0.0/8 "this network"
  [0x0a000000, 8], // 10.0.0.0/8
  [0x64400000, 10], // 100.64.0.0/10 CGNAT
  [0x7f000000, 8], // 127.0.0.0/8 loopback
  [0xa9fe0000, 16], // 169.254.0.0/16 link-local (incl. 169.254.169.254)
  [0xac100000, 12], // 172.16.0.0/12
  [0xc0000000, 24], // 192.0.0.0/24 IETF protocol assignments
  [0xc0000200, 24], // 192.0.2.0/24 TEST-NET-1
  [0xc6120000, 15], // 198.18.0.0/15 benchmarking
  [0xc6336400, 24], // 198.51.100.0/24 TEST-NET-2
  [0xcb007100, 24], // 203.0.113.0/24 TEST-NET-3
  [0xc0a80000, 16], // 192.168.0.0/16
  [0xe0000000, 4], // 224.0.0.0/4 multicast
  [0xf0000000, 4], // 240.0.0.0/4 reserved
];

function matchesIpv4Range(value: number, base: number, prefix: number): boolean {
  if (prefix >= 32) return value === base;
  const mask = prefix <= 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return ((value & mask) >>> 0) === ((base & mask) >>> 0);
}

function isBlockedIpv4(value: number): boolean {
  return BLOCKED_IPV4_RANGES.some(([base, prefix]) => matchesIpv4Range(value, base, prefix));
}

/** Expand an IPv6 literal (incl. :: shorthand and embedded IPv4) to 16 bytes. */
function parseIpv6Bytes(raw: string): number[] | null {
  let host = stripBrackets(raw.trim().toLowerCase());
  if (!host.includes(":")) return null;
  const zone = host.indexOf("%");
  if (zone !== -1) host = host.slice(0, zone);
  if (!host.includes(":")) return null;

  const lastColon = host.lastIndexOf(":");
  const tail = host.slice(lastColon + 1);
  if (tail.includes(".")) {
    const embedded = parseIpv4Literal(tail);
    if (embedded === null) return null;
    const hi = (embedded >>> 16) & 0xffff;
    const lo = embedded & 0xffff;
    host = `${host.slice(0, lastColon + 1)}${hi.toString(16)}:${lo.toString(16)}`;
  }

  const halves = host.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const groups: number[] = [];
  const pushGroups = (list: string[]): boolean => {
    for (const item of list) {
      if (!/^[0-9a-f]{1,4}$/u.test(item)) return false;
      groups.push(Number.parseInt(item, 16));
    }
    return true;
  };

  if (!pushGroups(head)) return null;

  if (halves.length === 1) {
    if (groups.length !== 8) return null;
  } else {
    const second = halves[1] ? halves[1].split(":") : [];
    if (!pushGroups(second)) return null;
    const fill = 8 - groups.length;
    if (fill < 1) return null;
    groups.splice(head.length, 0, ...Array.from({ length: fill }, () => 0));
  }

  const bytes: number[] = [];
  for (const group of groups) {
    bytes.push((group >>> 8) & 0xff, group & 0xff);
  }
  return bytes.length === 16 ? bytes : null;
}

function leadingBytesIpv4(bytes: number[], offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function isBlockedIpv6Bytes(bytes: number[]): boolean {
  const allZero = bytes.every((b) => b === 0);
  if (allZero) return true; // ::
  const loopback = bytes.slice(0, 15).every((b) => b === 0) && bytes[15] === 1;
  if (loopback) return true; // ::1
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if ((bytes[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique-local
  if (bytes[0] === 0xff) return true; // ff00::/8 multicast
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return true; // 2001:db8::/32 doc

  // Translations that embed an IPv4 destination must not smuggle a private v4.
  const firstTenZero = bytes.slice(0, 10).every((b) => b === 0);
  if (firstTenZero && bytes[10] === 0xff && bytes[11] === 0xff) {
    return isBlockedIpv4(leadingBytesIpv4(bytes, 12)); // ::ffff:0:0/96 mapped
  }
  if (firstTenZero) {
    return isBlockedIpv4(leadingBytesIpv4(bytes, 12)); // ::/96 IPv4-compatible
  }
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b) {
    return isBlockedIpv4(leadingBytesIpv4(bytes, 12)); // 64:ff9b::/96 NAT64
  }
  if (bytes[0] === 0x20 && bytes[1] === 0x02) {
    return isBlockedIpv4(leadingBytesIpv4(bytes, 2)); // 2002::/16 6to4
  }
  return false;
}

/** True when a numeric literal (any IPv4 encoding, or IPv6) is a blocked target. */
function isBlockedIpLiteral(host: string): boolean {
  const v4 = parseIpv4Literal(host);
  if (v4 !== null) return isBlockedIpv4(v4);
  const bytes = parseIpv6Bytes(host);
  if (bytes) return isBlockedIpv6Bytes(bytes);
  return false;
}

function isBlockedHostNameText(host: string): boolean {
  const clean = stripBrackets(host).toLowerCase().replace(/\.$/u, "");
  if (!clean) return true;
  if (BLOCKED_HOSTNAMES.has(clean)) return true;
  if (clean === "metadata.google.internal" || clean.endsWith(".metadata.google.internal")) return true;
  if (clean === "169.254.169.254" || clean === "169.254.169.254.nip.io") return true;
  return BLOCKED_SUFFIXES.some((suffix) => clean.endsWith(suffix));
}

function unsafe(message: string): Error {
  return new Error(message);
}

/**
 * Throw unless `url` is an http(s) URL whose host (resolved when it is a name)
 * is reachable as a public endpoint. Loopback/link-local/private/CGNAT targets
 * and cloud metadata addresses are refused; in non-production (or with
 * AI_EGRESS_ALLOW_PRIVATE_NETWORKS=true) private ranges are permitted so the
 * local Ollama workflow keeps working.
 */
export async function assertSafeEgressUrl(url: string | URL): Promise<URL> {
  let parsed: URL;
  try {
    parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());
  } catch {
    throw unsafe("Invalid egress URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw unsafe("Only http and https egress targets are supported.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (isBlockedHostNameText(hostname)) {
    throw unsafe("Access to cloud metadata and internal service-discovery hostnames is prohibited.");
  }

  if (isBlockedIpLiteral(hostname)) {
    throw unsafe(UNSAFE);
  }

  if (!isIP(stripBrackets(hostname))) {
    if (privateNetworksAllowed()) return parsed;

    let records: Array<{ address: string }> = [];
    try {
      records = await dnsLookup(hostname, { all: true, verbatim: true });
    } catch {
      throw unsafe(`Unable to resolve AI provider host '${hostname}'.`);
    }
    if (records.length === 0) throw unsafe(`Unable to resolve AI provider host '${hostname}'.`);

    for (const record of records) {
      if (isBlockedIpLiteral(record.address.toLowerCase())) throw unsafe(UNSAFE);
    }
  }

  return parsed;
}

/**
 * fetch() with redirects handled manually: every hop (including each redirect
 * target) is re-validated, so an allowlisted host cannot 302 the request to a
 * metadata or internal address.
 */
export async function fetchWithSafeEgress(input: string | URL, init?: RequestInit): Promise<Response> {
  let current = await assertSafeEgressUrl(input);
  let method = (init?.method || "GET").toUpperCase();
  let body: BodyInit | null = init?.body ?? null;

  for (let hop = 0; hop <= MAX_EGRESS_HOPS; hop++) {
    const res = await fetch(current.toString(), {
      ...init,
      method,
      body,
      redirect: "manual",
    });

    if (res.type === "opaqueredirect") {
      throw unsafe("AI provider returned an opaque redirect; following it is not permitted.");
    }

    const isRedirect = [301, 302, 303, 307, 308].includes(res.status);
    const location = isRedirect ? res.headers.get("location") : null;
    if (!isRedirect || !location) return res;
    if (hop === MAX_EGRESS_HOPS) throw unsafe("Too many redirects from the AI provider.");

    let next: URL;
    try {
      next = await assertSafeEgressUrl(new URL(location, current));
    } catch (err) {
      throw unsafe(
        `AI provider redirect to a blocked target was refused (${err instanceof Error ? err.message : "unsafe"})`
      );
    }

    if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
      method = "GET";
      body = null;
    }
    current = next;
  }

  throw unsafe("Too many redirects from the AI provider.");
}
