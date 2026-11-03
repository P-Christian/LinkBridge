import {
  AuthenticatedSession,
  isAdministratorSession,
  isClientSession,
  isFreelancerSession,
  isSchoolAdminSession,
} from "@/lib/authenticated-session";

export type ProtectedAssetKind =
  | "CLIENT_DOCUMENT"
  | "FREELANCER_RESUME"
  | "FREELANCER_IDENTITY"
  | "ASSESSMENT_PROOF"
  | "SCHOOL_DOCUMENT"
  | "MESSAGE_ATTACHMENT"
  | "UNKNOWN";

export interface AssetAuthorization {
  allowed: boolean;
  protected: boolean;
  notFound: boolean;
  kind: ProtectedAssetKind;
}

interface DirectusFile {
  id?: string;
  folder?: string | { id?: string; name?: string } | null;
}

interface CompanyDocument {
  company_id?: string | number | { company_id?: string | number } | null;
  directus_file_id?: string | null;
}

interface ResumeRecord {
  user_id?: string | number | { user_id?: string | number } | null;
  file_url?: string | null;
}

interface IdentityRecord {
  user_id?: string | number | { user_id?: string | number } | null;
}

interface AssessmentProofRecord {
  attempt_id?: string | number | null;
}

interface SchoolDocumentRecord {
  school_id?: string | number | null;
  directus_file_id?: string | null;
}

interface MessageAttachmentRecord {
  attachment_id?: string | number | null;
  message_id?: string | number | null;
  file_path?: string | null;
}

interface ConversationRecord {
  conversation_id?: string | number | null;
  client_id?: string | number | null;
  freelancer_id?: string | number | null;
}

interface DirectusCollectionResponse<T> {
  data?: T[];
}

const KNOWN_PROTECTED_FOLDER_IDS = [
  // Existing deployments use these folders; env values below take precedence
  // and are the required configuration for new environments.
  "e81cc874-8036-4655-8bbb-1524a194866b", // freelancer identity documents
  "c380f14b-75d1-4b61-b2b4-9a6e596f3162", // freelancer resumes
  "49ce8918-ac09-476f-9b25-14a2c9dfad48", // assessment proofs
];

const PROTECTED_FOLDER_NAMES = new Set([
  "client_documents",
  "client_identity_documents",
  "freelancer_documents",
  "freelancer_identity_documents",
  "identity_documents",
  "resume_documents",
  "resumes",
  "assessment_proofs",
  "protected_documents",
]);

function directusConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = (
    process.env.DIRECTUS_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || ""
  ).replace(/\/$/u, "");
  const token = process.env.DIRECTUS_STATIC_TOKEN?.trim() || "";
  return baseUrl && token ? { baseUrl, token } : null;
}

function headers(token: string): Record<string, string> {
  return { Accept: "application/json", Authorization: `Bearer ${token}` };
}

function sameId(left: unknown, right: unknown): boolean {
  return left !== null && left !== undefined && right !== null && right !== undefined && String(left) === String(right);
}

function nestedId(value: unknown, key: "company_id" | "user_id"): string | number | null {
  if (typeof value === "object" && value !== null) {
    const nested = (value as Record<string, unknown>)[key];
    return typeof nested === "string" || typeof nested === "number" ? nested : null;
  }
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function protectedFolderIds(): Set<string> {
  const configured = [
    process.env.DIRECTUS_PROTECTED_CLIENT_DOCUMENTS_FOLDER_ID,
    process.env.DIRECTUS_CLIENT_DOCUMENTS_FOLDER_ID,
    process.env.DIRECTUS_PROTECTED_IDENTITY_FOLDER_ID,
    process.env.DIRECTUS_PROTECTED_FREELANCER_IDENTITY_FOLDER_ID,
    process.env.DIRECTUS_FREELANCER_IDENTITY_FOLDER_ID,
    process.env.DIRECTUS_PROTECTED_FREELANCER_RESUMES_FOLDER_ID,
    process.env.DIRECTUS_PROTECTED_RESUME_FOLDER_ID,
    process.env.DIRECTUS_RESUME_FOLDER_ID,
    process.env.DIRECTUS_ASSESSMENT_PROOF_FOLDER_ID,
  ];
  return new Set(
    [...KNOWN_PROTECTED_FOLDER_IDS, ...configured]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => value.trim()),
  );
}

async function getJson<T>(
  baseUrl: string,
  token: string,
  path: string,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: headers(token),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, status: response.status, data: null };
    return { ok: true, status: response.status, data: (await response.json()) as T };
  } catch {
    return { ok: false, status: 502, data: null };
  }
}

async function fetchFileMetadata(
  baseUrl: string,
  token: string,
  fileId: string,
): Promise<{ file: DirectusFile | null; lookupFailed: boolean; notFound: boolean }> {
  const params = new URLSearchParams({
    "filter[id][_eq]": fileId,
    fields: "id,folder,folder.name",
    limit: "1",
  });
  const result = await getJson<DirectusCollectionResponse<DirectusFile>>(
    baseUrl,
    token,
    `/files?${params.toString()}`,
  );
  if (result.ok) {
    const file = result.data?.data?.[0] ?? null;
    return { file, lookupFailed: false, notFound: !file };
  }
  return { file: null, lookupFailed: result.status !== 404, notFound: result.status === 404 };
}

async function resolveFolderName(
  baseUrl: string,
  token: string,
  folder: DirectusFile["folder"],
): Promise<{ id: string | null; name: string | null; lookupFailed: boolean }> {
  if (!folder) return { id: null, name: null, lookupFailed: false };
  if (typeof folder === "object") {
    return {
      id: folder.id ?? null,
      name: folder.name?.trim().toLowerCase() ?? null,
      lookupFailed: false,
    };
  }
  const folderParams = new URLSearchParams({
    "filter[id][_eq]": String(folder),
    fields: "id,name",
    limit: "1",
  });
  const result = await getJson<DirectusCollectionResponse<{ id?: string; name?: string }>>(
    baseUrl,
    token,
    `/folders?${folderParams.toString()}`,
  );
  if (result.ok) {
    const item = result.data?.data?.[0];
    return {
      id: item?.id ?? folder,
      name: item?.name?.trim().toLowerCase() ?? null,
      lookupFailed: false,
    };
  }
  return { id: folder, name: null, lookupFailed: true };
}

async function findCompanyDocument(
  baseUrl: string,
  token: string,
  fileId: string,
): Promise<{ records: CompanyDocument[]; lookupFailed: boolean }> {
  const params = new URLSearchParams({
    "filter[directus_file_id][_eq]": fileId,
    fields: "company_id,directus_file_id",
    limit: "20",
  });
  const result = await getJson<DirectusCollectionResponse<CompanyDocument>>(
    baseUrl,
    token,
    `/items/vs_company_document?${params.toString()}`,
  );
  return { records: result.data?.data ?? [], lookupFailed: !result.ok };
}

async function findResumes(
  baseUrl: string,
  token: string,
  fileId: string,
): Promise<{ records: ResumeRecord[]; lookupFailed: boolean }> {
  const references = [fileId, `${baseUrl}/assets/${fileId}`];
  const records: ResumeRecord[] = [];
  let lookupFailed = false;
  for (const reference of references) {
    const params = new URLSearchParams({
      "filter[file_url][_eq]": reference,
      fields: "user_id,file_url",
      limit: "20",
    });
    const result = await getJson<DirectusCollectionResponse<ResumeRecord>>(
      baseUrl,
      token,
      `/items/vs_job_seeker_resumes?${params.toString()}`,
    );
    if (!result.ok) lookupFailed = true;
    for (const record of result.data?.data ?? []) {
      if (!records.some((existing) => sameId(existing.user_id, record.user_id))) records.push(record);
    }
  }
  return { records, lookupFailed };
}

async function findIdentityRecords(
  baseUrl: string,
  token: string,
  fileId: string,
): Promise<{ records: IdentityRecord[]; lookupFailed: boolean }> {
  const filters = [
    "gov_id_front_image_uuid",
    "gov_id_back_image_uuid",
    "gov_id_selfie_image_uuid",
    "address_doc_image_uuid",
  ];
  const records: IdentityRecord[] = [];
  let lookupFailed = false;
  for (const field of filters) {
    const params = new URLSearchParams({
      [`filter[${field}][_eq]`]: fileId,
      fields: "user_id",
      limit: "20",
    });
    const result = await getJson<DirectusCollectionResponse<IdentityRecord>>(
      baseUrl,
      token,
      `/items/vs_identity_verifications?${params.toString()}`,
    );
    if (!result.ok) lookupFailed = true;
    for (const record of result.data?.data ?? []) {
      if (!records.some((existing) => sameId(existing.user_id, record.user_id))) records.push(record);
    }
  }
  return { records, lookupFailed };
}

async function findAssessmentProofs(
  baseUrl: string,
  token: string,
  fileId: string,
): Promise<{ records: AssessmentProofRecord[]; lookupFailed: boolean }> {
  const params = new URLSearchParams({
    "filter[proof_file_id][_eq]": fileId,
    fields: "attempt_id",
    limit: "20",
  });
  const result = await getJson<DirectusCollectionResponse<AssessmentProofRecord>>(
    baseUrl,
    token,
    `/items/vs_application_assessment_responses?${params.toString()}`,
  );
  return { records: result.data?.data ?? [], lookupFailed: !result.ok };
}

async function findSchoolDocuments(
  baseUrl: string,
  token: string,
  fileId: string,
): Promise<{ records: SchoolDocumentRecord[]; lookupFailed: boolean }> {
  const params = new URLSearchParams({
    "filter[directus_file_id][_eq]": fileId,
    fields: "school_id,directus_file_id",
    limit: "20",
  });
  const result = await getJson<DirectusCollectionResponse<SchoolDocumentRecord>>(
    baseUrl,
    token,
    `/items/vs_school_document?${params.toString()}`,
  );
  return { records: result.data?.data ?? [], lookupFailed: !result.ok };
}

/**
 * Chat attachments carry no owner column, so the owning conversation is
 * reached through vs_message. The upload route writes `/api/assets/<id>`;
 * older rows hold the absolute Directus URL.
 */
async function findMessageAttachments(
  baseUrl: string,
  token: string,
  fileId: string,
): Promise<{ records: MessageAttachmentRecord[]; lookupFailed: boolean }> {
  const references = [`/api/assets/${fileId}`, `${baseUrl}/assets/${fileId}`];
  const records: MessageAttachmentRecord[] = [];
  let lookupFailed = false;
  for (const reference of references) {
    const params = new URLSearchParams({
      "filter[file_path][_eq]": reference,
      fields: "attachment_id,message_id,file_path",
      limit: "20",
    });
    const result = await getJson<DirectusCollectionResponse<MessageAttachmentRecord>>(
      baseUrl,
      token,
      `/items/vs_message_attachment?${params.toString()}`,
    );
    if (!result.ok) lookupFailed = true;
    for (const record of result.data?.data ?? []) {
      if (!records.some((existing) => sameId(existing.attachment_id, record.attachment_id))) {
        records.push(record);
      }
    }
  }
  return { records, lookupFailed };
}

async function resolveSchoolIdForUser(
  baseUrl: string,
  token: string,
  userId: string | number,
): Promise<string | number | null> {
  const params = new URLSearchParams({
    "filter[user_id][_eq]": String(userId),
    "filter[is_active][_eq]": "true",
    fields: "school_id",
    limit: "10",
  });
  const result = await getJson<DirectusCollectionResponse<{ school_id?: string | number }>>(
    baseUrl,
    token,
    `/items/vs_school_admin?${params.toString()}`,
  );
  for (const row of result.data?.data ?? []) {
    if (row.school_id !== null && row.school_id !== undefined) return row.school_id;
  }
  return null;
}

async function conversationOfMessage(
  baseUrl: string,
  token: string,
  messageId: string | number,
): Promise<ConversationRecord | null> {
  const messageParams = new URLSearchParams({
    "filter[message_id][_eq]": String(messageId),
    fields: "message_id,conversation_id",
    limit: "1",
  });
  const messages = await getJson<
    DirectusCollectionResponse<{ conversation_id?: string | number }>
  >(baseUrl, token, `/items/vs_message?${messageParams.toString()}`);
  const conversationId = messages.data?.data?.[0]?.conversation_id;
  if (conversationId === null || conversationId === undefined) return null;

  const conversation = await getJson<{ data?: ConversationRecord }>(
    baseUrl,
    token,
    `/items/vs_conversation/${encodeURIComponent(String(conversationId))}?fields=conversation_id,client_id,freelancer_id`,
  );
  return conversation.data?.data ?? null;
}

async function resolveClientCompany(
  baseUrl: string,
  token: string,
  userId: string | number,
): Promise<string | number | null> {
  const params = new URLSearchParams({
    "filter[user_id][_eq]": String(userId),
    fields: "company_id",
    limit: "10",
  });
  const result = await getJson<DirectusCollectionResponse<{ company_id?: string | number | { company_id?: string | number } }>>(
    baseUrl,
    token,
    `/items/vs_company_user?${params.toString()}`,
  );
  for (const link of result.data?.data ?? []) {
    const companyId = nestedId(link.company_id, "company_id");
    if (companyId !== null) return companyId;
  }
  return null;
}

async function clientMayViewResume(
  baseUrl: string,
  token: string,
  session: AuthenticatedSession,
  ownerUserId: string | number,
): Promise<boolean> {
  const companyId = await resolveClientCompany(baseUrl, token, session.userId);
  if (companyId === null) return false;

  const applicationParams = new URLSearchParams({
    "filter[user_id][_eq]": String(ownerUserId),
    fields: "job_id",
    limit: "500",
  });
  const applications = await getJson<DirectusCollectionResponse<{ job_id?: string | number }>>(
    baseUrl,
    token,
    `/items/vs_job_application?${applicationParams.toString()}`,
  );
  const jobIds = (applications.data?.data ?? [])
    .map((row) => row.job_id)
    .filter((id): id is string | number => id !== null && id !== undefined);
  if (jobIds.length > 0) {
    const jobParams = new URLSearchParams({
      "filter[job_id][_in]": jobIds.join(","),
      "filter[company_id][_eq]": String(companyId),
      fields: "job_id",
      limit: "1",
    });
    const jobs = await getJson<DirectusCollectionResponse<{ job_id?: string | number }>>(
      baseUrl,
      token,
      `/items/vs_job_posting?${jobParams.toString()}`,
    );
    if ((jobs.data?.data?.length ?? 0) > 0) return true;
  }

  // Talent-search clients may have access through an explicit saved-talent
  // relationship even before an application exists.
  const savedParams = new URLSearchParams({
    "filter[company_id][_eq]": String(companyId),
    "filter[applicant_user_id][_eq]": String(ownerUserId),
    fields: "saved_applicant_id",
    limit: "1",
  });
  const saved = await getJson<DirectusCollectionResponse<{ saved_applicant_id?: string | number }>>(
    baseUrl,
    token,
    `/items/vs_saved_applicant?${savedParams.toString()}`,
  );
  return (saved.data?.data?.length ?? 0) > 0;
}

async function clientMayViewAssessmentProof(
  baseUrl: string,
  token: string,
  session: AuthenticatedSession,
  attemptId: string | number,
): Promise<boolean> {
  const companyId = await resolveClientCompany(baseUrl, token, session.userId);
  if (companyId === null) return false;

  const attemptParams = new URLSearchParams({
    "filter[id][_eq]": String(attemptId),
    fields: "application_id",
    limit: "1",
  });
  const attempts = await getJson<DirectusCollectionResponse<{ application_id?: string | number }>>(
    baseUrl,
    token,
    `/items/vs_application_assessment_attempts?${attemptParams.toString()}`,
  );
  if (!attempts.ok) return false;
  const applicationId = attempts.data?.data?.[0]?.application_id ?? null;
  if (applicationId === null || applicationId === undefined) return false;

  const applicationParams = new URLSearchParams({
    "filter[application_id][_eq]": String(applicationId),
    fields: "job_id",
    limit: "1",
  });
  const applications = await getJson<DirectusCollectionResponse<{ job_id?: string | number }>>(
    baseUrl,
    token,
    `/items/vs_job_application?${applicationParams.toString()}`,
  );
  if (!applications.ok) return false;
  const jobId = applications.data?.data?.[0]?.job_id ?? null;
  if (jobId === null || jobId === undefined) return false;

  const jobParams = new URLSearchParams({
    "filter[job_id][_eq]": String(jobId),
    "filter[company_id][_eq]": String(companyId),
    fields: "job_id",
    limit: "1",
  });
  const jobs = await getJson<DirectusCollectionResponse<{ job_id?: string | number }>>(
    baseUrl,
    token,
    `/items/vs_job_posting?${jobParams.toString()}`,
  );
  if (!jobs.ok) return false;
  return (jobs.data?.data?.length ?? 0) > 0;
}

/**
 * Classify a file from Directus metadata and authorize access to protected
 * registration-derived documents. Unknown files in a protected folder fail
 * closed and are only available to administrators.
 */
export async function authorizeAssetAccess(
  fileId: string,
  session: AuthenticatedSession | null,
): Promise<AssetAuthorization> {
  const config = directusConfig();
  if (!config) return { allowed: false, protected: true, notFound: false, kind: "UNKNOWN" };

  const metadata = await fetchFileMetadata(config.baseUrl, config.token, fileId);
  if (metadata.notFound) return { allowed: false, protected: false, notFound: true, kind: "UNKNOWN" };

  const folder = await resolveFolderName(config.baseUrl, config.token, metadata.file?.folder);
  const [companyDocs, resumes, identities, proofs, schoolDocs, attachments] = await Promise.all([
    findCompanyDocument(config.baseUrl, config.token, fileId),
    findResumes(config.baseUrl, config.token, fileId),
    findIdentityRecords(config.baseUrl, config.token, fileId),
    findAssessmentProofs(config.baseUrl, config.token, fileId),
    findSchoolDocuments(config.baseUrl, config.token, fileId),
    findMessageAttachments(config.baseUrl, config.token, fileId),
  ]);

  const kind: ProtectedAssetKind = companyDocs.records.length
    ? "CLIENT_DOCUMENT"
    : identities.records.length
      ? "FREELANCER_IDENTITY"
      : resumes.records.length
        ? "FREELANCER_RESUME"
        : proofs.records.length
          ? "ASSESSMENT_PROOF"
          : schoolDocs.records.length
            ? "SCHOOL_DOCUMENT"
            : attachments.records.length
              ? "MESSAGE_ATTACHMENT"
              : "UNKNOWN";
  const protectedByFolder = Boolean(
    folder.id && protectedFolderIds().has(folder.id),
  ) || Boolean(folder.name && PROTECTED_FOLDER_NAMES.has(folder.name));
  // Folder protection is the deployment-level boundary. If an ownership
  // lookup fails, fail closed: availability loss is safer than exposing a
  // protected document through a service-token proxy.
  const associationLookupFailed =
    companyDocs.lookupFailed ||
    resumes.lookupFailed ||
    identities.lookupFailed ||
    proofs.lookupFailed ||
    schoolDocs.lookupFailed ||
    attachments.lookupFailed;
  const isProtected =
    metadata.lookupFailed ||
    folder.lookupFailed ||
    associationLookupFailed ||
    protectedByFolder ||
    kind !== "UNKNOWN";

  if (!isProtected) {
    // Public marketing/profile assets retain their existing unauthenticated
    // behavior; only protected folders/registration associations are gated.
    return { allowed: true, protected: false, notFound: false, kind };
  }
  if (!session) return { allowed: false, protected: true, notFound: false, kind };
  if (isAdministratorSession(session)) return { allowed: true, protected: true, notFound: false, kind };

  if (kind === "CLIENT_DOCUMENT" && isClientSession(session)) {
    const companyId = await resolveClientCompany(config.baseUrl, config.token, session.userId);
    const owned = companyDocs.records.some((record) =>
      sameId(nestedId(record.company_id, "company_id"), companyId),
    );
    return { allowed: owned, protected: true, notFound: false, kind };
  }

  if (
    kind === "FREELANCER_IDENTITY" &&
    (isFreelancerSession(session) || isClientSession(session))
  ) {
    const owned = identities.records.some((record) =>
      sameId(nestedId(record.user_id, "user_id"), session.userId),
    );
    return { allowed: owned, protected: true, notFound: false, kind };
  }

  if (kind === "FREELANCER_RESUME") {
    const ownerUserId = nestedId(resumes.records[0]?.user_id, "user_id");
    if (ownerUserId !== null && isFreelancerSession(session) && sameId(ownerUserId, session.userId)) {
      return { allowed: true, protected: true, notFound: false, kind };
    }
    if (ownerUserId !== null && isClientSession(session)) {
      const allowed = await clientMayViewResume(config.baseUrl, config.token, session, ownerUserId);
      return { allowed, protected: true, notFound: false, kind };
    }
  }

  if (kind === "ASSESSMENT_PROOF") {
    const attemptId = proofs.records[0]?.attempt_id ?? null;
    if (attemptId === null || attemptId === undefined) {
      return { allowed: false, protected: true, notFound: false, kind };
    }
    const attemptParams = new URLSearchParams({
      "filter[id][_eq]": String(attemptId),
      fields: "application_id",
      limit: "1",
    });
    const attempts = await getJson<DirectusCollectionResponse<{ application_id?: string | number }>>(
      config.baseUrl,
      config.token,
      `/items/vs_application_assessment_attempts?${attemptParams.toString()}`,
    );
    if (!attempts.ok) return { allowed: false, protected: true, notFound: false, kind };
    const applicationId = attempts.data?.data?.[0]?.application_id ?? null;
    if (applicationId === null || applicationId === undefined) {
      return { allowed: false, protected: true, notFound: false, kind };
    }
    const applicationLookupParams = new URLSearchParams({
      "filter[application_id][_eq]": String(applicationId),
      fields: "job_id,user_id",
      limit: "1",
    });
    const proofApplications = await getJson<
      DirectusCollectionResponse<{ job_id?: string | number; user_id?: string | number }>
    >(
      config.baseUrl,
      config.token,
      `/items/vs_job_application?${applicationLookupParams.toString()}`,
    );
    if (!proofApplications.ok) return { allowed: false, protected: true, notFound: false, kind };
    const ownerUserId = nestedId(proofApplications.data?.data?.[0]?.user_id, "user_id");
    if (ownerUserId !== null && isFreelancerSession(session) && sameId(ownerUserId, session.userId)) {
      return { allowed: true, protected: true, notFound: false, kind };
    }
    if (isClientSession(session)) {
      const allowed = await clientMayViewAssessmentProof(config.baseUrl, config.token, session, attemptId);
      return { allowed, protected: true, notFound: false, kind };
    }
    return { allowed: false, protected: true, notFound: false, kind };
  }

  if (kind === "SCHOOL_DOCUMENT") {
    if (!isSchoolAdminSession(session)) {
      return { allowed: false, protected: true, notFound: false, kind };
    }
    const schoolId = await resolveSchoolIdForUser(config.baseUrl, config.token, session.userId);
    const owned =
      schoolId !== null &&
      schoolDocs.records.some((record) => sameId(record.school_id, schoolId));
    return { allowed: owned, protected: true, notFound: false, kind };
  }

  if (kind === "MESSAGE_ATTACHMENT") {
    const messageId = attachments.records[0]?.message_id ?? null;
    if (messageId === null || messageId === undefined) {
      return { allowed: false, protected: true, notFound: false, kind };
    }
    const conversation = await conversationOfMessage(config.baseUrl, config.token, messageId);
    if (!conversation) return { allowed: false, protected: true, notFound: false, kind };
    const participant =
      sameId(conversation.client_id, session.userId) ||
      sameId(conversation.freelancer_id, session.userId);
    return { allowed: participant, protected: true, notFound: false, kind };
  }

  // A protected file without a matching owner/authorized reviewer is denied.
  return { allowed: false, protected: true, notFound: false, kind };
}
