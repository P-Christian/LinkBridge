// src/modules/client/applicants/utils/applicantAiCache.ts

export interface AlternativeJobMatch {
  job_id: number;
  job_title: string;
  match_score: number;
  reasoning: string;
}

export interface CandidateAiAnalysis {
  match_score: number;
  // Gemini words this freely; the badge colours come from match_score.
  fit_level: string;
  executive_summary: string;
  strengths: string[];
  gaps_or_considerations: string[];
  screening_assessment?: string | null;
  recommendation: string;
  alternative_job_recommendations?: AlternativeJobMatch[];
  analyzed_at: string;
}

const CACHE_PREFIX = "vos_applicant_ai_analysis_";
const KEY_STORAGE_NAME = "vos_sec_ai_k";

/**
 * AI assessments of candidates contain sensitive PII and evaluation data.
 * - Retained in client storage for 24 hours (1 day) to prevent excessive AI queries.
 * - Encrypted at rest using native AES-GCM (256-bit) to prevent peeking/tampering.
 * - In-memory L1 cache provides 0ms reads during the active session.
 * - Everything is purged upon logout (see purgeApplicantAiCache).
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (1 day)

// L1 In-Memory Cache for 0ms lookups during active session
const memoryL1Cache = new Map<number, CandidateAiAnalysis>();
let cachedCryptoKey: CryptoKey | null = null;

function isExpired(analysis: CandidateAiAnalysis | null | undefined): boolean {
  const analyzedAt = Date.parse(analysis?.analyzed_at ?? "");
  if (!Number.isFinite(analyzedAt)) return true;
  return Date.now() - analyzedAt > CACHE_TTL_MS;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getOrCreateCryptoKey(): Promise<CryptoKey | null> {
  if (cachedCryptoKey) return cachedCryptoKey;
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) return null;

  try {
    const stored = localStorage.getItem(KEY_STORAGE_NAME);
    if (stored) {
      const rawBytes = base64ToBytes(stored);
      cachedCryptoKey = await window.crypto.subtle.importKey(
        "raw",
        rawBytes as unknown as BufferSource,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );
      return cachedCryptoKey;
    }

    // Generate a fresh 256-bit AES-GCM key
    const newKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const exportedRaw = await window.crypto.subtle.exportKey("raw", newKey);
    const rawB64 = bytesToBase64(new Uint8Array(exportedRaw));
    localStorage.setItem(KEY_STORAGE_NAME, rawB64);

    cachedCryptoKey = newKey;
    return cachedCryptoKey;
  } catch (err) {
    console.error("Failed to initialize storage encryption key:", err);
    return null;
  }
}

async function encryptData(analysis: CandidateAiAnalysis): Promise<string | null> {
  const key = await getOrCreateCryptoKey();
  if (!key || typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    return null;
  }

  try {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(analysis));
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      key,
      encoded as unknown as BufferSource
    );

    const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuffer), iv.length);

    return bytesToBase64(combined);
  } catch (err) {
    console.error("Failed to encrypt candidate analysis:", err);
    return null;
  }
}

async function decryptData(cipherString: string): Promise<CandidateAiAnalysis | null> {
  const key = await getOrCreateCryptoKey();
  if (!key || typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    return null;
  }

  try {
    const combined = base64ToBytes(cipherString);
    if (combined.length <= 12) return null;

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );

    const decoded = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decoded) as CandidateAiAnalysis;
  } catch {
    // Decryption failed (tampered data or corrupted key)
    return null;
  }
}

export async function getCachedApplicantAnalysis(applicationId: number): Promise<CandidateAiAnalysis | null> {
  if (typeof window === "undefined" || !applicationId) return null;

  // 1. Fast L1 Memory Cache
  if (memoryL1Cache.has(applicationId)) {
    const cached = memoryL1Cache.get(applicationId)!;
    if (isExpired(cached)) {
      memoryL1Cache.delete(applicationId);
      clearCachedApplicantAnalysis(applicationId);
      return null;
    }
    return cached;
  }

  // 2. Encrypted Storage Lookup
  try {
    const key = `${CACHE_PREFIX}${applicationId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    // Backward-compatibility: Check if raw was unencrypted JSON
    if (raw.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(raw) as CandidateAiAnalysis;
        if (isExpired(parsed)) {
          localStorage.removeItem(key);
          return null;
        }
        // Migrate to encrypted format in background
        void setCachedApplicantAnalysis(applicationId, parsed);
        memoryL1Cache.set(applicationId, parsed);
        return parsed;
      } catch {
        localStorage.removeItem(key);
        return null;
      }
    }

    const decrypted = await decryptData(raw);
    if (!decrypted || isExpired(decrypted)) {
      localStorage.removeItem(key);
      return null;
    }

    memoryL1Cache.set(applicationId, decrypted);
    return decrypted;
  } catch {
    return null;
  }
}

export async function setCachedApplicantAnalysis(
  applicationId: number,
  analysis: CandidateAiAnalysis
): Promise<void> {
  if (typeof window === "undefined" || !applicationId || !analysis) return;

  // Update in-memory cache immediately
  memoryL1Cache.set(applicationId, analysis);

  try {
    const encrypted = await encryptData(analysis);
    if (encrypted) {
      localStorage.setItem(`${CACHE_PREFIX}${applicationId}`, encrypted);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function clearCachedApplicantAnalysis(applicationId: number): void {
  if (typeof window === "undefined" || !applicationId) return;
  memoryL1Cache.delete(applicationId);
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${applicationId}`);
  } catch {
    // Ignore
  }
}

export function purgeApplicantAiCache(): void {
  if (typeof window === "undefined") return;
  memoryL1Cache.clear();
  cachedCryptoKey = null;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(CACHE_PREFIX) || key === KEY_STORAGE_NAME)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore storage access errors
  }
}
