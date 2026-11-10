export interface SocialPlatformConfig {
    name: string;
    label: string;
    domains?: string[];
    placeholder: string;
    example: string;
}

export const SOCIAL_PLATFORMS: SocialPlatformConfig[] = [
    {
        name: "Github",
        label: "GitHub",
        domains: ["github.com"],
        placeholder: "https://github.com/username",
        example: "https://github.com/username",
    },
    {
        name: "GitLab",
        label: "GitLab",
        domains: ["gitlab.com"],
        placeholder: "https://gitlab.com/username",
        example: "https://gitlab.com/username",
    },
    {
        name: "LinkedIn",
        label: "LinkedIn",
        domains: ["linkedin.com"],
        placeholder: "https://linkedin.com/in/username",
        example: "https://linkedin.com/in/username",
    },
    {
        name: "X (Twitter)",
        label: "X (Twitter)",
        domains: ["x.com", "twitter.com"],
        placeholder: "https://x.com/username",
        example: "https://x.com/username",
    },
    {
        name: "YouTube",
        label: "YouTube",
        domains: ["youtube.com", "youtu.be"],
        placeholder: "https://youtube.com/@channel",
        example: "https://youtube.com/@channel",
    },
    {
        name: "Facebook",
        label: "Facebook",
        domains: ["facebook.com", "fb.com"],
        placeholder: "https://facebook.com/username",
        example: "https://facebook.com/username",
    },
    {
        name: "Personal Portfolio",
        label: "Personal Portfolio",
        placeholder: "https://yourportfolio.com",
        example: "https://yourportfolio.com",
    },
    {
        name: "Other",
        label: "Other",
        placeholder: "https://example.com/profile",
        example: "https://example.com/profile",
    },
];

export function normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
    }
    return `https://${trimmed}`;
}

export function validateSocialUrl(
    platformName: string,
    rawUrl: string
): { isValid: boolean; normalizedUrl: string; error?: string } {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
        return { isValid: false, normalizedUrl: "", error: "URL cannot be empty." };
    }

    const normalized = normalizeUrl(trimmed);

    let parsed: URL;
    try {
        parsed = new URL(normalized);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return { isValid: false, normalizedUrl: normalized, error: "URL must use http or https protocol." };
        }
        if (!parsed.hostname || !parsed.hostname.includes(".")) {
            return { isValid: false, normalizedUrl: normalized, error: "Please enter a valid domain address." };
        }
    } catch {
        return { isValid: false, normalizedUrl: normalized, error: "Invalid URL syntax." };
    }

    const platform = SOCIAL_PLATFORMS.find(
        (p) => p.name.toLowerCase() === platformName.toLowerCase()
    );

    if (platform && platform.domains && platform.domains.length > 0) {
        const hostname = parsed.hostname.toLowerCase();
        const matchesDomain = platform.domains.some(
            (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
        );
        if (!matchesDomain) {
            return {
                isValid: false,
                normalizedUrl: normalized,
                error: `URL domain must match ${platform.domains.join(" or ")} (e.g. ${platform.example})`,
            };
        }
    }

    return { isValid: true, normalizedUrl: normalized };
}
