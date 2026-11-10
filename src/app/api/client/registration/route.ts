import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth-bypass";
import { legacyRegistrationRetiredResponse } from "@/modules/auth/registration";
import bcrypt from "bcrypt";
import { sendOtpEmail, sendEmployerSubmissionEmail } from "@/lib/mail";
import { getPHTimeString } from "@/lib/utils";
import { validatePasswordStrict } from "@/lib/password-validation";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DirectusResponse {
  data?: {
    user_id?: number;
    company_id?: number;
    [key: string]: unknown;
  };
  errors?: Array<{
    message: string;
    [key: string]: unknown;
  }>;
}

// ─────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

function validateContact(contact: string): boolean {
  // PH mobile: 09XXXXXXXXX or +639XXXXXXXXX
  return /^(09|\+639)\d{9}$/.test(contact.trim());
}

function validatePassword(password: string): boolean {
  return validatePasswordStrict(password);
}

function required(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

// ─────────────────────────────────────────────
// GET HANDLER (DIRECTUS PROXY FOR MASTER DATA)
// ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const retired = legacyRegistrationRetiredResponse();
  if (retired) return retired;
  try {
    const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
    const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    const { searchParams } = new URL(req.url);
    const directusCollection = searchParams.get("directusCollection");

    if (!directusCollection) {
      return NextResponse.json({ error: "Missing directusCollection parameter" }, { status: 400 });
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json(
        { error: "DIRECTUS base URL not configured" },
        { status: 500 }
      );
    }

    const proxyParams = new URLSearchParams(searchParams.toString());
    proxyParams.delete("directusCollection");

    const target = `${DIRECTUS_BASE}/items/${encodeURIComponent(
      directusCollection
    )}${proxyParams.toString() ? `?${proxyParams.toString()}` : ""}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (DIRECTUS_TOKEN) headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;

    const res = await fetch(target, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (error: unknown) {
    const msg = safeErrorMessage(error, "Internal server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST HANDLER
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const retired = legacyRegistrationRetiredResponse();
  if (retired) return retired;
  let payload: {
    account?: {
      user_email?: string;
      [key: string]: unknown;
    };
    company?: Record<string, unknown>;
    address?: Record<string, unknown>;
    terms_accepted?: boolean;
    privacy_accepted?: boolean;
    [key: string]: unknown;
  } | null = null;

  try {
    payload = await req.json().catch(() => null);

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid registration payload." },
        { status: 400 }
      );
    }

    const { account, company, address } = payload as {
      account: Record<string, unknown>;
      company: Record<string, unknown>;
      address: Record<string, unknown>;
    };

    // ─────────────────────────────────────────
    // 1. ACCOUNT FIELD VALIDATIONS
    // ─────────────────────────────────────────
    const validationErrors: string[] = [];

    if (!required(account?.user_fname))
      validationErrors.push("First name is required.");

    if (!required(account?.user_lname))
      validationErrors.push("Last name is required.");

    const email = String(account?.user_email ?? "").trim().toLowerCase();
    if (!email) {
      validationErrors.push("Email address is required.");
    } else if (!validateEmail(email)) {
      validationErrors.push("Email address format is invalid.");
    }

    const contact = String(account?.user_contact ?? "").trim();
    if (!contact) {
      validationErrors.push("Contact number is required.");
    } else if (!validateContact(contact)) {
      validationErrors.push(
        "Contact number must be a valid PH mobile format (09XXXXXXXXX or +639XXXXXXXXX)."
      );
    }

    const password = String(account?.password ?? "");
    if (!password) {
      validationErrors.push("Password is required.");
    } else if (!validatePassword(password)) {
      validationErrors.push("Password does not meet security requirements (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character).");
    }

    const confirmPassword = String(account?.confirmPassword ?? "");
    if (password && confirmPassword !== password) {
      validationErrors.push("Password and confirm password do not match.");
    }

    // ─────────────────────────────────────────
    // 2. TERMS & PRIVACY VALIDATION
    // ─────────────────────────────────────────
    if (!payload.terms_accepted) {
      validationErrors.push(
        "You must accept the Terms and Conditions to register."
      );
    }
    if (!payload.privacy_accepted) {
      validationErrors.push(
        "You must accept the Privacy Policy to register."
      );
    }

    // ─────────────────────────────────────────
    // CAPTCHA / TURNSTILE VERIFICATION
    // ─────────────────────────────────────────
    const turnstileToken = typeof payload.turnstileToken === "string" ? payload.turnstileToken : (typeof payload["cf-turnstile-response"] === "string" ? payload["cf-turnstile-response"] : undefined);
    const turnstileResult = await verifyTurnstileToken(
      turnstileToken,
      req.headers.get("x-forwarded-for") || undefined
    );
    if (!turnstileResult.success) {
      validationErrors.push(
        turnstileResult.message || "Security CAPTCHA verification failed."
      );
    }

    // ─────────────────────────────────────────
    // 3. COMPANY FIELD VALIDATIONS
    // ─────────────────────────────────────────
    if (!required(company?.company_name))
      validationErrors.push("Company name is required.");

    if (!required(company?.industry))
      validationErrors.push("Industry is required.");

    if (!required(address?.company_province))
      validationErrors.push("Province is required.");

    if (!required(address?.company_city))
      validationErrors.push("City is required.");

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors.join(" ") },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────
    // 4. DIRECTUS SETUP
    // ─────────────────────────────────────────
    const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
      /\/$/,
      ""
    );
    const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!DIRECTUS_BASE) {
      return NextResponse.json(
        { error: "Directus API base URL is not configured." },
        { status: 500 }
      );
    }

    const getHeaders = () => {
      const h: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (DIRECTUS_TOKEN) {
        h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
      }
      return h;
    };

    // PH Time helper (UTC+8)
    const phNow = () => getPHTimeString();

    // ─────────────────────────────────────────
    // 5. DUPLICATE EMAIL CHECK
    // ─────────────────────────────────────────
    const checkUserUrl = `${DIRECTUS_BASE}/items/vs_user?filter[user_email][_eq]=${encodeURIComponent(email)}&fields=*`;
    const checkRes = await fetch(checkUserUrl, {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!checkRes.ok) {
      return NextResponse.json(
        { error: "Failed to check existing user status." },
        { status: checkRes.status }
      );
    }

    const checkJson = await checkRes.json();
    const existingUsers = checkJson.data;
    const userExists =
      Array.isArray(existingUsers) && existingUsers.length > 0;

    if (userExists) {
      const existingUser = existingUsers[0];

      // Block if account was REJECTED or SUSPENDED
      if (
        existingUser.status === "REJECTED" ||
        existingUser.verification_status === "REJECTED" ||
        existingUser.is_blocked == 1 ||
        existingUser.is_blocked === true
      ) {
        return NextResponse.json(
          {
            error:
              "Registration Restricted: This work email address has been flagged/restricted due to a previous rejection. Please contact support.",
          },
          { status: 403 }
        );
      }

      // Already verified → block
      if (existingUser.otp_verified == 1 || existingUser.otp_verified === true) {
        return NextResponse.json(
          {
            error:
              "Email address is already registered. Please sign in or reset your password.",
          },
          { status: 409 }
        );
      }

      // Unverified → regenerate OTP (resend flow)
      const generatedOtp = randomInt(100000, 1000000).toString();
      const otpExpiry = new Date(
        Date.now() + 8 * 60 * 60 * 1000 + 15 * 60 * 1000
      )
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      const otpHashDisabled = process.env.OTP_HASH_DISABLED === "true";
      const saltRounds = 10;
      const storedOtp = otpHashDisabled
        ? generatedOtp
        : await bcrypt.hash(generatedOtp, saltRounds);

      const updateRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_user/${existingUser.user_id}`,
        {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({
            otp_code: storedOtp,
            otp_expiry: otpExpiry,
            otp_sent_at: phNow(),
          }),
        }
      );

      if (!updateRes.ok) {
        return NextResponse.json(
          { error: "Failed to resend verification code." },
          { status: updateRes.status }
        );
      }

      // Direct OTP email dispatch via nodemailer
      try {
        await sendOtpEmail(email, generatedOtp);
      } catch (e) {
        console.error("Nodemailer OTP dispatch failed (resend):", e);
      }

      return NextResponse.json({
        success: true,
        message: "Verification code resent successfully.",
        otp_sent: true,
        email,
        otp_code:
          isDevAuthBypassEnabled()
            ? generatedOtp
            : undefined,
      });
    }

    // ─────────────────────────────────────────
    // 5b. DUPLICATE COMPANY EMAIL CHECK
    // ─────────────────────────────────────────
    const compEmail = String(company?.company_email ?? "").trim().toLowerCase();
    if (compEmail) {
      const checkCompUrl = `${DIRECTUS_BASE}/items/vs_company?filter[company_email][_eq]=${encodeURIComponent(compEmail)}&fields=company_id&limit=1`;
      const compCheckRes = await fetch(checkCompUrl, {
        method: "GET",
        headers: getHeaders(),
        cache: "no-store",
      });
      if (compCheckRes.ok) {
        const compCheckJson = await compCheckRes.json();
        if (compCheckJson.data && compCheckJson.data.length > 0) {
          return NextResponse.json(
            { error: "Company email address is already registered to another company." },
            { status: 409 }
          );
        }
      }
    }
    // 5c. REJECTED TAX ID (TIN) BLACKLIST CHECK
    // ─────────────────────────────────────────
    const compTin = String(company?.company_tin ?? "").trim();
    if (compTin) {
      const checkTinUrl = `${DIRECTUS_BASE}/items/vs_company?filter[company_tin][_eq]=${encodeURIComponent(compTin)}&fields=company_id,verification_status&limit=1`;
      const tinCheckRes = await fetch(checkTinUrl, {
        method: "GET",
        headers: getHeaders(),
        cache: "no-store",
      });
      if (tinCheckRes.ok) {
        const tinCheckJson = await tinCheckRes.json();
        const existingComps = tinCheckJson.data || [];
        if (existingComps.length > 0) {
          const compStatus = existingComps[0].verification_status;
          if (compStatus === "REJECTED" || compStatus === "SUSPENDED") {
            return NextResponse.json(
              {
                error:
                  "Registration Restricted: The Tax Identification Number (TIN) submitted has been restricted due to a previous rejection. Please contact support.",
              },
              { status: 403 }
            );
          }
          return NextResponse.json(
            { error: "A company with this Tax Identification Number (TIN) is already registered." },
            { status: 409 }
          );
        }
      }
    }
    // 6. GENERATE OTP + HASH PASSWORD
    // ─────────────────────────────────────────
    const generatedOtp = randomInt(100000, 1000000).toString();
    const otpExpiry = new Date(
      Date.now() + 8 * 60 * 60 * 1000 + 15 * 60 * 1000
    )
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const nowPH = phNow();

    const otpHashDisabled = process.env.OTP_HASH_DISABLED === "true";
    const saltRounds = 10;
    const hashedPw = await bcrypt.hash(password, saltRounds);
    const hashedOtp = otpHashDisabled
      ? generatedOtp
      : await bcrypt.hash(generatedOtp, saltRounds);

    // ─────────────────────────────────────────
    // 7. CREATE VS_USER (Transaction Step 1)
    // ─────────────────────────────────────────
    const userPayload = {
      user_email: email,
      user_fname: String(account.user_fname ?? "").trim(),
      user_mname: String(account.user_mname ?? "").trim() || null,
      user_lname: String(account.user_lname ?? "").trim(),
      suffix_name: String(account.suffix_name ?? "").trim() || null,
      user_contact: contact,
      // user_position maps the job title / role from signup form
      user_position: String(account.user_job_title ?? account.job_title ?? "").trim() || null,
      role_id: 2,
      role: "CLIENT",
      hash_password: hashedPw,
      user_password: hashedPw, // legacy compat
      otp_code: hashedOtp,
      otp_expiry: otpExpiry,
      otp_verified: 0,
      otp_sent_at: nowPH,
      terms_accepted_at: nowPH,
      privacy_accepted_at: nowPH,
      registration_source: "WEB_SIGNUP",
      status: "PENDING_VERIFICATION",
    };

    const userRes = await fetch(`${DIRECTUS_BASE}/items/vs_user`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(userPayload),
    });

    const userText = await userRes.text();
    let userData: DirectusResponse | null = null;
    try {
      userData = userText ? JSON.parse(userText) : null;
    } catch {
      userData = null;
    }

    if (!userRes.ok) {
      const err =
        userData?.errors?.[0]?.message ||
        userText ||
        "Failed to create user record.";
      return NextResponse.json({ error: err }, { status: userRes.status });
    }

    const userId = userData?.data?.user_id;
    if (!userId) {
      return NextResponse.json(
        { error: "Failed to retrieve user ID after creation." },
        { status: 500 }
      );
    }

    // ─────────────────────────────────────────
    // 8. CREATE VS_COMPANY (Transaction Step 2)
    // ─────────────────────────────────────────
    let industryId: number | null = null;
    let companySizeId: number | null = null;

    // Resolve industry_id
    const rawIndustryVal = company.industry_id ?? company.industry;
    if (rawIndustryVal) {
      if (!isNaN(Number(rawIndustryVal)) && Number(rawIndustryVal) > 0) {
        industryId = Number(rawIndustryVal);
      } else {
        try {
          const indRes = await fetch(
            `${DIRECTUS_BASE}/items/vs_industry?limit=-1`,
            { headers: getHeaders(), cache: "no-store" }
          );
          if (indRes.ok) {
            const indJson = await indRes.json();
            const list: { industry_id: number; industry_name: string }[] = indJson?.data ?? [];
            const target = String(rawIndustryVal).trim().toLowerCase();
            const normalize = (s: string) => s.replace(/[\s\-_–—,]+/g, "").toLowerCase();

            let match = list.find((i) => String(i.industry_name).trim().toLowerCase() === target);
            if (!match) {
              match = list.find((i) => normalize(String(i.industry_name)) === normalize(target));
            }
            if (!match) {
              match = list.find((i) => String(i.industry_name).toLowerCase().includes(target) || target.includes(String(i.industry_name).toLowerCase()));
            }
            if (match) {
              industryId = Number(match.industry_id);
            }
          }
        } catch (e) {
          console.error("Failed to lookup vs_industry:", e);
        }
      }
    }

    // Resolve company_size_id
    const rawSizeVal = company.company_size_id ?? company.company_size;
    if (rawSizeVal) {
      if (!isNaN(Number(rawSizeVal)) && Number(rawSizeVal) > 0) {
        companySizeId = Number(rawSizeVal);
      } else {
        try {
          const sizeRes = await fetch(
            `${DIRECTUS_BASE}/items/vs_company_size?limit=-1`,
            { headers: getHeaders(), cache: "no-store" }
          );
          if (sizeRes.ok) {
            const sizeJson = await sizeRes.json();
            const list: { company_size_id: number; company_size_name: string }[] = sizeJson?.data ?? [];
            const target = String(rawSizeVal).trim().toLowerCase();
            const normalize = (s: string) => s.replace(/[\s\-_–—employees]+/gi, "").toLowerCase();

            let match = list.find((s) => String(s.company_size_name).trim().toLowerCase() === target);
            if (!match) {
              match = list.find((s) => normalize(String(s.company_size_name)) === normalize(target));
            }
            if (!match) {
              match = list.find((s) => {
                const normName = normalize(String(s.company_size_name));
                const normTarget = normalize(target);
                return normName.includes(normTarget) || normTarget.includes(normName);
              });
            }
            if (match) {
              companySizeId = Number(match.company_size_id);
            }
          }
        } catch (e) {
          console.error("Failed to lookup vs_company_size:", e);
        }
      }
    }

    const slugify = (text: string) =>
      text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "")
        .replace(/--+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");

    const companyCode = `${slugify(
      String(company.company_name ?? "")
    ).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const getCountryAlpha2 = (countryInput?: string | null): string => {
      if (!countryInput) return "PH";
      const trimmed = countryInput.trim().toUpperCase();
      if (trimmed.length === 2) return trimmed;
      const map: Record<string, string> = {
        PHILIPPINES: "PH",
        "UNITED STATES": "US",
        "UNITED STATES OF AMERICA": "US",
        USA: "US",
        JAPAN: "JP",
        AUSTRALIA: "AU",
        CANADA: "CA",
        "UNITED KINGDOM": "GB",
        UK: "GB",
        SINGAPORE: "SG",
        GERMANY: "DE",
        FRANCE: "FR",
        CHINA: "CN",
        INDIA: "IN",
        "SOUTH KOREA": "KR",
        KOREA: "KR",
      };
      return map[trimmed] || map[trimmed.replace(/[\s_-]+/g, " ")] || "PH";
    };

    const companyPayload = {
      company_code: companyCode,
      company_name: String(company.company_name ?? "").trim(),
      company_legal_name: String(company.company_name ?? "").trim(),
      company_email: String(company.company_email ?? "").trim() || email,
      company_contact:
        String(company.company_contact ?? "").trim() || contact,
      company_website: String(company.company_website ?? "").trim() || null,
      company_description:
        String(company.company_description ?? "").trim() || null,
      industry_id: industryId,
      company_size_id: companySizeId,
      company_country: getCountryAlpha2(
        typeof address.company_country === "string" ? address.company_country : String(address.company_country ?? "")
      ),
      company_province: String(address.company_province ?? "").trim() || null,
      company_city: String(address.company_city ?? "").trim() || null,
      company_brgy: String(address.company_brgy ?? "").trim() || null,
      company_address: String(address.company_address ?? "").trim() || null,
      company_zipCode: String(address.company_zipCode ?? "").trim() || null,
      company_tin: String(payload.tin ?? "").trim() || null,
      verification_status: "DRAFT",
      is_active: 1,
      is_public: 0,
      created_by_user_id: userId,
    };

    const companyRes = await fetch(`${DIRECTUS_BASE}/items/vs_company`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(companyPayload),
    });

    const companyText = await companyRes.text();
    let companyData: DirectusResponse | null = null;
    try {
      companyData = companyText ? JSON.parse(companyText) : null;
    } catch {
      companyData = null;
    }

    if (!companyRes.ok) {
      // ROLLBACK: delete user
      await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      const err =
        companyData?.errors?.[0]?.message ||
        companyText ||
        "Failed to create company record. Registration rolled back.";
      return NextResponse.json({ error: err }, { status: companyRes.status });
    }

    const companyId = companyData?.data?.company_id;
    if (!companyId) {
      // ROLLBACK: delete user
      await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      return NextResponse.json(
        { error: "Failed to retrieve company ID. Registration rolled back." },
        { status: 500 }
      );
    }

    // ─────────────────────────────────────────
    // 9. CREATE VS_COMPANY_USER (Transaction Step 3)
    // ─────────────────────────────────────────
    const linkPayload = {
      company_id: companyId,
      user_id: userId,
      company_user_role: "OWNER",
      is_primary_contact: 1,
      status: "ACTIVE",
    };

    const linkRes = await fetch(`${DIRECTUS_BASE}/items/vs_company_user`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(linkPayload),
    });

    const linkText = await linkRes.text();
    let linkData: DirectusResponse | null = null;
    try {
      linkData = linkText ? JSON.parse(linkText) : null;
    } catch {
      linkData = null;
    }

    if (!linkRes.ok) {
      // ROLLBACK: delete company + user
      await fetch(`${DIRECTUS_BASE}/items/vs_company/${companyId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      const err =
        linkData?.errors?.[0]?.message ||
        linkText ||
        "Failed to link user and company. Registration rolled back.";
      return NextResponse.json({ error: err }, { status: linkRes.status });
    }

    // ─────────────────────────────────────────
    // 10. CREATE vs_notification_preference (marketing consent)
    // ─────────────────────────────────────────
    if (userId) {
      try {
        await fetch(`${DIRECTUS_BASE}/items/vs_notification_preference`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            user_id: userId,
            category: "MARKETING_UPDATES",
            email_enabled: payload.marketing_consent === true ? 1 : 0,
            in_app_enabled: payload.marketing_consent === true ? 1 : 0,
          }),
        });
      } catch (e) {
        console.error("Failed to save marketing notification preference:", e);
      }
    }

    // ─────────────────────────────────────────
    // 11. CREATE vs_identity_verifications (if gov ID provided)
    // ─────────────────────────────────────────
    const govIdFrontFileId = (payload.gov_id_front_file_id || payload.gov_id_file_id) as string | undefined;
    const govIdBackFileId = payload.gov_id_back_file_id as string | undefined;
    const govIdType = payload.gov_id_type as string | undefined;

    if ((govIdFrontFileId || govIdBackFileId) && userId) {
      try {
        const idVerPayload = {
          user_id: userId,
          type: "GOVERNMENT_ID",
          status: "pending",
          gov_id_type: govIdType || null,
          gov_id_front_image_uuid: govIdFrontFileId || null,
          gov_id_back_image_uuid: govIdBackFileId || null,
          mobile_number: contact || null,
          submitted_at: nowPH,
        };
        await fetch(`${DIRECTUS_BASE}/items/vs_identity_verifications`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(idVerPayload),
        });

        // Send Document Verification Submission Email upon document submission
        try {
          await sendEmployerSubmissionEmail({
            email,
            companyName: String(company?.company_name || "Company"),
            recipientName: String(account?.user_fname || ""),
          });
        } catch (mailErr) {
          console.error("Failed to send employer document verification receipt email:", mailErr);
        }
      } catch (e) {
        // Non-critical — don't fail registration over this
        console.error("Failed to create vs_identity_verifications record:", e);
      }
    }

    // ─────────────────────────────────────────
    // 11. SEND OTP EMAIL via Nodemailer
    // ─────────────────────────────────────────
    try {
      await sendOtpEmail(email, generatedOtp);
    } catch (e) {
      console.error("Nodemailer OTP dispatch failed (new user):", e);
    }

    return NextResponse.json({
      success: true,
      message:
        "Registration successful. Please verify your email to activate your account.",
      otp_sent: true,
      email,
      userId,
      otp_code:
        isDevAuthBypassEnabled()
          ? generatedOtp
          : undefined,
    });
  } catch (error: unknown) {
    console.error("API Route Registration Error:", error);
    return NextResponse.json(
      {
        error:
          safeErrorMessage(error, "Internal server error"),
      },
      { status: 500 }
    );
  }
}

