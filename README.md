# LinkBridge

[![CI](https://github.com/P-Christian/vos-sync/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/P-Christian/vos-sync/actions/workflows/ci.yml)
[![CD Pipeline](https://github.com/P-Christian/vos-sync/actions/workflows/deploy.yml/badge.svg?branch=master)](https://github.com/P-Christian/vos-sync/actions/workflows/deploy.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)
![React](https://img.shields.io/badge/React-19-20232A?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat&logo=tailwind-css)

VOS Sync is a multi-role employment and talent management platform connecting **Job Seekers, Employers, and Schools** with intelligent candidate matching, recruitment workflows, interview management, and AI-assisted hiring capabilities.

## Key Features

### VOS Admin
#### Gemini AI Service Monitoring

* Centralized `callGeminiMonitored()` wrapper for all Gemini API calls.
* Request telemetry, token usage, latency, status, user, company, provider, and request type tracking.
* Dynamic model-aware cost calculation and daily token monitoring.
* Live RPM, TPM, and RPD quota utilization.
* Application-level AI usage breakdown across:

  * Candidate Match Explainer
  * Best Match AI
  * Query Enrichment
  * AI Reranker
* Real-time request audit stream with Philippine local-time formatting and client-side pagination.
* **Structured Two-Tier Filter Toolbar & Live Audit Search**: Filter telemetry by AI Engine (Cloud vs Local), Time Period presets (anchored to PH Time UTC+8), Feature type, and smooth slide-in Custom Date Range with active filter badges and live keyword search across audit logs.
* **Peak Usage Surge Analytics & Motion Transitions**: Deep analytics page with interactive metric card hover lifts, animated spring-driven 24-hour surge bar chart transitions, and popLayout animated table rows.
* Per-user and per-company attribution for cost allocation and anomaly detection.
* Fire-and-forget telemetry persistence to prevent monitoring from affecting AI response latency.

#### AI Model & Provider Management

* **Multi-Provider Architecture**: Dynamic adapter system supporting Google Gemini, OpenAI, Anthropic Claude, Mistral AI, and Local AI (Ollama / LM Studio).
* **Encrypted Credential Storage & Security Hardening**: Server-side AES-256-GCM credential encryption at rest; strict cryptographic admin role verification (`ADMIN` / role ID 3); SSRF protection and hostname allowlisting on custom test endpoints; credential exfiltration prevention; and git tracking isolation.
* **Workload Routing Matrix**: Granular mapping of application features (`AUTO_CREATE_JOB`, `MATCH_EXPLAINER`, `QUERY_UNDERSTANDING`, etc.) to designated primary and fallback models to prevent rate-limit bottlenecks.
* **Automatic 429 Rate-Limit Failover**: Real-time failover switching to backup models or Local AI upon encountering rate limits or provider downtime.
* **Live Connection Testing & Model Discovery**: In-dashboard ping diagnostics and one-click model catalog scanning for local and cloud providers with protected egress controls.

#### System Security & Vulnerability Hardening

* **End-to-End Cryptographic JWT Session Enforcement**: Replaced insecure base64 JSON token parsing across all client, freelancer, settings data requests, AI recommendations, profile views, shared messaging, and school admin API handlers with canonical `authenticateRequest` cryptographic signature verification (`jose.jwtVerify`) and real-time account status checks.
* **Database Password Security & Hashed Compatibility**: Completely eliminated plaintext password storage in database records by persisting `bcrypt` hashes into the legacy `user_password` column across user registration, school registration, and password reset flows.
* **Unified 4-Role Session Matrix & State-Driven Header**: Formally mapped all four platform roles (`FREELANCER`, `CLIENT`, `ADMIN`, `SCHOOL_ADMIN`) in `src/lib/authenticated-session.ts` with the canonical `isSchoolAdminSession` helper; refactored the public Header to query `/api/auth/me` first, eliminating 401 console errors on guest and admin visits.
* **School Metrics & Unmetered AI Endpoint Shielding**: Gated `/api/school-admin/success-metrics` and `/api/school-admin/success-metrics/ai-insights` with session authentication, school administrator role authorization, and institution ID validation, blocking unauthorized telemetry scraping and unmetered Gemini AI invocations.
* **OTP Hardening, CSPRNG & Brute-Force Lockout**: Secured client, school signup, and school registration OTP flows by generating codes using Node CSPRNG (`randomInt`), hashing one-time passwords at rest with `bcrypt.hash`, comparing securely via `bcrypt.compare`, removing console debug credential leakage, and enforcing a 5-attempt brute-force lockout on verification endpoints.
* **Data Request Integrity & Tamper Protection**: Fortified `/api/freelancer/settings/data-requests` with canonical session authentication and cryptographic SHA-256 digest generation (`crypto.createHash`) for exported data artifacts, preventing unauthorized account exports, forged deletions, or checksum tampering.
* **Elimination of Insecure Secret Fallbacks & Production Auth Guarding**: Migrated School Admin, Freelancer, and Client profile readers from insecure `"default_super_secret_key_for_development"` string fallbacks to centralized session validation via `getJwtVerificationSecret()`; guarded `NEXT_PUBLIC_AUTH_DISABLED` against unauthorized bypass in production builds.
* **Dedicated Session Registry (`vs_user_sessions`) & Multi-Device Isolation**: Transitioned from a single global `session_epoch` to an enterprise session registry (`vs_user_sessions`) tracking browser profiles and physical devices across local (`msi-lo`) and production (`ubuntuserver1`) deployments. Standard logout revokes only the current session token (`sid`), leaving other active profiles and devices online; active sessions UI provides real-time visibility with remote revocation and "Log out all other devices" controls; and password updates feature a confirmation dialog allowing users to revoke all other sessions while preserving their current session uninterrupted.
* **File Upload & Transport Security**: Stripped SVG MIME types from school admin file upload handlers to eliminate stored script execution vectors; tuned transport headers in `next.config.ts` to support plain HTTP LAN and port 4000 traffic without browser upgrade conflicts.
* **Stored XSS Sanitization**: Lightweight zero-dependency HTML sanitizer (`src/lib/sanitize-html.ts`) stripping active scripts, dangerous embeddings, and inline event handlers from rich-text job descriptions and forms.
* **Dynamic Base URL Resolution in Email Templates**: Standardized candidate and employer email notification templates (`src/lib/mail/templates/`) to dynamically generate destination links via a unified `getBaseUrl()` resolver that automatically inspects runtime origin and environment variables (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `VERCEL_URL`) rather than hardcoding localhost.

#### Platform Design & Interactive Network Canvas

* **Dynamic Constellation Network & Motion Accessibility**: GPU-accelerated canvas background (`NetworkBackground.tsx`) with drifting glowing nodes, proximity connections, rotating dashed hub rings, hopping data packets, pointerdown shockwave waves, scroll parallax, and TDZ-safe reduced-motion static rendering integrated across all public platform pages (`/`, `/find-jobs`, `/companies`, `/how-it-works`, `/login`, `/signup`).
* **High-Contrast Frosted Glassmorphism**: Tailored translucent card surface system (`bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)]`) paired with subtle brand-blue hover glow transitions (`hover:shadow-[0_8px_30px_rgba(37,99,235,0.12)] hover:border-primary/40`) applied across landing cards, search bars, job opportunity listings, company profiles and detail tabs (`/companies/[companyCode]`), and auth forms.
* **Optimized Image Loading & Search Decoupling**: Asynchronous image decoding (`decoding="async"`), smooth loaded opacity transitions, and fallback placeholders across company headers, browse cards, and carousels, paired with debounced/explicit submission search patterns to eliminate typing lag.
* **Client Portal Canvas, Panel Elevation & UI Standardization**: Static multi-stop radial gradient canvas (`.client-canvas`) across all 10 client portal routes with soft blue, sky, and violet ambient light pools; uniform `--shadow-panel` and `--shadow-panel-hover` tokens; reusable `ErrorState` and accessible `ListSkeleton` loading components; framer-motion `AnimatedNumber` counters and distinctive color tones on KPI cards; gradient hero card in `DashboardHeader`; dynamic candidate avatar tones with initials fallback; `/` search shortcut and accessible announcements in `ApplicantFilters`; and accessible `AlertDialog` confirmation modals.
* **Client Portal Dashboard Modernization & Navigation**: Global `Ctrl/⌘+K` Command Palette, server pre-rendered metrics and company profile data (`getClientDashboardData`, `getClientCompanyProfileData`) eliminating intermediate skeletons and duplicate in-page loaders on navigation, contextual semantic `<Link>` KPI cards with 400ms count-up easing, `localStorage`-backed Hiring Overview range filters with skeleton transitions, "+ New" quick action menu, preview notification dropdown with Today / Earlier grouping, Needs Attention inline action queue with 5-second Sonner undo, dismissible onboarding checklist, and calibrated light (`#F4F6FA` / `#FFFFFF`) and dark (`#0B1020` / `#121A2E`) palettes.
* **Applicant Management & Talent Search Primary Document Presentation**: Redesigned `/vos-sync/client/applicants` to match VoSync's clean notifications-style open page header with candidate and review counters, inline job selector, and Best Match AI toggle; unified all filter tabs (`All Candidates`, `Active Pipeline`, and individual stages) into an interactive horizontal scrollable pill bar with count badges, colored stage dots, and an accessible search bar with `/` keyboard shortcut; restructured candidate cards into balanced 3-zoned frosted glass surfaces (`bg-card/75 dark:bg-card/55 backdrop-blur-xl border-primary/10`) featuring structured qualification chips and direct primary action buttons ("Review Assessment", "Schedule Interview"); updated candidate details, applicant cards, and Talent Search profile drawers (`TalentProfileDrawer.tsx`) to filter and display strictly the candidate's active primary resume (`is_primary = 1`), with synchronized portfolio count badges and primary status tags; resolved PDF document loading failure by implementing authenticated session blob streaming with zero-dependency browser-native embedded viewing (`iframe`/`object`); and eliminated floating `X` close button collisions over action and contact buttons with dedicated, cleanly spaced header close controls.
* **Dedicated ATS Pipeline Configuration Module & Interactive Assessment Authoring**: Extracted ATS recruitment pipeline workflows into a dedicated, standalone employer module (`/vos-sync/client/ats-pipeline`, `PipelineModule.tsx`, `PipelineSettingsTab.tsx`) with a transparent page header, inline template switcher, unified frosted container, and action toolbar matching the Notifications layout pattern; features stage drag-and-drop reordering, transition configuration rules, and stage-linked assessment task assignments with Framer Motion spring physics (`Reorder.Group`), optimistic reordering and deletion animations, and disabled reorder button guards while saving to eliminate conflicting out-of-order requests; reorganized the Client Portal sidebar navigation by converting the "Account" section into a dedicated "Configuration" section hosting "ATS Pipeline", while removing redundant configuration entries and aligning the user avatar dropdown menu to point cleanly to "Settings" (`/vos-sync/client/settings`).
* **Grouped Navigation Sidebar, Frosted Glass Header & Account Hub Standardization**: Organized portal sidebar navigation into clear functional sections with tighter row density (`h-[38px]`) and pinned bottom `Configuration` items; enhanced `DashboardSidebar` with Framer Motion spring-animated active indicator bars, longest-match sub-route resolution, unified unread notification and messaging badges with preserved numeric counts and non-hidden screen reader announcements in collapsed mode, an interactive footer account card featuring verification status chips and a `MoreVertical` (`⋮`) dropdown menu (Profile, Settings, Theme toggle, and direct Logout), collapsed avatar tooltip (`{user.name} · Verified`) with success indicator dot, and standardized `size-9` (36px) vertical centerline alignment across logo tile, nav buttons, and avatar; converted top portal headers to frosted glassmorphism (`bg-background/80 backdrop-blur-xl`) with compact avatar-only user triggers; adapted search bar shortcut chips to dynamically reflect the user's OS (`Ctrl K` on Windows/Linux, `⌘K` on macOS); and standardized all Client Portal pages under reusable `PageContainer` layouts.
* **Dynamic Employer Ownership Verification for Client Portal Actions**: Session-level employer company resolution (`companyId`, `companyCode`) through `/api/auth/me` and `useAuthSession`, enabling dynamic ownership detection across `PublicJobDetailModal` and `CompanyHeader` to render tailored "Manage Jobs" links (`/vos-sync/client/jobs`) and owner badges for employer-owned postings while preserving public preview navigation for other companies.
* **Public Landing Page Navigation & Find Jobs Parameter Integration**: Client-driven controlled search routing (`HomeSearchBar.tsx`) on the home page hero forwarding keyword (`q`) and `location` queries to `/find-jobs`, interactive popular search tag chips and category cards with URL filtering, featured opportunities linking directly to job details via `?open_job=...`, and automatic query parameter and job modal ingestion in `FindJobsModule.tsx`.
* **Top Loading Progress Bar & Zero-Freeze Route Preloading**: Global full-width top progress bar (`TopProgressBar.tsx`) with aurora gradient (`from-primary via-info to-sky-400`), glowing tip, internal link click interceptor, and 100ms/200ms delay gates; paired with server-side data pre-rendering (`getPublicJobs`), null fallbacks, explicit `prefetch={true}` on navigation links, and Next.js Router Cache retention (`experimental.staleTimes`) to eliminate skeleton flashing and ensure smooth, instant page transitions.
* **Full-Bleed Navigation Bar Company Cover Integration & Jitter-Free Header**: Standardized fixed 72px (`h-[72px]`) navigation bar with visual-only background transitions (`transition-[background-color,border-color,box-shadow,backdrop-filter]`), eliminating scroll height jitter and padding shifts; extended company profile cover photos (`/companies/[companyCode]`) to bleed seamlessly to the top edge behind the transparent navigation bar (`-mt-24`, `h-72 sm:h-80 md:h-[380px]`) paired with an ambient top scrim vignette to guarantee crisp navbar readability across themes.
* **Dual-Theme Harmonization**: Synchronized dark and light mode color transitions using `next-themes` with zero flashing or hard boundary cutoffs.

#### Autonomous Taxonomy Enrichment & Shared Governance

* Unified taxonomy governance engine (`src/modules/vos-admin/role-matching/services/taxonomy/`).
* Zero-touch background auto-approval for safe additions (`SYNONYM`, `ABBREVIATION`, `Master Skill`) with confidence `>= 0.80-0.85`.
* Piggybacked inside `BEST_MATCH` and `AI_ROLE_SUGGEST` calls for 0 extra RPD/RPM cost.
* Automatic Directus deduplication & race-condition conflict handling across `vs_role_category`, `vs_role_title`, `vs_role_title_alias`, `vs_master_skills`, and `vs_role_skill_mapping`.
* Queues ambiguous `RELATED_ROLE` and `BROAD_ROLE` concepts for Admin Exception Review.

#### Matching Intelligence Module

* Renamed and broadened "Role & Skill Intelligence" into **Matching Intelligence** — a unified governance layer for all job taxonomy, search relevance, and candidate-job matching signals.
* Dashboard exposes five live metrics: Job Categories, Standard Roles, Keywords & Synonyms, Role Skill Mappings, and **Pending Requests** (count of `PENDING` category suggestions awaiting review).
* **Unified Matching Taxonomy Editor**: Consolidated 4 disconnected manager interfaces into a single interactive 4-tier tree editor (`/vos-admin/job-roles/taxonomy`) with real-time multi-level search (across categories, roles, skills, and keywords) and direct in-tree CRUD controls for categories and roles.
* **Role Detail Slide-Over Sheet**: Rich side-drawer panel (`RoleDetailSheet`) enabling comprehensive role management with visual importance weight sliders (`0%`–`100%`), required/preferred competency toggles, keyword match weight sliders, and built-in AI Skill and AI Keyword Generators with deduplication.
* **Streamlined 3 Governance Hubs**: Dashboard navigation simplified to **Approval Queue**, **Matching Taxonomy**, and **Match Test Studio**.
* **Interactive Match Test Studio & Candidate Sandbox**: Live query simulation environment (`MatchTestStudio`) equipped with an interactive Jobseeker Profile Inspector & Sandbox Editor allowing admins to customize headline, professional summary, skills (add/remove tag chips), work history roles, and industry certifications (`certifications`), or switch across candidate archetypes (Full-Stack, Frontend, Social Media, Data Analyst) to evaluate engine scoring, compatibility breakdowns, and verified evidence signals in real-time.
* **Approval Queue** at `/vos-admin/job-roles/approval-queue`: admin-facing governance panel fed from `vs_role_category_suggestion` supporting 3 resolution actions: **Create New Category**, **Map to Existing Category**, and **Reject Suggestion** with mandatory admin audit remarks.
* **Non-Destructive Job Governance**: Rejecting a taxonomy suggestion strictly rejects the taxonomy candidate; the originating job remains active and usable with `category_id = NULL`.
* **Originating Job Linkage**: Category suggestions link to originating `job_id`; approving via *Create New* or *Map Existing* automatically synchronizes `category_id` and canonical `job_category` onto the linked `vs_job_posting` record.
* Generalized `IntelligenceEntityType`, `IntelligenceRequestStatus`, `ResolutionType`, and `IntelligenceRequest` types designed to extend to Job Roles, Skills, Keywords, and other matching entities without redesigning the module.
* Approval transaction is atomic: category resolution must succeed before the suggestion is marked `APPROVED`; failures leave the suggestion `PENDING`.

#### Company Verification Management

* **Corporate Registration & Tax Verification Pipeline**: Review and audit employer registration submissions, legal tax identifiers (TIN, SEC/DTI registration number), uploaded regulatory documents, and corporate ownership profiles.
* **Instant 0ms Optimistic UI & Automatic Rollback**: Real-time optimistic status mutations (`VERIFIED`, `REJECTED`, `PENDING_VERIFICATION`, `SUSPENDED`) with automatic snapshot rollback and Sonner toast confirmations.
* **Fluid Framer Motion Transitions**: Staggered KPI metric cards with interactive hover lifts (`whileHover={{ y: -3 }}`), active filter ring indicators, animated table row entries and exits (`AnimatePresence` + `layout="position"`), and spring-animated status badges (`stiffness: 450, damping: 26`).
* **Multi-Tab Review Modal & Document Inspector**: Comprehensive audit drawer with expandable cover/logo media, dual-sided government ID previews, full regulatory document downloads, and preset rejection/correction workflows.

#### Admin Audit Trail

* **Immutable Forensic Audit Ledger**: Real-time logging of administrative interventions, authentication lifecycle events, user management changes, and platform data mutations persisted in device Philippine local time (UTC+8).
* **Context-Aware Dynamic Detail Modal**: Context-sensitive inspection modal adapting metadata attributes, icons, and labels dynamically based on Actor (`ADMIN`, `USER`, `SYSTEM`, `SERVICE`) and Target Entity (`COMPANY`, `JOB`, `USER`, `APPLICATION`), with State Diff inspection and dedicated security telemetry.
* **Timezone-Aligned Live KPI Metrics**: Live counting for Today's Audit Events, Failed Events, Denied Access attempts, and Admin Actions anchored on Asia/Manila day bounds.
* **7-Axis Multi-Parameter Filter Toolbar**: Filter and slice security logs by Category, Action, Status, Actor Type, Organization Type, Date From, and Date To with debounced keyword search and search clear (`X`).
* **Server-Side Pagination & Configurable Page Size**: Dynamic server-side pagination with standard page sizes (`10`, `20`, `30`, `40`, `50`), multi-page navigation controls, and total record counts.
* **Motion Transitions & Micro-Interactions**: Staggered container animations, card hover lift effects (`whileHover={{ y: -3 }}`), and spring-animated status badges (`AuditActionBadge`, `AuditStatusBadge`).

#### Multi-Repo Authentication & Cookie Session Isolation

* **Isolated Cookie Domain Scope (`vos_sync_access_token`)**: Renamed primary JWT authentication cookie to `vos_sync_access_token` across authentication handlers, middleware guards, API routes, layout checks, and WebSocket providers. Prevents cookie namespace collisions and session overwriting with other local VOS ERP repositories or Spring Boot services sharing the `localhost` domain.
* **Dual-Cookie Eviction on Logout**: Logout handlers proactively purge both active `vos_sync_access_token` and legacy `vos_sync_access_token` across path and hostname domains to ensure clean session termination.

#### Seamless Popup-Based Social Authentication & Account Linking

* **Zero Full-Page Reload Authentication**: Replaced disruptive top-level browser redirects and URL hash artifacts (`#_=_`) with centered, isolated OAuth popup windows for Google, LinkedIn, and Facebook across public login/signup (`SocialAuthButtons`) and settings account linking (`ConnectedAccountsCard`).
* **Origin-Verified Bridge Communication**: Uses a dedicated completion bridge (`/auth/popup-callback`) that transmits structured outcome payloads (`success`, `cancelled`, `error`, `notice`) back to `window.opener` via strict origin-validated `postMessage` before automatically self-closing.
* **Graceful Degradation & Dedicated Cancellation**: Automatically falls back to standard redirection when popups are blocked by browser security settings, and routes cancelled attempts to a dedicated cancellation screen (`/cancelled`) to prevent stranded states.

---


### Browse Companies

#### Searchable Filter Dropdowns & Real-Time Debounced Search

* Standard Optimistic UI Transaction Pattern (`useOptimisticMutation` & `AsyncActionButton`) with state snapshotting, instant client UI updates, async API requests, Sonner toast notifications, operational telemetry logging (`meta`), and automatic error rollback.
* `SearchableSelect` popovers for Industry, Company Size, Job Type, and Work Setup filters (`src/modules/public/company-profile/`).
* **Standardized Searchable Comboboxes & Trigger-Aligned Popovers**: System-wide rollout of searchable comboboxes (`SearchableSelect`) across VOS Admin, Client, Freelancer, School Admin, Job Browse, Course Builder, Main Dashboard, and Public Registration; enforced `min-w-[var(--radix-popover-trigger-width)] w-[var(--radix-popover-trigger-width)]` popover alignment to guarantee menus expand to full trigger width while keeping table pagination page sizes and short static controls (≤ 3 options) on standard native `<Select>`.

* Real-time debounced search (300ms) on search inputs — automatically updates search results as users type.
* High-fidelity skeleton card loading with 250ms minimum shimmer threshold across Find Jobs, Public Company Jobs, and Freelancer Jobs (`/vos-sync/freelancer/jobs`).
* `AnimatePresence` and Framer Motion staggered entrance card animations and hover lift effects (`whileHover={{ y: -4 }}`).
* **Freelancer Job Application Modal**: 4-step interactive application wizard with auto-prefilling, dynamic candidate profile photo asset resolution via Directus proxy with initials fallback, custom resume & cover letter uploads, and referral connectivity tracking.
* **Directus Server-Side Pagination**: Responsive infinite scroll with initial 24-job fetch, batch +12 appending on scroll, dynamic Directus `meta` filter count evaluations, and callback-ref intersection observers.


* Employee Reviews tab with total review count header badge and pagination controls.



### Client Dashboard (Employer Command Center)

#### High-Level Hiring Aggregation Layer

* Aggregated employer command center (`/client/dashboard`) answering *"What is happening and what should I do next?"* without duplicating full sidebar module functionality.
* 7 core functional sections: Personalized Header with Post a Job CTA, 4-card KPI summary grid, interactive Hiring Overview time-series chart (7d/30d/3m/6m), top 10 Job Performance table (prioritizing highest applicant volume then most recent post date), Recent Applicants with match score preview, upcoming interview timeline widget, and prioritized Action Required checklist.
* Fluid motion transitions and staggered entrance animations powered by Framer Motion.
* Soft Aurora Background atmosphere (`InteractiveGradientBackground` subtle mode) layered over `#F4F6FA` / `#0B1020` base with tab-visibility auto-pause and touch-device battery optimizations.
* Tiered frosted glassmorphism: atmospheric surfaces (`bg-card/70` backdrop-blur-xl) on KPIs & Greeting card, and data-dense high-contrast surfaces (`bg-card/90` backdrop-blur-md) on charts and tables.
* Live Dynamic Command Palette (`Ctrl/⌘+K`): Instant search over live company jobs (`/api/client/jobs`), applied candidates (`/api/client/applicants`), and freelancer talent pool (`/api/shared/users/search`), paired with recent searches and quick actions.
* Optimistic UI interactions for dismissing and resolving urgent action items.
* **Streamlined Command Center & Decluttered Layout**: Eliminated redundant static onboarding cards in favor of real-time KPI metrics, header primary actions (+ Post a Job), and dynamic, context-aware Action Required alerts that adapt to actual database state.
* Full theme token compliance with zero hardcoded color values.

---

### Client Notification Center

#### Streamlined Alert Center, Real-Time Search & Multi-Category Filtering
* **Interactive Search & Multi-Category Toolbar**: Real-time search across candidate names, job titles, and alert messages paired with scrollable category filter pills (**All**, **Applications**, **Interviews**, **Messages**, **Team Activity**) with dynamic live count badges.
* **Unread State Filter**: Combinable "Unread only" toggle pill allowing recruiters to filter by unread status independently or across any category.
* **Actor Suppression & Team Activity**: Strict `actor_user_id !== recipient_user_id` governance suppressing self-notifications on recruiter actions (shortlisting, rejecting, hiring, scheduling) while dispatching `TEAM_ACTIVITY` exclusively to other hiring team members.
* **Chronological Date Grouping**: Organizes notifications dynamically into clear time sections (**Today**, **Yesterday**, **This Week**, **Earlier**).
* **Contextual Event Badges**: Category-specific color-coded icons (Applications, Shortlisting, Withdrawals, Interviews, Messages, Job Approvals) for rapid visual scanning.
* **Full-Card Click Target & Quick Actions**: Entire card functions as an interactive navigation target with subtle unread background tints, trailing chevron indicators, and an on-hover quick mark-as-read trigger.
* **Granular Preference Management**: Dual-channel control (Email & In-App) per notification category group with master toggles and real-time persistence.

---

### Client Company Profile

#### Comprehensive Employer Organization, AI Assistant & Verification Management

* **Dynamic Organization Profile Management**: Full editing suite for company basic info, classification, addresses, public visibility toggles, and real-time public profile preview slide-over.
* **AI Company Profile Assistant & 3-Tier Ownership Model**: Strict architectural separation of Authoritative data (manual/verification-gated identity, contact, registration) vs. AI-Assisted editorial content (Description, Mission, Vision, Culture, Benefits, Tags, and suggested Industry/Org Type). Propose $\rightarrow$ Review $\rightarrow$ Accept workflow with side-by-side diffs and confidence-scored taxonomy suggestions.
* **In-Editor Inline AI Field Polish**: Contextual AI assistant dropdowns on Description, Mission, Vision, Culture, Benefits, and Tags (`✨ AI Assist` — Polish, Make Candidate-Focused, More Professional, Shorten, Regenerate, Custom Prompt) powered by `/api/client/company-profile/refine-text`.
* **Fast & Snappy Motion Animations**: Powered by `framer-motion` and `AnimatePresence` with non-disruptive, lightweight transitions (150ms–250ms), staggered card entrances, and smooth edit-to-view mode morphing.
* **Actionable Profile Completion Meter**: Real-time animated progress bar reflecting profile completeness towards verification readiness with dynamic actionable guidance indicating remaining incomplete sections (Classification, Social Links, Address, Media, TIN).
* **Typography, Contrast & Layout Refinement**: Eliminated redundant card subheadings, increased uppercase field label contrast (`text-xs font-semibold text-muted-foreground`), streamlined social links into frosted pill badges with icons, and differentiated document action visual hierarchy (subtle ghost "View" link action alongside secondary outline "Replace" trigger).
* **Frosted Glass Card Surfaces & Sticky Right Rail Layout**: Upgraded card surfaces to `rounded-2xl border border-primary/10 bg-card/80 backdrop-blur-xl shadow-sm hover:border-primary/20` and unified card headers with semantic `bg-muted/30 border-b border-border/60`; implemented a sticky right rail (`lg:sticky lg:top-24`) keeping completion meter, verification status, documents, and submit controls in view while scrolling long organization details.
* **Unified Semantic Color System**: Replaced inconsistent palette classes (`zinc`, `emerald`, `amber`, custom hex) with platform semantic tokens (`bg-gradient-to-r from-primary to-info`, `success` for verification states, `destructive` for alerts) across all profile cards, form inputs, inline AI polish modals, and verification cards.
* **Interactive Document Verification Pipeline**: Multi-slot verification upload zone (DTI/SEC, Business Permit, TIN, and optional supporting documents) featuring a spacious row-based architecture (header row with title and action buttons, dedicated full-width file preview row), animated item additions, removals, and contextual status banners.
* **Company Verification Guard Resilience & Session Persistence**: Integrated `sessionStorage` caching (`vos_client_company_verification`), exponential backoff retries on transient network and server spikes, and separated error states with a retry trigger to prevent false unverified lockout screens on browser page refresh.

---

### Client Configuration & Settings

#### Account Profile & Security Settings Layout Optimization
* **Balanced Account Profile Layout**: Constrained the account profile configuration form to a standard balanced container (`max-w-4xl`), eliminating excessive horizontal input stretching on wide viewports.
* **Proportional Grid Hierarchy**: Reorganized identity fields into a compact 6-column responsive grid (First Name, Middle Name, Last Name alongside appropriately sized Nickname and Suffix fields), balanced 2-column contact details with aligned position inputs, and clean 3-column groupings for address and personal details.
* **Two-Column Security & Auth Architecture**: Restructured the Security & Auth tab into a responsive two-column grid pairing password management (left) with connected social accounts and OAuth providers (right).
* **Next.js Image Optimization**: Migrated avatar rendering to standard `<Image />` component with `unoptimized` asset handling and initials fallback.

---

### Jobs Posting

#### Database-Backed Role Taxonomy Integration & Canonical Categories
* **Single Source of Truth (`vs_role_category`)**: Decoupled 3-tier taxonomy (`Category` $\rightarrow$ `Role` $\rightarrow$ `Skills`) sourcing canonical role families directly from Directus database table `vs_role_category` via dedicated client endpoints and cached custom hook (`useRoleCategories`).
* **Auto Create Job with AI**: Natural-language prompt-driven job generation (`AutoCreateJobModal`) leveraging company profiles, addresses, industries, and taxonomy matching to structure rich-text descriptions, responsibilities, qualifications, and extracted skills. Enforces strict salary guardrails (zero fabricated salaries) and unifies review in the standard 5-step job creation wizard.
* **In-Editor AI Text Refinements**: Integrated AI action bar in `RichTextEditor` (`✨ Improve`, `✂ Make Concise`, `⚙ More Technical`, `🔄 Regenerate`, and custom instructions) powered by `/api/client/jobs/refine-text` for real-time section-level polish.
* **Searchable Category Combobox & Controlled Suggestions**: In-form searchable combobox with real-time text matching, candidate descriptions, and an integrated category suggestion modal (`SuggestCategoryModal`) featuring AI semantic deduplication pre-checks to protect taxonomy integrity while preventing employer posting friction.
* **Configurable ATS Hiring Pipeline & Versioned Job Snapshots**: Decoupled company hiring pipeline templates (`vs_company_pipelines`) from per-job versioned workflow snapshots (`vs_job_pipeline_versions`, `vs_job_pipeline_stages`, `vs_job_pipeline_transitions`). Jobs maintain their own isolated snapshots upon creation. Changes to company defaults do not mutate existing jobs. Enhanced template re-synchronization (`snapshotCompanyPipeline`) to safely map stage IDs, copy explicit progression rules, seed linear transitions if needed, and hydrate stages with `allowed_next_stage_ids` so candidates always maintain valid pathways to Hired. Scoped pipeline customization strictly to job editing mode (`JobForm`), keeping the Hiring Pipeline Workflow in `JobDetailSheet` purely as an inspection-only read-only preview.
* **Security Hardening, Multi-Tenant IDOR Mitigation & Data Privacy**: All job management and pipeline endpoints (including `DELETE` and `PATCH /api/client/jobs/[id]` as well as all 11 pipeline endpoints) use canonical `authenticateRequest` cryptographic JWT verification (`jose.jwtVerify`) with account status checks. Enforces strict tenant ownership verification on job modification and deletion, pipeline templates (`updateCompanyPipeline` & `PATCH /api/client/pipelines/[id]`), candidate inspection (`GET /api/client/applicants/[id]`), candidate stage mutations (`PATCH /api/client/applicants/[id]`), and AI candidate evaluation (`GET/POST /api/client/applicants/[id]/ai-analysis`) via `job.company_id === companyId` checks to prevent BOLA/IDOR attacks across organizations. Redacts confidential employer transition evaluations (`client_notes`) from candidate-facing application endpoints to protect hiring privacy, sanitizes dynamic stage names interpolated into notifications, and routes candidate status mutations strictly through `transitionApplicationStage` to preserve transition route integrity while syncing freelancer withdrawals with `WITHDRAWN` audit history.
* **Philippine Local-Time (UTC+8) Database Audit Timestamps**: All pipeline configurations, stage transitions, version snapshots, and audit trail logs strictly persist in device Philippine local time (`getPHTimeString()`) without UTC discrepancies.
* **Authoritative Fail-Closed Backend Immutability Locking & Stage Pinning**: Strict backend gate enforcing workflow immutability once candidate applications exist (`application_count > 0`), rejecting mutations (stage creation, deletion, reordering, renaming, transitions, and resets) with HTTP 409 Conflict with fail-closed error handling. Permanently pins `APPLIED` to position 1 across drag-and-drop and arrow ordering controls, preventing pipeline inversion.
* **Canonical Semantic Types, Intermediate Custom Stage Enforcements & Universal Exits**: Powered by 8 stable semantic types with custom stage creation strictly restricted to intermediate evaluation categories (`SCREENING`, `ASSESSMENT`, `INTERVIEW`, `OFFER`) to protect candidate entry and exit state machines. `REJECTED` and `WITHDRAWN` serve as universal exits, and terminal states prohibit outgoing transitions.
* **Refined Deletion Crack Animation**: Isolated card splitting and fracture physics to the dynamic card element in pipeline settings, eliminating stationary red container artifacts during deletion.
* **Automated Candidate Stage Binding & History**: Automatic server-side assignment of candidate submissions to the job's active `APPLIED` stage and immutable logging into `vs_application_stage_history` (`from_stage_id = null`, `to_stage_id = APPLIED`).
* **Non-Destructive Legacy Bootstrap**: On-demand snapshot creation and deterministic mapping for legacy jobs and existing applications based on legacy statuses.
* **Referential Integrity**: Jobs maintain explicit foreign key mapping `category_id` $\rightarrow$ `vs_role_category(category_id)` alongside backwards-compatible legacy fallback resolution.
* **Unified Search, Multi-Filter Toolbar & ATS Workflow**: Real-time client-side search across Job Title, Department, and Location, paired with a searchable Category combobox, Employment Type selector, Work Arrangement filter, and Status filter.
* **Interactive Job Cards & Context-Aware Primary Actions**: Full card click-to-preview with a 2-second hover tooltip, dynamic status-aware right-side actions ("Make Active" for `DRAFT`, "Reopen" and candidate review for `CLOSED`, and "View Applicants" with live candidate count badge for `ACTIVE`), alongside centralized job editing and live status controls inside the preview drawer.
* **Framer Motion Animations**: Staggered card entrance transitions, smooth list reordering (`AnimatePresence` + `layout="position"`), and responsive hover lift states.
* **Company Verification Guard & Session Resilience**: Guaranteed verified employer access to Job Postings with automatic retry handling and session caching across page refreshes, paired with clean import bundling under Next.js Turbopack to prevent runtime Temporal Dead Zone exceptions.

#### Rule-Based Skill Intelligence

* Reusable global skill-matching engine.
* Exact, alias, technology-relation, hierarchy, and category-based matching.
### Applicant Management & Candidate Review

* **Dynamic ATS Pipeline Workflow & Stage Transitions**: Workflow authority shifted from hardcoded status enums to the active job's snapshot pipeline (`current_stage_id` $\rightarrow$ `vs_job_pipeline_stages`). Candidates display configured presentation stage names, assigned theme colors (`sky`, `emerald`, `amber`, etc.), and allowed next stages derived directly from the job's transition graph.
* **Dual-Mode Stage Filtering (Cross-Job vs Job-Specific View)**:
  * **All Jobs View**: When no specific job is selected, candidates are grouped across the 8 canonical semantic stage types (`Applied`, `Screening`, `Assessment`, `Interview`, `Offer`, `Hired`, `Rejected`, `Withdrawn`) plus `All Candidates` and non-terminal `Active Pipeline` (`stage_type !== HIRED/REJECTED/WITHDRAWN`).
  * **Job-Specific View**: When a specific job is selected, the filter toolbar dynamically displays the actual custom stages configured for that job's active pipeline snapshot (`STAGE_<id>`) with employer-defined names and color tokens.
* **Pipeline-Governed Candidate Cards & Actions**: Transition dropdowns in `ApplicantCard` and `StatusUpdateDrawer` render strictly from `applicant.allowed_next_stages` without hardcoded legacy branching. Interview scheduling actions are canonically gated by `stage_type === "INTERVIEW" || stage_type === "ASSESSMENT"`.
* **Universal "Update Stage" Action**: In `ApplicantDetailsModal`, "Update Status" is replaced with "Update Stage", available for every non-terminal candidate regardless of intermediate stage type.
* **Read-Only Candidate Profile Inspection**: Strictly eliminated auto-mutation on candidate inspection (`GET /api/client/applicants/[id]`); opening or reviewing a candidate profile is 100% read-only and performs zero database writes or stage changes.
* **Authoritative Transition Validation & Canonical Synchronization**: Dedicated endpoint (`PATCH /api/client/applicants/[id]/stage`) and service verifying transition routes against configured graphs and universal exits (`REJECTED`, `WITHDRAWN`), strictly blocking movement out of terminal stages, atomically synchronizing canonical database status enums, and logging immutable audit records to `vs_application_stage_history`.
* **Optimistic UI & Fluid Motion Quick Actions**: Instantaneous candidate stage updates with automatic rollback resilience on server error, toast notifications, spring-animated status badges, and smooth layout reordering powered by `framer-motion` `<AnimatePresence mode="popLayout">`.
* **AI Candidate-Job Evaluation & Company Cross-Role Opportunity Match**: Structured candidate profile evaluations matching against job qualifications with cross-role recommendations across other active company openings; persistent append-only evaluation records in `vs_application_ai_analysis` with immutable history and 3-state semantic CTAs (`Generate AI Analysis`, `View AI Analysis`, `Regenerate`).
* **Comprehensive Candidate Review Modal**: Responsive dual-column layout separating high-level profile overview, contact information, metrics, screening Q&A, and compensation from deep candidate history (experience timeline, education, certifications, and document attachments).
* **Screening Questions & Responses**: Complete question-by-question candidate response display with individual unanswered indicators and a dedicated `"No screening answers submitted"` fallback state.
* **Dynamic Candidate Avatars**: High-fidelity candidate profile pictures with Directus asset proxying, safe URL fallbacks, smooth `<Image />` loading, and initials badges.
* **Inline Document Previews**: Interactive single-click document preview modal for Cover Letters and Resumes with full PDF/document viewer support and direct download links.
* **Portfolio Website Integration**: Direct link display for candidate portfolio websites across Contact Information, Compensation & Portfolio, and Social Links with automatic profile fallback resolution.

---

### Configurable ATS Hiring Pipeline (Foundation & Workflow Settings)

* **Decoupled Workflow & Stable Semantic Taxonomy**: Configurable presentation workflow layer operating over 8 stable canonical stage types (`APPLIED`, `SCREENING`, `ASSESSMENT`, `INTERVIEW`, `OFFER`, `HIRED`, `REJECTED`, `WITHDRAWN`), preserving deterministic AI matching, analytics, and notification behavior while allowing custom hiring nomenclature.
* **Flexible Template Selection & Real-Time Preview during Job Creation**: In the screening step of the job creation wizard, employers can toggle between the Company Default pipeline or choose any saved pipeline template via a searchable combobox dropdown (`SearchableSelect`), with real-time sequence preview pills reflecting the exact stages that will be snapshotted upon posting.
* **Automated Company Pipeline Provisioning**: Automatic seeding of default company hiring templates with canonical stages, semantic visual tokens, and verified initial transition routes.
* **Deterministic Transition & Terminal Integrity**: Server-enforced transition validation preventing illegal moves, self-loops, and cross-pipeline leakage. System terminal outcomes (`REJECTED`, `WITHDRAWN`) remain universally accessible from any non-terminal stage without manual graph clutter.
* **Explicit Progression Reachability & Unconnected Stage Warnings**: Visual distinction between stage existence and stage reachability across Settings and Job Posting views; highlights non-terminal stages lacking configured forward routes with clear progression alerts (`⚠ No progression stages configured`, `Candidates cannot reach Hired from this stage`) alongside automatic terminal exit indicators (`✓ Rejected`, `✓ Withdrawn`).
* **Interactive ATS Pipeline Settings Suite**: Dedicated Employer Settings tab (`Settings → ATS Pipeline`) enabling recruiters to create custom workflow templates, add and rename stages, assign color themes, reorder sequence numbers, and configure available transition pathways.
* **Freelancer Stage Assessment Submission & Proof File Synchronization**: Resolved submission and draft persistence blocking on stage assessment tasks; included `FILE_UPLOAD` tasks in draft payload compilation (`buildDraftEntries`), synchronized active attempt status (`IN_PROGRESS`) and attempt metadata back to the client upon proof file upload, updated `AssessmentStatusBanner` to dynamically reflect progress, and ensured both "Save draft" and "Submit assessment" validate and complete without false "nothing to save" or "complete at least one task" errors.
* **Client Assessment Move Confirmation & Terminal Pass Progression**: Resolved candidate stage progression locking when moving out of an assessment stage with an already `PASSED` attempt: allowed `PASSED` status in `canPass` and `checkAssessmentGate()`, enabled the "Pass & Move" action, disabled conflicting state mutations (`Fail` and `Request revision`) against terminal passed attempts to prevent `conflicting review repeat: PASSED vs NEEDS_REVISION` errors, and provided clear contextual status guidance in `AssessmentMoveConfirmModal`.
* **One-Click Default Template Assignment**: Recruiters can designate any customized pipeline template as their company-wide default via an integrated "Make Default" action in the template summary card, ensuring new jobs automatically inherit the chosen workflow.

---

### Campus Talent & Academic Candidate Matching

* **Institutional Discovery & Partner Network**: Search and browse verified partner educational institutions with institutional profile views, degree course listings, and academic student rosters.
* **Deterministic Sequential 5-Stage Matching Pipeline**: Calibrated multi-step loading experience that sequentially executes all 5 evaluation stages (*Running campus match pipeline...* $\rightarrow$ *Extracting job requirement taxonomies...* $\rightarrow$ *Evaluating university curriculum alignment...* $\rightarrow$ *Scoring candidates and generating AI insights...* $\rightarrow$ *Finalizing candidate ranking...*) to 100% completion before revealing scored candidate results; features compositor-friendly `scaleX` spring animations, isolated leaf percentage rendering, and network-aware Stage 5 pacing (holding smoothly at 94% on slow responses and immediately gliding to 100% on completion).
* **Cryptographic Security, Tenant IDOR Mitigation & Open Relay Protection**: All Campus Talent API endpoints enforce cryptographic JWT signature validation (`jose.jwtVerify`) with account state checks; eliminates open mail relay by authoritatively resolving student recipients from Directus database records; verifies employer ownership on linked jobs (`company_id === companyId`); masks sensitive institutional student numbers (`***1234`) for academic privacy; and HTML-escapes all email inputs.
* **Academic Evidence, Technical & Soft Skills Classification**: Deep candidate inspection drawer highlighting structured **Technical Skills & Domain Proficiencies** alongside **Soft Skills & Core Competencies** (with verified profile and academic curriculum provenance badges), verified GPA, strengths, and gap analysis with direct invitation workflows; includes compact skills preview pills directly in the student roster table view.

---

### Client Talent Search

* **Direct Talent Discovery & Outreach**: Searchable freelancer profile database with multi-dimensional filtering, profile inspection slide-over drawers, and direct talent bookmarking (`useSavedTalent`).
* **Candidate Name & Academic Institution Search**: Multi-field search intelligence matching candidate full names, tokens, and typos alongside Philippine university names, dynamic acronyms (e.g. DLSU, UST, UP, PUP, ADMU), and degrees in candidate retrieval and relevance ranking.
* **Fluid Framer Motion Transitions & State Transitions**: Replaced static views with smooth `<AnimatePresence mode="wait">` transitions between initial search guidance, loading skeletons, empty states, and results; orchestrated candidate cards with staggered fade-in animations and micro-hover elevations (`whileHover={{ y: -3 }}`).
* **Collapsible Accordion Filter Controls & Skill Chip Animations**: Replaced abrupt filter toggles with height-animated accordion sections, rotating chevron indicators (`animate={{ rotate: open ? 180 : 0 }}`), and layout-animated skill chip tags (`<AnimatePresence>` + `<motion.span layout>`).
* **Interactive Bookmark Actions & List Collapse**: Animated saved talent list (`<AnimatePresence mode="popLayout">` with `motion.div layout="position"`), enabling seamless row collapse upon unbookmarking, accompanied by responsive tap micro-interactions (`whileTap={{ scale: 0.95 }}`).
* **Semantic Design Token Modernization**: Upgraded the entire module from hardcoded palette classes to semantic Tailwind/Radix tokens (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `primary`, `destructive`), ensuring harmonious dark and light theme adaptability.
* **Interactive Send Invitation Dialog**: Modal outreach flow with personalized message drafts and dynamic, scrollable company job linking allowing employers to invite candidate to specific active openings or send general interest invitations.
* **Security Hardening, Cryptographic Auth & Multi-Tenant IDOR Mitigation**: All 6 Talent Search API endpoints enforce canonical `authenticateRequest` cryptographic JWT signature verification (`jose.jwtVerify`) and active account state validation (`canAuthenticate`). Patches Broken Object Level Authorization (IDOR) on match scoring queries (`jobIdForMatch`) and invitation endpoints (`job_id`) by strictly validating tenant ownership (`job.company_id === companyId`).
* **Candidate PII Protection & Anti-Scraping**: Masked contact PII (emails and phone numbers formatted as `j***@gmail.com`) in public search result lists and candidate detail profiles, preventing automated scraping while preserving recruiter identity matching.
* **Email Template Injection & XSS Fortification**: Dynamic variables interpolated into candidate invitation emails (`candidateName`, `companyName`, `jobTitle`, `jobDescription`, `message`, etc.) are sanitized with HTML entity escaping (`escapeHtml()`) and URL encoding (`encodeURI`), neutralizing stored email XSS vectors.
* **AI Explainer Prompt Hardening & Length Constraints**: Strict payload bounds on search keywords (max 120 chars) and candidate fields on `/api/client/talent-search/explain` to mitigate prompt injection, Denial-of-Wallet, and API abuse.
* **Philippine Local-Time (UTC+8) Saved Talent Timestamps**: Persists bookmark and candidate saving operations with authoritative device local time (`getPHTimeString()`).
* **Strict Contextual ATS Action Workflow**: Contextual status transitions (`APPLIED` $\rightarrow$ `UNDER_REVIEW` [manual recruiter review or stage progression], `UNDER_REVIEW` $\rightarrow$ `SHORTLISTED`/`REJECTED`, `SHORTLISTED` $\rightarrow$ `INTERVIEWING` [system-driven on interview creation], `INTERVIEWING` $\rightarrow$ `HIRED`/`REJECTED` [system-driven on final evaluation]), contextual action gates (`Schedule Interview`, `View Interview`), and decoupled recruitment vs session lifecycle management.

### Best Match AI

* Deterministic candidate ranking using weighted factors:

  * Skills — 40%
  * Experience — 25%
  * Location — 15%
  * Education — 10%
  * Screening — 10%
* Gemini-generated recruiter explanations, strengths, and development areas.
* Session-based analysis caching per job.
* Automatic cache invalidation when applicant or job data changes.
* Duplicate-request protection and progressive AI analysis states.

### Interview Management

* Interactive monthly calendar and list views.
* Native browser fullscreen recruiter workflow.
* Scheduling, rescheduling, cancellation, feedback, screening Q&A, and evaluation directly from the calendar.
* Single-candidate and batch-candidate interviews.
* Candidate-specific attendance, feedback, and decision tracking.
* Custom date and time selection interface.
* Optional 15-minute scheduling buffer toggle between interviews with real-time overlap validation.
* Intelligent next-available time suggestions on conflicts and visual distinction for buffer periods.
* Server-side overlap validation with `409 Conflict` protection.
* Real-time availability indicators and conflict detection.
* Candidate-aware calendar labels and detailed schedule popovers.
* Smart calendar cell event overflow handling with interactive date click and day agenda modal: clicking any calendar date number or overflow badge opens a comprehensive day modal with full interview cards or an empty state with a `"Schedule Interview on this Date"` shortcut, featuring dynamic fullscreen-aware backdrop portaling that blurs the entire viewport in standard mode and remains contained in native fullscreen mode.
* Robust interview evaluation persistence with single-consumption stream handling, eliminating body re-read exceptions during feedback submission.
* **Frosted Glass Workspace Header & Design System Modernization**: Upgraded the Interview & Batch Screening Workspace header into a translucent frosted glass card (`bg-card/70 backdrop-blur-xl border border-primary/10 shadow-lg shadow-primary/5`) with primary ambient glow, semantic icon badge, and VoSync primary action gradient pill button ("+ Schedule Interview") ensuring seamless light and dark mode integration.
* **Dynamic ATS Pipeline Stage Progression in Interview Evaluation**: Candidate evaluation and attendance modals (standard dialog and fullscreen view) adapt dynamically to the job's ATS pipeline configuration. Evaluators can keep candidates in their current stage, advance them to allowed next pipeline stages with visual stage chips, or reject them, executing canonical stage transitions via `transitionApplicationStage()` while persisting feedback and attendance.
* Strict attendee eligibility gate: only `SHORTLISTED` (first round) and `INTERVIEWING` (additional rounds) candidates appear in the scheduling form, with active session deduplication preventing new bookings while an intermediate interview remains uncompleted.
* Decoupled recruitment lifecycle: interview scheduling, rescheduling, cancellation, and intermediate completion do not mutate `application_status` (maintains `INTERVIEWING`), keeping candidates eligible for subsequent rounds without state conflation or status drift.
* Read-only evaluation locking for completed or cancelled interviews.
* Strict company-scoped scheduling isolation.
* **Client Messaging Workspace & Action CTA Support**: Centered messaging layout with zero full-list reloads on send and responsive empty states supporting optional call-to-action routing links (`EmptyState.tsx`) conforming to VoSync empty-state guidelines.

---

## Campus Talent Discovery & AI Matching

Company recruiters can discover academic candidates from verified schools and run AI-powered match analysis against active job postings without requiring students to have registered profiles.

* **School Discovery & Metrics**: Search verified schools by name, city, or province with live student and course counts, institution category filters, and network overview metrics (partner institutions, verified student network, degree programs).
* **Full-Width School Profile Header & Sticky Underline Tab Navigation**: Selecting a partner institution opens an edge-to-edge School Profile modeled after the Company Profile architecture (`CompanyHeader` + `CompanyTabNav`) with full-bleed cover banner, overlapping avatar (`-mt-14 sm:-mt-18`), verified badges, action controls, and sticky full-width underline tab navigation (**About**, **Courses**, **Student Roster & AI Match**) leading into centered `max-w-7xl` content panels with fluid Framer Motion transitions.
* **Fixed-Layout Roster Table & Fluid Tab Motion**: Enforces `table-fixed` column distribution (`<colgroup>`) to prevent column snapping when switching status filter tabs or displaying empty categories, paired with smooth Framer Motion layout and row transitions.
* **Student Roster, Pagination & Verification View**: Loads all roster students from `vs_school_student`, mapping course degree programs with client-side pagination (10, 25, 50 rows per page), count indicators, and previous/next page controls. Features an enhanced search toolbar with quick clear, status pills, and GPA statistics.
* **Context-Aware Candidate Drawer**: Differentiates between Academic Roster Profile mode (clean credentials, contact details, curriculum mapping, and outreach workflows) and AI Job Match Evaluation mode (deterministic scoring, Gemini explainability, and gap analysis).
* **Progressive Match Pipeline**: Deterministic evaluation runs first — eligibility (hard REQUIRED constraints), score (0–100), and structured evidence. Gemini only explains the deterministic output; it cannot modify scores or invent new gaps.
* **Match Model Selection**: `ACADEMIC` (roster-only, weights: course 45% / year 25% / curriculum 20% / GPA 10%) vs `HYBRID` (registered profile, weights: skills 35% / experience 25% / education 20% / responsibilities 15% / GPA 5%).
* **GapStatus Distinction**: `NOT_EVIDENCED` (data unavailable — absence is not confirmation of missing qualification) vs `NOT_MATCHED` (evidence present but insufficient) vs `REQUIREMENT_FAILED` (hard eligibility block).
* **Transactional-Safe Invitations**: 2-step email pattern — invitation record created as `PENDING` first; `sendMail()` attempted as a side effect; record updated to `SENT` or `FAILED`; `vs_school_student.invitation_status` only updated to `Invited` after confirmed `SENT`.

---

## Talent Search

### Intelligent Candidate Matching

VOS Sync uses a modular multi-stage matching architecture combining deterministic algorithms, database-backed taxonomies, and optional Gemini AI.

```text
Recruiter Query
      ↓
Text Normalization
      ↓
Optional AI Query Understanding
      ↓
Database Taxonomy Resolution
      ↓
High-Recall Fuzzy Retrieval
      ↓
Deterministic Compatibility Scoring
      ↓
Internal Candidate Ranking
      ↓
Optional AI Reranking
      ↓
Optional Match Explanation
      ↓
Paginated Results
```

### Database-Backed Role Taxonomy

* Canonical job roles and categories.
* Job title aliases and weighted relationships.
* Skill mappings linked to master skills.
* Runtime alias expansion through Directus.
* Supports natural-language and non-exact job searches.

For example, a search for **"social media creator"** can resolve to related canonical roles such as **Social Media Specialist**, **Social Media Strategist**, and **Content Creator**.

### Matching Modes

* `BROWSE` — Candidate discovery without misleading match percentages.
* `ROLE_SIMILARITY` — Role and title similarity.
* `SKILL_MATCH` — Targeted skill evaluation.
* `JOB_MATCH` — Full job requirement matching.
* `HYBRID` — Combined keyword, role, taxonomy, and skill matching.
* `AI_RERANK` — Semantic AI-based reranking.

### Two-Layer Matching Engine

**Layer 1 — Retrieval**

* Jaro-Winkler similarity.
* Levenshtein distance.
* Token intersection.
* Compound-word splitting.
* Taxonomy and alias expansion.

**Layer 2 — Compatibility**

* Role.
* Experience.
* Skills.
* Education.
* Certifications.
* Availability.
* Location.
* Portfolio.

Retrieval scores remain internal. Recruiters see compatibility-based results rather than raw fuzzy-search scores.

### AI Controls

* Query-result caching.
* Confidence thresholds.
* Deterministic bypass for straightforward searches.
* Bounded AI reranking.
* Structured-output validation.
* Model fallback.
* Concurrent-request deduplication.
* Graceful fallback when Gemini is unavailable.

---

## Company Profile & Registration

* Interactive company logo and cover-image previews with lightbox viewing.
* Searchable government ID type selection.
* Support for additional ID types through an `Others` option.
* Optional back-side ID upload.
* Role-aware registration routing using URL parameters.
* Cloudflare Turnstile protection with server-side verification.
* Private company verification document management.
* Support for:

  * DTI/SEC Registration
  * Business Permit
  * TIN Documents
  * Other Supporting Documents
* Transactional document replacement and deletion.
* UTC database timestamps with Philippine local-time presentation.
* Verification status remains administrator-controlled and independent of document uploads.

## Authentication & Identity Security

* **Google, LinkedIn & Facebook Social Sign-In**: Extensible `SocialAuthButtons` integration on Login (`/login`) and Signup (`/signup`) with OpenID Connect and OAuth 2.0 identity verification across Google, LinkedIn, and Facebook (Meta Graph API v20.0).
* **Cryptographic Claim & Profile Verification**: Validates OIDC ID tokens and Meta profile endpoints, extracting standardized profile claims (`sub`/`id`, `name`, `first_name`/`given_name`, `last_name`/`family_name`, `picture`, `email`) and validating client tokens server-side.
* **Strict Subject Anchor & Diagnostic Email Lookups on Social Login**: On `/login`, Continue with Google, Facebook, and LinkedIn authenticate strictly via the provider's permanent subject/user identifier (`sub`/`id`) in `vs_user_identity`. Email lookups in `vs_user` never automatically authenticate during login; instead, an unlinked provider identity matching an existing account is rejected with guidance to use original credentials and link via Settings, unlinked identities without an account are rejected with guidance to sign up, and cross-account identity conflicts are hard-blocked with security audit logging.
* **Seamless Auto-Registration, Editable Prefill & Immediate Identity Linking**: When a new user signs up with Google, LinkedIn, or Facebook (`/signup`), verified profile claims (first name, last name, email, avatar) are encrypted into short-lived JWE cookies (`vos_sync_google_reg`, `vos_sync_linkedin_reg`, `vos_sync_facebook_reg`). Prefilled form fields remain completely editable. Upon completing registration verification, the federated identity is automatically persisted to `vs_user_identity` in Philippine time so the account is immediately connected without manual linking.
* **Explicit Account Ownership Confirmation & Conflict Prevention**: When linking social providers in Security & Auth, identities already tied to another user are hard-blocked. Cross-account collisions trigger explicit confirmation dialogs backed by encrypted, short-lived pending link tokens (`A256GCM`) with single-use atomic replay protection before persisting to `vs_user_identity`.
* **OAuth Replay & CSRF Defense**: Employs independent `state` and `nonce` parameters with single-use atomic consumption tracking to prevent replay attacks across Google, LinkedIn, and Facebook OAuth flows.
* **Canonical Meta Graph & LinkedIn OAuth Flows**: Aligns Facebook and LinkedIn authentication with official server-side authorization code standards for confidential clients (`FACEBOOK_SECRET`, `FACEBOOK_ID`, `FACEBOOK_TOKEN` app client token), providing resilient error diagnostics.
* **Connected Accounts & Multi-Provider Linking (Security & Auth)**: Users can link and unlink Google, LinkedIn, and Facebook identities from Client and Freelancer Security settings via the relational `vs_user_identity` collection with session revalidation, subject conflict prevention, and strict server-side lockout prevention requiring an active password before disconnecting.
* **Proxy Origin Preservation & Dynamic Cookie Transport**: Resolves public client-facing origins (`resolveRequestOrigin`) across reverse proxies and Tailscale configurations, eliminating redirect leakage to internal listener ports and matching cookie security flags to transport protocol.
* **Environment-Driven OAuth Origin Allowlist**: Validates OAuth redirect URIs dynamically against the centralized `ALLOWED_ORIGINS` environment configuration, enabling secure cross-origin handling without premature build-time evaluation errors.
* **Dedicated Authentication & OAuth Cancellation Experience (`/cancelled`)**: Dedicated public route replacing generic redirects on user-cancelled authentication, account linking, or sign-up flows across Google, Facebook, and LinkedIn. Features context-aware messaging, automatic `#_=_` hash stripping, security reassurance banners, and smart return pathways ("Try Again", "Return to Settings", "Go to Dashboard").

---

## Role-Aware Public Experience

VOS Sync dynamically adapts public pages and CTAs based on authentication state and user role.

Supported experiences include:

* Job Seeker portal navigation.
* Employer/client management navigation.
* Guest registration and onboarding.
* Role-aware Contact Us, About Us, Career Advice, and Landing page CTAs.
* Smart role navigation with mismatch confirmation.
* Automatic routing for users already authenticated under the requested role.

---

## Job Browse

* **Standardized Job Card Layout**: Uniform equal-height grid cards with Next.js `<Image />` company avatars, clean single-line title truncation, structured metadata chips with location truncation, and bounded skills pills.
* **Persistent Bottom Actions**: Pinned card footer displaying salary, quick-bookmark toggle, and view job details action across all card rows.
* **Directus Server-Side Pagination & Infinite Scroll**: Initial server-side query fetching 24 jobs with debounced search and filters sent directly to Directus, and preloading scroll observer loading +12 job batches on scroll with total count metadata.
* Public company profile links from job cards and job details.
* Company logo and name navigation.
* Opens company profiles in a separate browser tab.

---

## Applicant & Talent Management

### Review Candidates (Applicant Management)

* **AI Candidate-Job Evaluation & Cross-Role Matching**: On-demand AI evaluation modal in Candidate Details powered by Google Gemini analyzing candidate skills, work history, education, certifications, and screening answers against target job requirements with match scores, key strengths, probing questions, recruiter recommendations, and cross-role opportunity scans across all active company job openings.
* **Instant Client-Side Cache & Regenerate**: Stores AI evaluations in `localStorage` for instant reopening with a dynamic CTA ("Check AI Analysis" / "View AI Analysis") and an on-demand "Regenerate" trigger.
* **Two-Row Metadata Stacking**: Structured card information with primary identifiers (Name, Email, Job Title) on the top row and softer muted secondary stats (experience, jobs, resumes, profile %, applied date) beneath.
* **Uniform Status Badge Column**: Status badges anchored to a dedicated vertical column immediately before the action button group.
* **Explicit Action Controls**: Visual hierarchy with ghost "View Candidate", outline "Message", and solid primary "Schedule Interview" buttons.
* **Cleaned 3-Dots Quick Actions**: Reserved exclusively for secondary administrative transitions (*Move to Under Review*, *Shortlist*, *Mark as Hired*, *Reject*, *Reopen*) and *Custom Status & Notes...* without action duplication.
* **Interactive Status Filter Badges with Popovers**: Positioned directly on top of the candidate search bar with hover popover tooltips explaining each stage, real-time candidate counts, and defaulting to **"Active Pipeline"** (in-progress applicants: `Applied`, `Under Review`, `Shortlisted`, `Interviewing`, excluding `Hired`, `Rejected`, and `Withdrawn`).

### Saved Candidates

* Company-scoped saved applicant records.
* Candidate notes and metadata.
* Dedicated saved candidate panel.

### Candidate Invitations

* Employer-to-candidate invitation workflow.
* Job-specific invitations.
* Invitation status and response tracking.
* Expiration handling.
* Candidate response messages.

---

## Messaging & Communication

### Authenticated At-Rest Message Encryption (AES-256-GCM)

* End-to-end server encryption utility (`src/lib/message-encryption.ts`) using Node.js `crypto` with `aes-256-gcm`.
* Encrypts normal conversation messages (`message_content`) before persisting to Directus database (`vs_message`), securing message content against unauthorized database dumps.
* Transparent automatic decryption on message retrieval for authorized conversation participants across both Client and Freelancer portals.
* Real-time conversation list previews (`last_message_preview`) decrypted dynamically.
* Structured fallback for unencrypted legacy messages and graceful decryption error handling.
* Preserves structured JSON payload queries for system-generated recruitment and interview events (`message_type: "SYSTEM"`).

### Interactive Message Reactions

* Curated professional 8-emoji reaction palette (`👍`, `❤️`, `😂`, `🎉`, `🔥`, `👀`, `🙏`, `❓`).
* Dedicated relational reaction storage (`vs_message_reaction`) keeping reaction aggregations fast without modifying encrypted `message_content`.
* Shared reaction toggle API (`/api/shared/messaging/messages/[messageId]/reactions`) supporting optimistic toggle states with error rollback.
* Click-and-hold (long-press) and drag-to-select gesture interaction with live hover animations.
* Right-positioned quick reaction triggers and bottom-right overlapping reaction pill badges.
* Fullscreen Hiring Celebration Surprise: Automatic detection of unread `HIRED` system messages upon opening a conversation, triggering a high-fidelity celebratory modal with multi-colored bursting confetti particles, glowing trophy visuals, and target job details.

### Dynamic Role-Aware System Message Cards

* Unified system message card renderers (`ApplicationCard.tsx`, `InterviewCard.tsx`) adapting layout, badges, and contextual copy dynamically based on the viewer's authenticated role (`CANDIDATE` vs `CLIENT`).
* Contextual event messaging across recruitment and interview milestones (`HIRED`, `APPLICATION_SUBMITTED`, `APPLICATION_STATUS_CHANGED`, `INTERVIEW_SCHEDULED`, `INTERVIEW_UPDATED`):
  * **Hired**: Freelancer sees *"You Were Hired"* and *"You were hired for [Position]"*, while the employer sees *"Candidate Hired"* and *"You hired [Candidate Name] for [Position]"*.
  * **Application Submitted**: Freelancer sees *"Application Submitted"* with their target job, while the employer receives *"New Application"* with the applicant's name and position.
  * **Status Updates**: Tailored update headlines for candidates and recruiters with event date prioritization (`updated_at` / `status_updated_at`).
  * **Interview Cards**: Role- and status-aware interview cards with status-driven headers, icons, and contextual headlines (`SCHEDULED`, `CONFIRMED`, `RESCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`). Action buttons (*"Join Online Meeting"*) are strictly gated by active interview states and automatically hidden upon completion or cancellation.
* Integrated document viewers, resumé downloads, external portfolio links, cover letter accordions, and salary badges within the conversation thread.

### Public Experience & Interactive Design

* **Network Graph Background & Cross-Component Interaction**: Production-ready interactive canvas background (`NetworkBackground.tsx`) powering the Public Home Landing Page, featuring drifting constellation nodes, dynamic proximity links, rotating dashed hub rings, hopping data packets, and pointer click shockwaves.
* **Seamless Dark/Light Theme Crossfading**: Pure CSS gradient foundation (`.net-bg`) with hardware-accelerated theme crossfades (`next-themes`) and real-time canvas color palette interpolation between light (indigo/blue/sky) and dark (vibrant neon glow) modes.
* **Translucent Glassmorphism Architecture**: Fixed non-blocking background layer (`pointer-events: none`, `z-index: 0`) integrated smoothly with translucent cards and search bars (`backdrop-blur-md`, `bg-card/75`), letting the network graph flow beneath without interfering with clicks or scrolling.
* **Full Accessibility & Graceful Degradation**: Honors `prefers-reduced-motion` to render a single static frame without animation loops, maintaining complete visual fidelity while protecting users with vestibular sensitivities.

---

## System Resilience & Outage Management

VOS Sync includes dedicated infrastructure for detecting and communicating backend failures without disrupting active workflows.

* **Non-Disruptive Floating Outage Overlay**: System outage and service monitor rendered as a fixed modal backdrop overlay (`z-[9999] bg-black/60 backdrop-blur-md`) rather than destroying active page state, preserving user inputs, forms, and navigation context.
* **In-Place Recovery & Diagnostics**: Real-time `/api/health` connectivity verification with live Web Server & Database Backend indicators, response latency, Philippine local-time (PST) timestamps, and in-place `reset()` reconnection.
* **Dismissible Monitoring**: User dismiss action allowing workflow continuation if the disruption is non-critical.
* **Dedicated Outage Pages**: Standalone `/server-down` fallback route configured to bypass authentication middleware to avoid redirect loops during infrastructure downtimes.

---

## Code Quality & Engineering Standards

* Zero ESLint errors and warnings.
* Zero TypeScript compilation errors.
* Automated CI pipeline validating linting (`eslint --max-warnings=0`), TypeScript compilation (`typecheck`), and Next.js production builds on pull requests and pushes to `master`.
* Automated CD pipeline managing continuous deployment to production via SSH and PM2 process synchronization.
* Strict TypeScript typing.
* Explicit interfaces and `unknown` types instead of unsafe `any`.
* React hook patterns optimized to prevent cascading state updates.
* Company-scoped data isolation.
* Server-side validation for critical scheduling operations.
* Modular matching and AI service architecture.
* Graceful AI failure handling so core recruitment functionality remains operational.
