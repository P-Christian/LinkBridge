import { createFreelancerNotification } from "./freelancer-notifications";

export type EducationRejectionSource = "school_admin" | "vos_admin";

interface RejectionBase {
  readonly requestId: number;
  readonly educationId: number | null;
  readonly recipientUserId: number;
  readonly reason: string;
  readonly rejectedBy: EducationRejectionSource;
}

export type EducationRejectionNotice =
  | (RejectionBase & { readonly kind: "attendance"; readonly schoolName: string })
  | (RejectionBase & { readonly kind: "school_request"; readonly schoolName: string })
  | (RejectionBase & { readonly kind: "course"; readonly courseName: string });

const CATEGORY = "EDUCATION_VERIFICATION";
const ACTION_URL = "/linkbridge/freelancer/profile";

interface RenderedNotice {
  readonly eventType: string;
  readonly entityType: string;
  readonly title: string;
  readonly message: string;
}

function contactGuidance(rejectedBy: EducationRejectionSource): string {
  return rejectedBy === "school_admin"
    ? "If you believe this is a mistake, contact the school admin."
    : "If you believe this is a mistake, contact VOS support.";
}

function assertNeverKind(value: never): never {
  throw new Error(`Unhandled education rejection kind: ${JSON.stringify(value)}`);
}

function renderNotice(input: EducationRejectionNotice): RenderedNotice {
  const guidance = contactGuidance(input.rejectedBy);
  switch (input.kind) {
    case "attendance":
      return {
        eventType: "school_request_rejected",
        entityType: "vs_school_request",
        title: "Attendance verification rejected",
        message: `${input.schoolName} rejected your attendance verification: ${input.reason}. ${guidance}`,
      };
    case "school_request":
      return {
        eventType: "school_request_rejected",
        entityType: "vs_school_request",
        title: "School request rejected",
        message: `Your school request for ${input.schoolName} was rejected: ${input.reason}. ${guidance}`,
      };
    case "course":
      return {
        eventType: "course_request_rejected",
        entityType: "vs_course_request",
        title: "Course verification rejected",
        message: `${input.courseName} was not verified: ${input.reason}. ${guidance}`,
      };
    default:
      return assertNeverKind(input);
  }
}

export async function notifyEducationRejection(
  input: EducationRejectionNotice,
): Promise<void> {
  const notice = renderNotice(input);
  await createFreelancerNotification({
    event_type: notice.eventType,
    recipient_user_id: input.recipientUserId,
    entity_type: notice.entityType,
    entity_id: input.requestId,
    payload: {
      education_id: input.educationId,
      reason: input.reason,
      rejected_by: input.rejectedBy,
      ...(input.kind === "course"
        ? { requested_course_name: input.courseName }
        : { requested_school_name: input.schoolName }),
    },
    category: CATEGORY,
    title: notice.title,
    message: notice.message,
    action_url: ACTION_URL,
  });
}
