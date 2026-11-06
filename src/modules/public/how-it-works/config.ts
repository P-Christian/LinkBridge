// src/modules/public/how-it-works/config.ts
import type { FaqItem, RoleGuide, RoleKey, StepAction } from "./types";

/* ---------- Shared constants (change once, updates everywhere) ---------- */

export const BRAND = "LinkBridge";

export const ROUTES = {
  signup: {
    employee: "/signup?role=employee",
    employer: "/signup?role=employer",
    school: "/school-register",
  } satisfies Record<RoleKey, string>,
  findJobs: "/find-jobs",
  contact: "/contact-us",
} as const;

export const SECTION_IDS = { overview: "quick-overview-section" } as const;
export const stepAnchor = (n: number) => `step-${n}`;
export const illustrationPath = (role: RoleKey, slug: string) =>
  `/illustrations/how-it-works/${role}/${slug}.svg`;

// TODO(content): confirm with the compliance team. Steps and FAQ both read this.
export const VERIFICATION_REVIEW_TIME = "3 - 4 business days";

export const ADMIN_ACCOUNT_LABEL = "a VOS Admin";
export const FALLBACK_ACCOUNT_LABEL = "another account type";

export const PAGE_COPY = {
  hero: {
    badge: `${BRAND} guide`,
    subtitle: "Pick your role to see the steps from sign-up to your first result.",
  },
  overviewTitle: "Choose your role",
  switcher: {
    title: "Not the right role?",
    subtitle: "Each account has one role, so pick the one that fits before you sign up.",
    action: "View guide",
  },
  faq: {
    badge: "FAQ",
    title: `Questions about getting started on ${BRAND}`,
    subtitle: "Answers on registration, verification time, and account roles.",
  },
  help: {
    title: "Need help getting set up?",
    subtitle: "Our support team can help with registration and verification.",
    action: "Contact support",
  },
  step: {
    why: "Why this step matters",
    checklist: "What you'll need",
  },
} as const;

/* ---------- Role guides ---------- */

const register = (role: RoleKey, label: string): StepAction => ({
  kind: "register",
  label,
  route: ROUTES.signup[role],
});

const employeeRegister = register("employee", "Create an employee account");
const employerRegister = register("employer", "Register your company");
const schoolRegister = register("school", "Register your school");

const contactSupport: StepAction = {
  kind: "link",
  label: PAGE_COPY.help.action,
  route: ROUTES.contact,
};

export const ROLE_GUIDES: Record<RoleKey, RoleGuide> = {
  employee: {
    roleKey: "employee",
    tabLabel: "Employee / Job seeker",
    shortLabel: "Employee",
    accountLabel: "an Employee",
    accountRoles: ["employee", "freelancer"],
    badgeText: "For job seekers and freelancers",
    heading: "Build your verified career profile",
    introduction:
      "Find verified jobs, show your credentials, and follow each application from submission to hire.",
    totalOnboardingTime: "About 20 minutes to set up",
    summary: "Create a profile, apply to verified jobs, and track every application.",
    register: employeeRegister,
    finalCta: {
      title: "Ready to start your search?",
      subtitle: "Join job seekers connecting with verified employers across the Philippines.",
      secondary: { kind: "link", label: "Browse open jobs", route: ROUTES.findJobs },
    },
    steps: [
      {
        title: "Create your account",
        statusChip: "Registration",
        estimatedTime: "2–3 minutes",
        description: "Enter your details and choose Employee as your account type.",
        outcome: "You get secure access to the candidate dashboard and profile builder.",
        requirements: [
          "An active email address or mobile number",
          "A password of at least 8 characters",
          "Acceptance of the Terms and Privacy Policy",
        ],
        action: employeeRegister,
        illustration: "register",
        illustrationAlt: `Employee creating a ${BRAND} account`,
      },
      {
        title: "Verify your account",
        statusChip: "Authentication",
        estimatedTime: "Under 1 minute",
        description: `Enter the one-time password ${BRAND} sends to your email or mobile number.`,
        outcome: "Your account is secured and profile setup unlocks.",
        requirements: [
          "The 6-digit code, entered before it expires",
          "Resend only if the code doesn't arrive",
        ],
        illustration: "verify",
        illustrationAlt: "Employee entering a one-time verification code",
      },
      {
        title: "Complete your profile",
        statusChip: "Profile setup",
        estimatedTime: "About 10 minutes",
        description: "Add your background, skills, and job preferences so employers can assess your fit.",
        outcome: "A complete profile that stands out to hiring managers.",
        requirements: [
          "Personal and contact details",
          "Education and work history",
          "Skills, job preferences, and preferred location",
        ],
        illustration: "profile",
        illustrationAlt: "Employee adding skills to a candidate profile",
      },
      {
        title: "Upload your résumé and documents",
        statusChip: "Documents",
        estimatedTime: "3–5 minutes",
        description: "Upload your résumé and the records needed to verify your profile and identity.",
        outcome: "Employers can review your credentials with confidence.",
        requirements: [
          "A résumé or CV (PDF or Docx)",
          "A government ID or professional certification",
          "Readable files within the accepted size limit",
        ],
        illustration: "upload",
        illustrationAlt: "Employee uploading a résumé and verification documents",
      },
      {
        title: "Browse available jobs",
        statusChip: "Job search",
        estimatedTime: "Ongoing",
        description: "Search verified openings and narrow results by location, work setup, and category.",
        outcome: "You find roles that match your skills, experience, and salary expectations.",
        requirements: [
          "Search by keyword or job title",
          "Filter by location, work setup (remote or on-site), or salary",
          "Open a job card to read the full details",
        ],
        action: { kind: "link", label: "Browse jobs", route: ROUTES.findJobs },
        illustration: "browse",
        illustrationAlt: "Employee filtering verified jobs by location",
      },
      {
        title: "Apply and track your applications",
        statusChip: "Application",
        estimatedTime: "1 minute per application",
        description: "Submit applications and follow each one through review, interview, and selection.",
        outcome: "You see status updates and interview schedules as they happen.",
        requirements: [
          "Check your details before submitting",
          "Answer screening questions when asked",
          "Watch your notifications for status changes",
        ],
        illustration: "apply",
        illustrationAlt: "Employee following an application status timeline",
      },
    ],
  },

  employer: {
    roleKey: "employer",
    tabLabel: "Employer / Company",
    shortLabel: "Employer",
    accountLabel: "an Employer",
    accountRoles: ["employer", "client"],
    badgeText: "For employers and companies",
    heading: "Hire verified professionals",
    introduction:
      "Verify your business, publish openings, screen applicants, and manage your hiring pipeline in one place.",
    totalOnboardingTime: `About 30 minutes, plus ${VERIFICATION_REVIEW_TIME} review`,
    summary: "Register your company, get verified, post jobs, and hire.",
    register: employerRegister,
    finalCta: {
      title: "Ready to hire verified talent?",
      subtitle: "Register your company and start posting jobs once you're verified.",
      secondary: contactSupport,
    },
    steps: [
      {
        title: "Create your account",
        statusChip: "Employer sign-up",
        estimatedTime: "3 minutes",
        description: "Register with the contact and login details of your authorized company representative.",
        outcome: "You get a company admin account and access to the employer dashboard.",
        requirements: [
          "A company-managed email address, if available",
          "The name of the authorized representative",
          "Acceptance of the Terms and Privacy Policy",
        ],
        action: employerRegister,
        illustration: "register",
        illustrationAlt: "Company representative creating an employer account",
      },
      {
        title: "Verify your company",
        statusChip: "Compliance review",
        estimatedTime: `5 minutes (${VERIFICATION_REVIEW_TIME} review)`,
        description: "Submit your legal registration and representative documents for admin review.",
        outcome: "You earn the Verified Employer badge and can start posting jobs.",
        requirements: [
          "Business registration (DTI, SEC, or BIR Form 2303)",
          "Company address and official contact details",
          "Representative ID and proof of authority",
        ],
        illustration: "verify",
        illustrationAlt: "Employer submitting business verification documents",
      },
      {
        title: "Complete your company profile",
        statusChip: "Company profile",
        estimatedTime: "5–10 minutes",
        description: "Build the public profile candidates read before they apply.",
        outcome: "Candidates see your brand, culture, and benefits up front.",
        requirements: [
          "Overview, industry, and company size",
          "Logo, cover image, address, and contact details",
          "Culture, perks, and website links",
        ],
        illustration: "profile",
        illustrationAlt: "Employer editing a company profile",
      },
      {
        title: "Create a job posting",
        statusChip: "Publishing",
        estimatedTime: "5 minutes per post",
        description: "Publish a vacancy with clear responsibilities, qualifications, salary, and terms.",
        outcome: "Your role is visible to active, qualified job seekers.",
        requirements: [
          "Job title, description, and required qualifications",
          "Location, work setup, and employment type",
          "Application deadline and optional screening questions",
        ],
        illustration: "post",
        illustrationAlt: "Employer writing and publishing a job posting",
      },
      {
        title: "Review and screen applicants",
        statusChip: "Screening",
        estimatedTime: "Ongoing",
        description: "Evaluate applications and move suitable candidates through your pipeline.",
        outcome: "You filter candidates using screening answers, résumés, and profile data.",
        requirements: [
          "Review profiles and attached résumés",
          "Read screening question answers",
          "Keep each applicant's status up to date",
        ],
        illustration: "screen",
        illustrationAlt: "Employer reviewing candidates in a pipeline",
      },
      {
        title: "Interview and select candidates",
        statusChip: "Selection",
        estimatedTime: "As needed",
        description: "Schedule interviews, record decisions, and finalize your selection.",
        outcome: "You hire verified professionals and close the vacancy.",
        requirements: [
          "Schedule interviews and share the details",
          "Record results and internal notes",
          "Update the final hiring status",
        ],
        illustration: "hire",
        illustrationAlt: "Employer interviewing a candidate and finalizing a hire",
      },
    ],
  },

  school: {
    roleKey: "school",
    tabLabel: "School / Institution",
    shortLabel: "School",
    accountLabel: "a School Admin",
    accountRoles: ["school", "school_admin"],
    badgeText: "For academic institutions",
    heading: "Manage courses and verify graduate records",
    introduction:
      "Register your institution, maintain your official course list, and confirm student education records.",
    totalOnboardingTime: `About 30 minutes, plus ${VERIFICATION_REVIEW_TIME} review`,
    summary: "Register your school, manage courses, and verify graduate records.",
    register: schoolRegister,
    finalCta: {
      title: "Ready to register your institution?",
      subtitle: `Give your graduates verified academic credentials on ${BRAND}.`,
      secondary: contactSupport,
    },
    steps: [
      {
        title: "Create your account",
        statusChip: "School sign-up",
        estimatedTime: "3 minutes",
        description: "Register through an authorized school administrator or registrar.",
        outcome: "You get an institutional portal with graduate verification tools.",
        requirements: [
          "An official institutional email address",
          "Contact details of the representative",
          "School selected as the account type",
        ],
        action: schoolRegister,
        illustration: "register",
        illustrationAlt: "School representative registering an institution",
      },
      {
        title: "Verify your school",
        statusChip: "Institution review",
        estimatedTime: `5 minutes (${VERIFICATION_REVIEW_TIME} review)`,
        description: "Submit accreditation and representative authorization documents for admin review.",
        outcome: "Your school gains official status to verify graduate records.",
        requirements: [
          "Official registration (CHED, DepEd, TESDA, or SEC)",
          "Campus address and official contact details",
          "Representative ID and proof of authority",
        ],
        illustration: "verify",
        illustrationAlt: "School submitting accreditation documents",
      },
      {
        title: "Complete your school profile",
        statusChip: "School profile",
        estimatedTime: "5 minutes",
        description: "Add your approved institutional details, campus information, and branding.",
        outcome: "Students and employers can recognize your institution.",
        requirements: [
          "School name, type, overview, and contact details",
          "Logo, cover image, campus address, and website",
        ],
        illustration: "profile",
        illustrationAlt: "School setting up its institutional profile",
      },
      {
        title: "Register your courses",
        statusChip: "Course catalog",
        estimatedTime: "10 minutes",
        description: "Add and maintain the courses, degrees, and vocational programs you offer.",
        outcome: "A standard course catalog that graduate claims can be matched against.",
        requirements: [
          "Standard course names and degree codes",
          "Correct course status and academic level",
          "No duplicate course records",
        ],
        illustration: "courses",
        illustrationAlt: "School managing its course catalog",
      },
      {
        title: "Manage students and graduates",
        statusChip: "Rosters",
        estimatedTime: "Ongoing",
        description: "Link candidate profiles to the right courses and graduation batches.",
        outcome: "Accurate graduate rosters and faster verification requests.",
        requirements: [
          "Review school and course claims",
          "Keep student and graduate links accurate",
          "Follow education privacy and access rules",
        ],
        illustration: "students",
        illustrationAlt: "School reviewing a graduate roster",
      },
      {
        title: "Verify student and graduate records",
        statusChip: "Verification",
        estimatedTime: "1–2 minutes per request",
        description: "Confirm whether a candidate's education claim matches your institutional records.",
        outcome: "Verified education badges appear on candidate profiles.",
        requirements: [
          "Check the candidate's identity, degree, and graduation year",
          "Approve claims your records support",
          "Flag mismatches for correction or admin review",
        ],
        illustration: "records",
        illustrationAlt: "School issuing a verified education badge",
      },
    ],
  },
};

/* ---------- FAQ ---------- */

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "free",
    question: `Is registration on ${BRAND} free?`,
    answer: "Yes. Creating an employee, employer, or school account is free, and so is submitting your verification documents.",
    category: "general",
  },
  {
    id: "review-time",
    question: "How long does verification take?",
    answer: `Company and school verification is usually reviewed within ${VERIFICATION_REVIEW_TIME} after you submit your documents.`,
    category: "general",
  },
  {
    id: "one-role",
    question: "Can I use more than one role or change roles later?",
    answer: "No. Each account has one role (Employee, Employer, or School) to protect privacy and security, and it can't be changed after registration. To use another role, create a separate account.",
    category: "general",
  },
  {
    id: "education-badge",
    question: "How do verified education badges work?",
    answer: "When a student claims a degree, the school gets a verification request. Once the school confirms the record, a verified badge appears on the student's profile.",
    category: "school",
  },
];