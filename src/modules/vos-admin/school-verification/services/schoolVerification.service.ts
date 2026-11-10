// src/modules/vos-admin/school-verification/services/schoolVerification.service.ts
import {
  SchoolVerificationRecord,
  SchoolDocument,
  SchoolAdminUser,
  SchoolCourse,
  VerificationDecisionPayload,
} from "../types";
import {
  fetchSchoolsRepo,
  fetchSchoolDocumentsRepo,
  fetchSchoolCoursesRepo,
  fetchSchoolAdminsRepo,
  patchSchoolRepo,
  patchUserRepo,
  patchIdentityVerificationsRepo,
  createAuditTrailRepo,
} from "./schoolVerification.repo";
import { resolveAssetUrl, getPHTimestampForDB } from "./schoolVerification.helpers";

// --- Server-Side Domain Orchestration ---
//
// Browser callers live in ./schoolVerification.api.ts. Importing this file from
// client code trips the @/lib/server guard.

export async function getSchoolVerifications(
  status?: string,
  search?: string
): Promise<SchoolVerificationRecord[]> {
  const schools = await fetchSchoolsRepo(status, search);
  if (schools.length === 0) return [];

  const schoolIds = schools.map((s) => Number(s.school_id)).filter(Boolean);
  const verifierIds = schools.map((s) => Number(s.verified_by_user_id)).filter(Boolean);

  const [rawDocs, adminData, rawCourses] = await Promise.all([
    fetchSchoolDocumentsRepo(schoolIds),
    fetchSchoolAdminsRepo(schoolIds, verifierIds),
    fetchSchoolCoursesRepo(schoolIds),
  ]);

  // Map documents by school_id
  const docMap: Record<number, SchoolDocument[]> = {};
  rawDocs.forEach((d) => {
    const sid = Number(d.school_id);
    if (!docMap[sid]) docMap[sid] = [];
    docMap[sid].push({
      school_document_id: Number(d.school_document_id || d.id),
      school_id: sid,
      document_type: String(d.document_type || "OTHER_DOCUMENT"),
      document_name: String(d.document_name || "Document"),
      directus_file_id: String(d.directus_file_id || ""),
      uploaded_by_user_id: d.uploaded_by_user_id ? Number(d.uploaded_by_user_id) : null,
      uploaded_at: String(d.uploaded_at || ""),
      file_url: resolveAssetUrl(d.directus_file_id),
    });
  });

  // Map users & identity verifications
  const userMap: Record<number, Record<string, unknown>> = {};
  adminData.users.forEach((u) => {
    userMap[Number(u.user_id)] = u;
  });

  const idVerMap: Record<number, Record<string, unknown>> = {};
  adminData.identityVerifications.forEach((v) => {
    const uid = Number(v.user_id);
    if (!idVerMap[uid]) {
      const frontUuid = (v.gov_id_front_image_uuid || v.gov_id_file_id) as string | null;
      const backUuid = v.gov_id_back_image_uuid as string | null;
      idVerMap[uid] = {
        id: v.id,
        gov_id_type: v.gov_id_type || "Government ID",
        gov_id_front_image_uuid: frontUuid,
        gov_id_back_image_uuid: backUuid,
        gov_id_front_url: resolveAssetUrl(frontUuid),
        gov_id_back_url: resolveAssetUrl(backUuid),
        status: v.status || "pending",
        submitted_at: v.submitted_at || null,
      };
    }
  });

  // Map school admins by school_id
  const adminMap: Record<number, SchoolAdminUser[]> = {};
  adminData.admins.forEach((a) => {
    const sid = Number(a.school_id);
    const rawUid = typeof a.user_id === "object" && a.user_id !== null ? (a.user_id as Record<string, unknown>).user_id : a.user_id;
    const uid = Number(rawUid);
    const uInfo = userMap[uid] || {};

    if (!adminMap[sid]) adminMap[sid] = [];
    adminMap[sid].push({
      school_admin_id: Number(a.school_admin_id || a.id),
      school_id: sid,
      user_id: uid,
      is_active: a.is_active === true || a.is_active === 1,
      user_fname: String(uInfo.user_fname || a.user_fname || "").trim(),
      user_lname: String(uInfo.user_lname || a.user_lname || "").trim(),
      user_email: String(uInfo.user_email || a.user_email || "").trim(),
      user_contact: String(uInfo.user_contact || a.user_contact || "").trim(),
      identity_verification: (idVerMap[uid] as SchoolAdminUser["identity_verification"]) || null,
    });
  });

  // Map courses by school_id
  const courseMap: Record<number, SchoolCourse[]> = {};
  rawCourses.forEach((c) => {
    const sid = Number(c.school_id);
    if (!courseMap[sid]) courseMap[sid] = [];
    courseMap[sid].push({
      school_course_id: Number(c.school_course_id || c.id),
      school_id: sid,
      course_name: String(c.course_name || ""),
      course_code: c.course_code ? String(c.course_code) : null,
      degree_level: c.degree_level ? String(c.degree_level) : null,
      department: c.department ? String(c.department) : null,
      description: c.description ? String(c.description) : null,
      course_status: String(c.course_status || "Active"),
      created_at: c.created_at ? String(c.created_at) : null,
      updated_at: c.updated_at ? String(c.updated_at) : null,
    });
  });

  // Assemble enriched school verification records
  return schools.map((s) => {
    const sid = Number(s.school_id);
    const logoRaw = s.school_logo_url ? String(s.school_logo_url) : null;
    const coverRaw = s.school_cover ? String(s.school_cover) : null;
    const verifierId = s.verified_by_user_id ? Number(s.verified_by_user_id) : null;
    const vUser = verifierId ? userMap[verifierId] : null;
    const vFname = vUser ? String(vUser.user_fname || "").trim() : "";
    const vLname = vUser ? String(vUser.user_lname || "").trim() : "";
    const vFullName = [vFname, vLname].filter(Boolean).join(" ");
    const verifierName = vFullName || (vUser ? String(vUser.user_email || "").trim() : null);

    return {
      school_id: sid,
      school_name: String(s.school_name || "Unnamed School"),
      school_type: String(s.school_type || "Other"),
      school_logo_url: resolveAssetUrl(logoRaw),
      school_cover: resolveAssetUrl(coverRaw),
      school_description: s.school_description ? String(s.school_description) : null,
      school_mission: s.school_mission ? String(s.school_mission) : null,
      school_values: s.school_values ? String(s.school_values) : null,
      school_email: s.school_email ? String(s.school_email) : null,
      school_contact_no: s.school_contact_no ? String(s.school_contact_no) : null,
      school_website: s.school_website ? String(s.school_website) : null,
      school_facebook: s.school_facebook ? String(s.school_facebook) : null,
      school_linkedin: s.school_linkedin ? String(s.school_linkedin) : null,
      address_line: s.address_line ? String(s.address_line) : null,
      barangay: s.barangay ? String(s.barangay) : null,
      city_municipality: String(s.city_municipality || ""),
      province: String(s.province || ""),
      postal_code: s.postal_code ? String(s.postal_code) : null,
      country: String(s.country || "Philippines"),
      school_status: String(s.school_status || "Pending"),
      verification_status: (s.verification_status as SchoolVerificationRecord["verification_status"]) || "PENDING_VERIFICATION",
      rejection_reason: s.rejection_reason ? String(s.rejection_reason) : null,
      internal_notes: s.internal_notes ? String(s.internal_notes) : null,
      profile_completion_percent: Number(s.profile_completion_percent || 0),
      is_public: s.is_public === true || s.is_public === 1,
      is_active: s.is_active === true || s.is_active === 1,
      submitted_at: s.submitted_at ? String(s.submitted_at) : s.created_at ? String(s.created_at) : null,
      verified_at: s.verified_at ? String(s.verified_at) : null,
      verified_by_user_id: verifierId,
      verified_by_user_name: verifierName,
      created_at: String(s.created_at || ""),
      updated_at: s.updated_at ? String(s.updated_at) : null,
      documents: docMap[sid] || [],
      admins: adminMap[sid] || [],
      courses: courseMap[sid] || [],
    };
  });
}

export async function processVerificationDecision(
  payload: VerificationDecisionPayload,
  adminId: number,
  clientIp?: string,
  userAgent?: string
): Promise<{ success: boolean; message: string; verification_status: string; warnings: string[] }> {
  const { schoolId, action, rejectionReason, internalNotes } = payload;
  const nowPH = getPHTimestampForDB();
  const warnings: string[] = [];

  let verificationStatus = "PENDING_VERIFICATION";
  let schoolStatus = "Pending";
  let isPublic = 0;

  if (action === "approve") {
    verificationStatus = "VERIFIED";
    schoolStatus = "Active";
    isPublic = 1;
  } else if (action === "reject") {
    verificationStatus = "REJECTED";
    schoolStatus = "Inactive";
  } else if (action === "suspend") {
    verificationStatus = "SUSPENDED";
    schoolStatus = "Inactive";
  } else if (action === "request_correction") {
    verificationStatus = "PENDING_VERIFICATION";
    schoolStatus = "Pending";
  }

  const patchData: Record<string, unknown> = {
    verification_status: verificationStatus,
    school_status: schoolStatus,
    updated_by: adminId,
    updated_at: nowPH,
  };

  if (action === "approve") {
    patchData.is_public = isPublic;
    patchData.verified_at = nowPH;
    patchData.verified_by_user_id = adminId;
  }

  // 1. Update vs_school
  await patchSchoolRepo(schoolId, patchData);

  // 2. Cascade user & identity updates to linked school administrators
  try {
    const adminData = await fetchSchoolAdminsRepo([schoolId]);
    const uids = adminData.admins
      .map((a) => {
        const raw = typeof a.user_id === "object" && a.user_id !== null ? (a.user_id as Record<string, unknown>).user_id : a.user_id;
        return Number(raw);
      })
      .filter((id) => id > 0);

    if (uids.length > 0) {
      // `vs_user` has one lifecycle column, `status`, and `canAuthenticate()`
      // reads it verbatim: anything outside ACTIVE/VERIFIED/PENDING_VERIFICATION/
      // LIMITED is denied. The names below are the values that module already
      // writes, so a suspended school cannot keep signing in.
      const userStatus =
        action === "approve"
          ? "VERIFIED"
          : action === "reject"
            ? "INACTIVE"
            : action === "suspend"
              ? "SUSPENDED"
              : "PENDING_VERIFICATION";
      const idVerStatus =
        action === "approve"
          ? "approved"
          : action === "reject"
            ? "rejected"
            : action === "suspend"
              ? "suspended"
              : "pending";

      const idVerPayload: Record<string, unknown> = {
        status: idVerStatus,
        reviewed_at: nowPH,
        reviewed_by: adminId,
      };
      // Only overwrite the note when this decision carries one. A suspend never
      // does, and writing null there erased the note that explained the
      // rejection the school was suspended over.
      if (rejectionReason) idVerPayload.rejection_note = rejectionReason;

      const failed: number[] = [];
      await Promise.all(
        uids.map(async (uid) => {
          try {
            await patchUserRepo(uid, {
              status: userStatus,
              // Same convention as the account-status module: an account moved
              // out of good standing has its live tokens invalidated.
              ...(userStatus === "INACTIVE" || userStatus === "SUSPENDED"
                ? { session_epoch: nowPH }
                : {}),
              update_at: nowPH,
            });
            await patchIdentityVerificationsRepo(uid, idVerPayload);
          } catch {
            failed.push(uid);
          }
        })
      );
      if (failed.length > 0) {
        warnings.push(
          `The school status changed, but ${failed.length} school administrator account${failed.length > 1 ? "s" : ""} (ID ${failed.join(", ")}) could not be updated to ${userStatus}.`
        );
      }
    }
  } catch (cascadeErr) {
    console.warn("Failed cascading school verification status to admins:", cascadeErr);
    warnings.push(
      "The school status changed, but its administrators could not be looked up, so none of their accounts were updated."
    );
  }

  // 3. Log audit trail
  try {
    await createAuditTrailRepo({
      event_category: "VERIFICATION",
      event_type: `SCHOOL_VERIFICATION_${action.toUpperCase()}`,
      action: action.toUpperCase(),
      status: "SUCCESS",
      actor_type: "ADMIN",
      actor_user_id: adminId,
      resource_type: "SCHOOL",
      resource_id: String(schoolId),
      ip_address: clientIp || "127.0.0.1",
      user_agent: userAgent || null,
      correlation_id: `school-verif-${schoolId}-${Date.now()}`,
      reason: rejectionReason || `School verification status updated to ${verificationStatus}`,
      // `vs_school` has no note columns, so the reviewer's note only survives
      // here — otherwise the decision's rationale is written and then dropped.
      new_values: {
        verification_status: verificationStatus,
        school_status: schoolStatus,
        internal_notes: internalNotes || null,
      },
      created_at: nowPH,
    });
  } catch (auditErr) {
    console.warn("Could not write to vs_audit_trail:", auditErr);
    warnings.push("This decision was not recorded in the audit trail.");
  }

  return {
    success: true,
    message: `School ID ${schoolId} status updated to ${verificationStatus}`,
    verification_status: verificationStatus,
    warnings,
  };
}

