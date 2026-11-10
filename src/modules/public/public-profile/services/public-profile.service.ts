/* eslint-disable @typescript-eslint/no-explicit-any */
// src/modules/public/public-profile/services/public-profile.service.ts


import { formatAssetUrl } from "@/lib/utils";
import { fetchSchoolByUserIdRepo } from "@/modules/school-admin/services/school-admin.repo";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

export interface PublicWorkExperience {
  company_name: string;
  job_title: string;
  location?: string | null;
  location_type?: string | null;
  employment_type?: string | null;
  start_date: string;
  end_date?: string | null;
  is_current_role: boolean;
  job_description?: string | null;
}

export interface PublicEducation {
  school_name?: string;
  school_name_raw?: string | null;
  course_name?: string;
  course_name_raw?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface PublicCertification {
  certificate_name: string;
  issuing_organization: string;
  issue_date?: string | null;
  credential_url?: string | null;
}

export interface PublicJobPreferences {
  job_type?: string | null;
  work_setup?: string | null;
  preferred_location?: string | null;
  salary_range_min?: number | null;
  salary_range_max?: number | null;
  currency?: string | null;
  availability?: string | null;
  preferred_industry?: string | null;
}

export interface PublicSocialLink {
  platform_name: string;
  profile_url: string;
}

export interface PublicFreelancerProfile {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_email?: string;
  avatar_url?: string;
  headline?: string;
  bio?: string;
  skills?: string[];
  portfolio_url?: string;
  work_experience?: PublicWorkExperience[];
  education?: PublicEducation[];
  certifications?: PublicCertification[];
  job_preferences?: PublicJobPreferences | null;
  social_links?: PublicSocialLink[];
}

export interface PublicClientProfile {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_email?: string;
  avatar_url?: string;
  headline: string;
  company?: {
    company_id?: number;
    company_name: string;
    company_legal_name?: string | null;
    company_description?: string | null;
    company_mission?: string | null;
    company_vision?: string | null;
    company_culture?: string | null;
    company_benefits?: string | null;
    company_website?: string | null;
    company_email?: string | null;
    company_contact?: string | null;
    company_logo?: string | null;
    company_cover?: string | null;
    company_address?: string | null;
    industry?: string | null;
    organization_type?: string | null;
    company_size?: string | null;
    year_established?: number | string | null;
    social_links?: {
      facebook?: string | null;
      linkedin?: string | null;
      instagram?: string | null;
      youtube?: string | null;
      x?: string | null;
    };
  } | null;
}

export interface PublicSchoolCourse {
  school_course_id: number;
  course_name: string;
  course_code?: string | null;
  course_status?: string;
}

export interface PublicSchoolAdminProfile {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_email?: string;
  avatar_url?: string;
  headline: string;
  school_id?: number;
  school_name?: string;
  school_type?: string;
  school_logo_url?: string | null;
  school_cover?: string | null;
  school_description?: string | null;
  school_mission?: string | null;
  school_values?: string | null;
  school_email?: string | null;
  school_contact_no?: string | null;
  school_website?: string | null;
  school_address?: string;
  course_count?: number;
  student_count?: number;
  courses?: PublicSchoolCourse[];
  social_links?: {
    facebook?: string | null;
    linkedin?: string | null;
  };
}

/**
 * These pages are reachable without a session and by integer id, so a personal
 * contact address is only ever returned to the owner's own session. Organisational
 * contacts (company/school published email) are unaffected.
 */
function isSelf(callerUserId: number | undefined, id: number): boolean {
  return Number(callerUserId) === Number(id);
}

export async function getPublicFreelancerProfile(
  id: number,
  callerRole: number = 0,
  callerUserId?: number
): Promise<PublicFreelancerProfile | null> {
  try {
    const url = new URL(`${DIRECTUS_BASE}/items/vs_user/${id}`);
    url.searchParams.append(
      "fields",
      "user_id,user_fname,user_lname,user_email,role_id,user_position,job_seeker_profile.*,vs_job_seeker_profile.*,profile_image_url,skills.skill_id.skill_name,vs_user_skills_map.skill_id.skill_name,vs_work_experience.*,work_experience.*,vs_employee_education.*,education.*,vs_employee_education.school_id.*,vs_employee_education.school_course_id.*,vs_certifications.*,certifications.*,vs_job_preferences.*,job_preferences.*,vs_user_social_links.*,social_links.*"
    );

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store", // Don't cache since visibility depends on caller role
    });

    if (!res.ok) {
      console.error("Failed to fetch public profile:", await res.text());
      return null;
    }

    const json = await res.json();
    const user = json.data;

    if (!user) return null;

    // If it's a client (role_id=2), they don't have a job seeker profile, but we can still show their basic info
    if (user.role_id === 2) {
      return {
        user_id: user.user_id,
        user_fname: user.user_fname,
        user_lname: user.user_lname,
        user_email: isSelf(callerUserId, id) ? user.user_email : undefined,
        avatar_url: user.user_image || undefined,
        headline: "Client",
      };
    }

    // Strict checks: must be a freelancer (role_id=1)
    if (user.role_id !== 1) return null;

    let rawProfiles = user.job_seeker_profile || user.vs_job_seeker_profile || [];
    if (!rawProfiles || rawProfiles.length === 0) {
      try {
        const profileUrl = `${DIRECTUS_BASE}/items/vs_job_seeker_profile?filter[user_id][_eq]=${id}`;
        const profileRes = await fetch(profileUrl, { headers: getHeaders(), cache: "no-store" });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          rawProfiles = profileData.data || [];
        }
      } catch (err) {
        console.error("Failed to fetch job seeker profile fallback:", err);
      }
    }
    const profiles = Array.isArray(rawProfiles) ? rawProfiles : [rawProfiles];
    const publicProfile = profiles.find((p: any) => {
      if (!p) return false;
      const vis = p.profile_visibility?.toLowerCase() || "";
      return vis === "public" || (vis === "recruiters only" && callerRole === 2);
    });

    if (!publicProfile) return null; // Profile is not public or not visible to this caller

    let rawSkills = user.skills || user.vs_user_skills_map || [];
    if (!rawSkills || rawSkills.length === 0) {
      try {
        const skillsUrl = `${DIRECTUS_BASE}/items/vs_user_skills_map?filter[user_id][_eq]=${id}&fields=*,skill_id.*`;
        const skillsRes = await fetch(skillsUrl, { headers: getHeaders(), cache: "no-store" });
        if (skillsRes.ok) {
          const skillsData = await skillsRes.json();
          rawSkills = skillsData.data || [];
        }
      } catch (err) {
        console.error("Failed to fetch skills fallback:", err);
      }
    }
    const skillList = rawSkills
      .map((s: any) => s.skill_id?.skill_name || s.skill?.skill_name)
      .filter(Boolean);

    // Map Work Experience
    let rawWork = user.vs_work_experience || user.work_experience || [];
    if (!rawWork || rawWork.length === 0) {
      try {
        const expUrl = `${DIRECTUS_BASE}/items/vs_work_experience?filter[user_id][_eq]=${id}`;
        const expRes = await fetch(expUrl, { headers: getHeaders(), cache: "no-store" });
        if (expRes.ok) {
          const expData = await expRes.json();
          rawWork = expData.data || [];
        }
      } catch (err) {
        console.error("Failed to fetch work experience fallback:", err);
      }
    }
    const workExperience: PublicWorkExperience[] = rawWork.map((w: any) => ({
      company_name: w.company_name,
      job_title: w.job_title,
      location: w.location,
      location_type: w.location_type,
      employment_type: w.employment_type,
      start_date: w.start_date,
      end_date: w.end_date,
      is_current_role: !!w.is_current_role,
      job_description: w.job_description,
    }));

    // Map Education
    let rawEdu = user.vs_employee_education || user.education || [];
    if (!rawEdu || rawEdu.length === 0) {
      try {
        const eduUrl = `${DIRECTUS_BASE}/items/vs_employee_education?filter[user_id][_eq]=${id}&fields=*,school_id.*,school_course_id.*`;
        const eduRes = await fetch(eduUrl, { headers: getHeaders(), cache: "no-store" });
        if (eduRes.ok) {
          const eduData = await eduRes.json();
          rawEdu = eduData.data || [];
        }
      } catch (err) {
        console.error("Failed to fetch education fallback:", err);
      }
    }
    const education: PublicEducation[] = rawEdu.map((edu: any) => ({
      school_name: typeof edu.school_id === 'object' ? edu.school_id?.school_name : edu.school_name,
      school_name_raw: edu.school_name_raw,
      course_name: typeof edu.school_course_id === 'object' ? edu.school_course_id?.course_name : edu.course_name,
      course_name_raw: edu.course_name_raw,
      start_date: edu.start_date,
      end_date: edu.end_date
    }));

    // Map Certifications
    let rawCert = user.vs_certifications || user.certifications || [];
    if (!rawCert || rawCert.length === 0) {
      try {
        const certUrl = `${DIRECTUS_BASE}/items/vs_certifications?filter[user_id][_eq]=${id}`;
        const certRes = await fetch(certUrl, { headers: getHeaders(), cache: "no-store" });
        if (certRes.ok) {
          const certData = await certRes.json();
          rawCert = certData.data || [];
        }
      } catch (err) {
        console.error("Failed to fetch certifications fallback:", err);
      }
    }
    const certifications: PublicCertification[] = rawCert.map((c: any) => ({
      certificate_name: c.certificate_name,
      issuing_organization: c.issuing_organization,
      issue_date: c.issue_date,
      credential_url: c.credential_url,
    }));

    // Map Job Preferences
    let rawPrefs = user.vs_job_preferences || user.job_preferences || [];
    if (!rawPrefs || rawPrefs.length === 0) {
      try {
        const prefsUrl = `${DIRECTUS_BASE}/items/vs_job_preferences?filter[user_id][_eq]=${id}`;
        const prefsRes = await fetch(prefsUrl, { headers: getHeaders(), cache: "no-store" });
        if (prefsRes.ok) {
          const prefsData = await prefsRes.json();
          rawPrefs = prefsData.data || [];
        }
      } catch (err) {
        console.error("Failed to fetch job preferences fallback:", err);
      }
    }
    const pref = Array.isArray(rawPrefs) ? rawPrefs[0] : rawPrefs;
    const jobPreferences: PublicJobPreferences | null = pref ? {
      job_type: pref.job_type,
      work_setup: pref.work_setup,
      preferred_location: pref.preferred_location,
      salary_range_min: pref.salary_range_min,
      salary_range_max: pref.salary_range_max,
      currency: pref.currency,
      availability: pref.availability,
      preferred_industry: pref.preferred_industry,
    } : null;

    // Map Social Links
    let rawSocial = user.vs_user_social_links || user.social_links || [];
    if (!rawSocial || rawSocial.length === 0) {
      try {
        const socialUrl = `${DIRECTUS_BASE}/items/vs_user_social_links?filter[user_id][_eq]=${id}`;
        const socialRes = await fetch(socialUrl, { headers: getHeaders(), cache: "no-store" });
        if (socialRes.ok) {
          const socialData = await socialRes.json();
          rawSocial = socialData.data || [];
        }
      } catch (err) {
        console.error("Failed to fetch social links fallback:", err);
      }
    }
    const socialLinks: PublicSocialLink[] = rawSocial.map((s: any) => ({
      platform_name: s.platform_name,
      profile_url: s.profile_url,
    }));

    return {
      user_id: user.user_id,
      user_fname: user.user_fname,
      user_lname: user.user_lname,
      user_email: isSelf(callerUserId, id) ? user.user_email : undefined,
      avatar_url: user.profile_image_url ? (formatAssetUrl(user.profile_image_url) ?? undefined) : undefined,
      headline: user.user_position || publicProfile.professional_headline || "Freelancer",
      bio: publicProfile.professional_summary || publicProfile.about_me || "",
      skills: skillList,
      portfolio_url: publicProfile.portfolio_url || "",
      work_experience: workExperience,
      education,
      certifications,
      job_preferences: jobPreferences,
      social_links: socialLinks,
    };
  } catch (err) {
    console.error("Error fetching public freelancer profile:", err);
    return null;
  }
}

export async function getPublicClientProfile(
  id: number,
  callerUserId?: number
): Promise<PublicClientProfile | null> {
  try {
    const url = new URL(`${DIRECTUS_BASE}/items/vs_user/${id}`);
    url.searchParams.append("fields", "user_id,user_fname,user_lname,user_email,role_id,profile_image_url");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Failed to fetch public client profile:", await res.text());
      return null;
    }

    const json = await res.json();
    const user = json.data;

    if (!user || user.role_id !== 2) return null;

    // Fetch company association
    let companyDetails = null;
    try {
      const linkUrl = `${DIRECTUS_BASE}/items/vs_company_user?filter[user_id][_eq]=${id}&fields=company_id.*,company_id.industry_id.*,company_id.organization_type_id.*,company_id.company_size_id.*&limit=1`;
      const linkRes = await fetch(linkUrl, { headers: getHeaders(), cache: "no-store" });
      let comp = null;

      if (linkRes.ok) {
        const linkJson = await linkRes.json();
        const association = linkJson.data?.[0];
        if (association && association.company_id) {
          comp = association.company_id;
        }
      }

      if (!comp) {
        const directCompUrl = `${DIRECTUS_BASE}/items/vs_company?filter[created_by_user_id][_eq]=${id}&fields=*,industry_id.*,organization_type_id.*,company_size_id.*&limit=1`;
        const directCompRes = await fetch(directCompUrl, { headers: getHeaders(), cache: "no-store" });
        if (directCompRes.ok) {
          const directCompJson = await directCompRes.json();
          comp = directCompJson.data?.[0];
        }
      }

      if (comp) {
        const addressParts = [
          comp.company_address,
          comp.company_brgy,
          comp.company_city,
          comp.company_province,
          comp.company_zipCode,
          comp.company_country
        ].filter(Boolean);

        const industryName = typeof comp.industry_id === "object" && comp.industry_id !== null
          ? comp.industry_id.industry_name
          : comp.industry || null;

        const orgTypeName = typeof comp.organization_type_id === "object" && comp.organization_type_id !== null
          ? comp.organization_type_id.organization_type_name
          : comp.organization_type || null;

        const companySizeName = typeof comp.company_size_id === "object" && comp.company_size_id !== null
          ? comp.company_size_id.company_size_name
          : comp.company_size || null;

        companyDetails = {
          company_id: comp.company_id,
          company_name: comp.company_name,
          company_legal_name: comp.company_legal_name || null,
          company_description: comp.company_description || null,
          company_mission: comp.company_mission || null,
          company_vision: comp.company_vision || null,
          company_culture: comp.company_culture || null,
          company_benefits: comp.company_benefits || null,
          company_website: comp.company_website || null,
          company_email: comp.company_email || null,
          company_contact: comp.company_contact || null,
          company_logo: formatAssetUrl(comp.company_logo),
          company_cover: formatAssetUrl(comp.company_cover),
          company_address: addressParts.join(", ") || null,
          industry: industryName,
          organization_type: orgTypeName,
          company_size: companySizeName,
          year_established: comp.year_established || null,
          social_links: {
            facebook: comp.company_facebook || null,
            linkedin: comp.company_linkedin || null,
            instagram: comp.company_instagram || null,
            youtube: comp.company_youtube || null,
            x: comp.company_x || null,
          },
        };
      }
    } catch (err) {
      console.error("Failed to fetch company details for public profile:", err);
    }

    return {
      user_id: user.user_id,
      user_fname: user.user_fname,
      user_lname: user.user_lname,
      user_email: isSelf(callerUserId, id) ? user.user_email : undefined,
      avatar_url: user.profile_image_url ? (formatAssetUrl(user.profile_image_url) ?? undefined) : undefined,
      headline: "Client",
      company: companyDetails,
    };
  } catch (err) {
    console.error("Error fetching public client profile:", err);
    return null;
  }
}

export async function getPublicSchoolAdminProfile(
  id: number,
  callerUserId?: number
): Promise<PublicSchoolAdminProfile | null> {
  try {
    let user: any = null;
    try {
      const url = new URL(`${DIRECTUS_BASE}/items/vs_user/${id}`);
      url.searchParams.append("fields", "user_id,user_fname,user_lname,user_email,role_id,profile_image_url");

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: getHeaders(),
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        user = json.data;
      }
    } catch (err) {
      console.warn("Could not fetch user record:", err);
    }

    let school_id: number | undefined = undefined;
    let school_name = undefined;
    let school_type = undefined;
    let school_logo_url = null;
    let school_cover = null;
    let school_description = null;
    let school_mission = null;
    let school_values = null;
    let school_email = null;
    let school_contact_no = null;
    let school_website = null;
    let school_address = undefined;
    let course_count = 0;
    let student_count = 0;
    let social_links = { facebook: null as string | null, linkedin: null as string | null };

    // 1. Try finding school associated with user (via vs_school_admin or fetchSchoolByUserIdRepo)
    if (user) {
      try {
        const schoolStats = await fetchSchoolByUserIdRepo(id);
        if (schoolStats) {
          school_id = typeof schoolStats.school_id === "object" && schoolStats.school_id !== null ? Number((schoolStats.school_id as any).school_id) : Number(schoolStats.school_id);
          school_name = schoolStats.school_name;
          school_type = schoolStats.school_type;
          school_logo_url = formatAssetUrl(schoolStats.school_logo_url);
          school_cover = formatAssetUrl(schoolStats.school_cover);
          school_description = schoolStats.school_description;
          school_mission = schoolStats.school_mission;
          school_values = schoolStats.school_values;
          school_email = schoolStats.school_email;
          school_contact_no = schoolStats.school_contact_no;
          school_website = schoolStats.school_website;
          social_links = {
            facebook: schoolStats.school_facebook || null,
            linkedin: schoolStats.school_linkedin || null,
          };
          
          const addressParts = [
            schoolStats.address_line,
            schoolStats.barangay,
            schoolStats.city_municipality,
            schoolStats.province,
            schoolStats.postal_code,
            schoolStats.country
          ].filter(Boolean);
          school_address = addressParts.join(", ");
          course_count = schoolStats.course_count;
          student_count = schoolStats.student_count;
        }

        if (!school_name) {
          const adminUrl = `${DIRECTUS_BASE}/items/vs_school_admin?filter[user_id][_eq]=${id}&limit=1`;
          const adminRes = await fetch(adminUrl, { headers: getHeaders(), cache: "no-store" });
          if (adminRes.ok) {
            const adminJson = await adminRes.json();
            const adminRecord = adminJson.data?.[0];
            const rawSid = typeof adminRecord?.school_id === "object" ? adminRecord?.school_id?.school_id : adminRecord?.school_id;
            if (rawSid) {
              const sRes = await fetch(`${DIRECTUS_BASE}/items/vs_school/${rawSid}?fields=*`, { headers: getHeaders(), cache: "no-store" });
              if (sRes.ok) {
                const sJson = await sRes.json();
                const s = sJson.data;
                if (s) {
                  school_id = Number(s.school_id);
                  school_name = s.school_name;
                  school_type = s.school_type;
                  school_logo_url = formatAssetUrl(s.school_logo_url);
                  school_cover = formatAssetUrl(s.school_cover);
                  school_description = s.school_description;
                  school_mission = s.school_mission;
                  school_values = s.school_values;
                  school_email = s.school_email;
                  school_contact_no = s.school_contact_no;
                  school_website = s.school_website;
                  social_links = {
                    facebook: s.school_facebook || null,
                    linkedin: s.school_linkedin || null,
                  };
                  const addressParts = [
                    s.address_line,
                    s.barangay,
                    s.city_municipality,
                    s.province,
                    s.postal_code,
                    s.country,
                  ].filter(Boolean);
                  school_address = addressParts.join(", ");
                }
              }
            }
          }
        }

        if (!school_name) {
          const directSchoolUrl = `${DIRECTUS_BASE}/items/vs_school?filter[created_by][_eq]=${id}&limit=1`;
          const directSchoolRes = await fetch(directSchoolUrl, { headers: getHeaders(), cache: "no-store" });
          if (directSchoolRes.ok) {
            const directSchoolJson = await directSchoolRes.json();
            const s = directSchoolJson.data?.[0];
            if (s) {
              school_id = Number(s.school_id);
              school_name = s.school_name;
              school_type = s.school_type;
              school_logo_url = formatAssetUrl(s.school_logo_url);
              school_cover = formatAssetUrl(s.school_cover);
              school_description = s.school_description;
              school_mission = s.school_mission;
              school_values = s.school_values;
              school_email = s.school_email;
              school_contact_no = s.school_contact_no;
              school_website = s.school_website;
              social_links = {
                facebook: s.school_facebook || null,
                linkedin: s.school_linkedin || null,
              };
              const addressParts = [
                s.address_line,
                s.barangay,
                s.city_municipality,
                s.province,
                s.postal_code,
                s.country,
              ].filter(Boolean);
              school_address = addressParts.join(", ");
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch school details for admin public profile:", e);
      }
    }

    // 2. Direct School Fallback by school_id
    if (!school_name) {
      try {
        const directUrl = `${DIRECTUS_BASE}/items/vs_school/${id}?fields=*`;
        const directRes = await fetch(directUrl, { headers: getHeaders(), cache: "no-store" });
        if (directRes.ok) {
          const directJson = await directRes.json();
          const s = directJson.data;
          if (s) {
            school_id = s.school_id;
            school_name = s.school_name;
            school_type = s.school_type;
            school_logo_url = formatAssetUrl(s.school_logo_url);
            school_cover = formatAssetUrl(s.school_cover);
            school_description = s.school_description;
            school_mission = s.school_mission;
            school_values = s.school_values;
            school_email = s.school_email;
            school_contact_no = s.school_contact_no;
            school_website = s.school_website;
            social_links = {
              facebook: s.school_facebook || null,
              linkedin: s.school_linkedin || null,
            };
            const addressParts = [
              s.address_line,
              s.barangay,
              s.city_municipality,
              s.province,
              s.postal_code,
              s.country,
            ].filter(Boolean);
            school_address = addressParts.join(", ");
          }
        }
      } catch (err) {
        console.error("Direct school lookup fallback failed:", err);
      }
    }

    if (!school_name) return null;

    let coursesList: PublicSchoolCourse[] = [];
    if (school_id) {
      try {
        const [cRes, stRes, coursesRes] = await Promise.all([
          fetch(`${DIRECTUS_BASE}/items/vs_school_course?filter[school_id][_eq]=${school_id}&aggregate[count]=*`, { headers: getHeaders(), cache: "no-store" }),
          fetch(`${DIRECTUS_BASE}/items/vs_school_student?filter[school_id][_eq]=${school_id}&aggregate[count]=*`, { headers: getHeaders(), cache: "no-store" }),
          fetch(`${DIRECTUS_BASE}/items/vs_school_course?filter[school_id][_eq]=${school_id}&sort[]=course_name&limit=100`, { headers: getHeaders(), cache: "no-store" }),
        ]);
        if (cRes.ok) {
          const cJson = await cRes.json();
          course_count = Number(cJson.data?.[0]?.count) || 0;
        }
        if (stRes.ok) {
          const stJson = await stRes.json();
          student_count = Number(stJson.data?.[0]?.count) || 0;
        }
        if (coursesRes.ok) {
          const coursesJson = await coursesRes.json();
          const rawCourses: any[] = coursesJson.data || [];
          coursesList = rawCourses
            .filter((c: any) => {
              const status = String(c.course_status || "").trim().toLowerCase();
              return status === "active" || status === "";
            })
            .map((c: any) => ({
              school_course_id: c.school_course_id,
              course_name: c.course_name,
              course_code: c.course_code || null,
              course_status: c.course_status || "Active",
            }));
        }
      } catch (err) {
        console.error("Failed to fetch courses data:", err);
      }
    }

    return {
      user_id: user?.user_id || id,
      user_fname: user?.user_fname || "",
      user_lname: user?.user_lname || "",
      // school_email is the institution's published contact; the admin's own
      // address is only returned to their own session.
      user_email: school_email || (isSelf(callerUserId, id) ? user?.user_email : undefined),
      avatar_url: school_logo_url
        ? school_logo_url
        : (user?.profile_image_url ? (formatAssetUrl(user.profile_image_url) ?? undefined) : undefined),
      headline: "School Admin",
      school_id,
      school_name,
      school_type,
      school_logo_url,
      school_cover,
      school_description,
      school_mission,
      school_values,
      school_email,
      school_contact_no,
      school_website,
      school_address,
      course_count: coursesList.length || course_count,
      student_count,
      courses: coursesList,
      social_links,
    };
  } catch (err) {
    console.error("Error fetching public school admin profile:", err);
    return null;
  }
}
