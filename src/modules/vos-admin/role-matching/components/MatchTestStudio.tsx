// src/modules/vos-admin/role-matching/components/MatchTestStudio.tsx

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  FileText,
  Check,
  User,
  Briefcase,
  Code2,
  Award,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Info,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useMatchTester } from "../hooks/useMatchTester";
import {
  CandidateSimulationProfile,
  CandidateWorkExperience,
  CandidateCertification,
} from "../types";

const DEFAULT_CANDIDATE: CandidateSimulationProfile = {
  user_id: 999,
  name: "Laplace Dummy",
  email: "laplace@example.com",
  headline: "Full-Stack Web Developer",
  summary:
    "Passionate Full-Stack Web Developer with over 3 years of experience building scalable web applications and enterprise solutions.",
  location: "Anda, CSC Regional Office No. 1",
  availability_status: "EMPLOYED",
  skills: [
    "React",
    "Next.js",
    "TypeScript",
    "Tailwind CSS",
    "JavaScript",
    "Spring Boot",
    "MySQL",
    "Docker",
  ],
  work_experience: [
    {
      company_name: "Vertex Technologies Corporation",
      job_title: "Full-Stack Web Developer",
      job_description: "Building production ERP systems and Next.js React web apps.",
      start_date: "2023-03-01",
      is_current_role: true,
    },
    {
      company_name: "Acme Digital Agency",
      job_title: "Freelance Web Developer",
      job_description: "Created client websites using HTML, CSS, JavaScript, and React.",
      start_date: "2022-01-01",
      end_date: "2023-02-28",
      is_current_role: false,
    },
  ],
  certifications: [
    { certificate_name: "Meta Front-End Developer Certificate", issuing_organization: "Meta" },
    { certificate_name: "Responsive Web Design Certificate", issuing_organization: "freeCodeCamp" },
  ],
};

const PRESETS: Record<string, { label: string; keyword: string; candidate: CandidateSimulationProfile }> = {
  fullstack: {
    label: "Full-Stack Developer",
    keyword: "web developer",
    candidate: DEFAULT_CANDIDATE,
  },
  frontend: {
    label: "Frontend Engineer",
    keyword: "frontend developer",
    candidate: {
      user_id: 998,
      name: "Alex Rivera",
      email: "alex.rivera@example.com",
      headline: "Senior Frontend Engineer",
      summary: "Specialist in React, Next.js, performance optimization, and responsive design systems.",
      location: "Makati, Metro Manila",
      availability_status: "AVAILABLE",
      skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Redux", "GraphQL", "Figma"],
      work_experience: [
        {
          company_name: "Fintech Solutions Inc.",
          job_title: "Senior Frontend Engineer",
          job_description: "Built customer-facing banking dashboards with Next.js and TypeScript.",
          start_date: "2022-06-01",
          is_current_role: true,
        },
      ],
      certifications: [
        { certificate_name: "AWS Certified Cloud Practitioner", issuing_organization: "Amazon Web Services" },
        { certificate_name: "Meta React Advanced Developer", issuing_organization: "Meta" },
      ],
    },
  },
  social_media: {
    label: "Social Media Specialist",
    keyword: "social media specialist",
    candidate: {
      user_id: 997,
      name: "Maria Santos",
      email: "maria.santos@example.com",
      headline: "Social Media Strategist & Content Creator",
      summary: "Creative digital marketer specializing in social media campaigns, community management, and paid ads.",
      location: "Cebu City, Central Visayas",
      availability_status: "AVAILABLE",
      skills: ["Social Media Strategy", "Content Creation", "Copywriting", "Canva", "Meta Ads", "TikTok Marketing"],
      work_experience: [
        {
          company_name: "Pulse Media Agency",
          job_title: "Social Media Specialist",
          job_description: "Managed 5 brand accounts with a combined reach of 500k+ followers.",
          start_date: "2021-08-01",
          is_current_role: true,
        },
      ],
      certifications: [
        { certificate_name: "HubSpot Social Media Certification", issuing_organization: "HubSpot Academy" },
        { certificate_name: "Google Digital Marketing Certificate", issuing_organization: "Google" },
      ],
    },
  },
  data_analyst: {
    label: "Data Analyst",
    keyword: "data analyst",
    candidate: {
      user_id: 996,
      name: "Kenji Tanaka",
      email: "kenji.tanaka@example.com",
      headline: "Business Intelligence & Data Analyst",
      summary: "Experienced in SQL, PowerBI, Python data pipelines, and actionable executive reporting.",
      location: "Taguig, Metro Manila",
      availability_status: "AVAILABLE",
      skills: ["SQL", "Python", "PowerBI", "Tableau", "Excel", "Data Modeling", "ETL"],
      work_experience: [
        {
          company_name: "Insight Analytics Corp",
          job_title: "Data Analyst",
          job_description: "Designed executive KPI dashboards and automated monthly revenue reporting.",
          start_date: "2022-01-01",
          is_current_role: true,
        },
      ],
      certifications: [
        { certificate_name: "Microsoft Certified: Power BI Data Analyst", issuing_organization: "Microsoft" },
        { certificate_name: "Google Data Analytics Professional Certificate", issuing_organization: "Google" },
      ],
    },
  },
};

export function MatchTestStudio() {
  const [keywordInput, setKeywordInput] = useState("web developer");
  const [candidate, setCandidate] = useState<CandidateSimulationProfile>(DEFAULT_CANDIDATE);
  const [activeTab, setActiveTab] = useState<"PROFILE" | "SKILLS" | "EXPERIENCE" | "CERTIFICATIONS">("PROFILE");
  const [newSkillInput, setNewSkillInput] = useState("");
  const [newCertName, setNewCertName] = useState("");
  const [newCertIssuer, setNewCertIssuer] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("fullstack");

  const { result, loading, error, runTest } = useMatchTester();

  const handleRun = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    runTest(keywordInput, candidate.user_id, candidate);
  };

  const handleApplyPreset = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const preset = PRESETS[presetKey];
    if (preset) {
      setKeywordInput(preset.keyword);
      setCandidate(preset.candidate);
    }
  };

  const handleResetCandidate = () => {
    setCandidate(DEFAULT_CANDIDATE);
    setKeywordInput("web developer");
    setSelectedPreset("fullstack");
  };

  // Skill management
  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSkillInput.trim();
    if (!trimmed) return;
    if (!candidate.skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setCandidate((prev) => ({ ...prev, skills: [...prev.skills, trimmed] }));
    }
    setNewSkillInput("");
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setCandidate((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillToRemove),
    }));
  };

  // Work experience management
  const handleAddExperience = () => {
    const newExp: CandidateWorkExperience = {
      company_name: "New Company Inc.",
      job_title: "Software Engineer",
      job_description: "Responsibilities and achievements...",
      start_date: "2023-01-01",
      is_current_role: false,
    };
    setCandidate((prev) => ({
      ...prev,
      work_experience: [...prev.work_experience, newExp],
    }));
  };

  const handleUpdateExperience = (index: number, updates: Partial<CandidateWorkExperience>) => {
    setCandidate((prev) => {
      const nextExp = [...prev.work_experience];
      nextExp[index] = { ...nextExp[index], ...updates };
      return { ...prev, work_experience: nextExp };
    });
  };

  const handleRemoveExperience = (index: number) => {
    setCandidate((prev) => ({
      ...prev,
      work_experience: prev.work_experience.filter((_, i) => i !== index),
    }));
  };

  // Certification management
  const handleAddCertification = (e: React.FormEvent) => {
    e.preventDefault();
    const certName = newCertName.trim();
    if (!certName) return;
    const newCert: CandidateCertification = {
      certificate_name: certName,
      issuing_organization: newCertIssuer.trim() || null,
    };
    setCandidate((prev) => ({
      ...prev,
      certifications: [...(prev.certifications || []), newCert],
    }));
    setNewCertName("");
    setNewCertIssuer("");
  };

  const handleRemoveCertification = (index: number) => {
    setCandidate((prev) => ({
      ...prev,
      certifications: (prev.certifications || []).filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumbs & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/linkbridge/admin/job-roles" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                  Matching Intelligence
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="text-muted-foreground text-xs font-medium">Sandbox</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-xs font-bold text-foreground">
                Match Test Studio
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Link href="/linkbridge/admin/job-roles">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 rounded-xl text-xs gap-1.5 font-semibold text-muted-foreground hover:text-foreground border-border hover:bg-muted active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Matching Taxonomy
          </Button>
        </Link>
      </div>

      {/* Header Banner using Shadcn Card */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardHeader className="p-6">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="h-4 w-4" />
              <span>Matching Intelligence Engine Sandbox</span>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Match Test Studio
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-muted-foreground max-w-2xl mt-1 leading-relaxed">
              Test search terms and inspect or edit the simulated jobseeker profile in real time to verify compatibility scoring, category resolution, credentials, and signal verification.
            </CardDescription>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Main Simulation Sandbox & Profile Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN: Search Query + Editable Jobseeker Profile ────────── */}
        <div className="lg:col-span-5 space-y-5">
          {/* Query Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="p-5 bg-card rounded-2xl border shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Search Query Input
              </span>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-muted-foreground">Preset:</span>
                <select
                  value={selectedPreset}
                  onChange={(e) => handleApplyPreset(e.target.value)}
                  className="bg-muted px-2 py-1 rounded-md text-xs font-semibold text-foreground border border-input cursor-pointer hover:bg-muted/80 transition-colors"
                >
                  {Object.entries(PRESETS).map(([key, p]) => (
                    <option key={key} value={key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <form onSubmit={handleRun} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Search Query / Role Keyword
                </label>
                <Input
                  placeholder="e.g. web developer, frontend engineer, react dev"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  className="h-10 text-sm font-medium transition-all focus-visible:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-xs gap-2 border-0 shadow-md cursor-pointer transition-all"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 fill-white" />
                  )}
                  Run Match Simulation
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleResetCandidate}
                  title="Reset to Default Profile"
                  className="h-10 w-10 shrink-0 rounded-xl cursor-pointer hover:bg-muted active:scale-95 transition-all"
                >
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </form>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-rose-600 font-semibold mt-1"
              >
                {error}
              </motion.p>
            )}
          </motion.div>

          {/* Jobseeker Profile Inspector & Editor Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.05 }}
            className="p-5 bg-card rounded-2xl border shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-indigo-500" />
                  2. Tested Jobseeker Profile
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Edit attributes below to simulate different candidate signals.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Editable Sandbox
              </span>
            </div>

            {/* Profile Tabs Navigation */}
            <div className="flex border-b border-border/60 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("PROFILE")}
                className={`pb-2 px-2.5 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === "PROFILE"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="h-3.5 w-3.5" />
                Headline
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("SKILLS")}
                className={`pb-2 px-2.5 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === "SKILLS"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                Skills ({candidate.skills.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("EXPERIENCE")}
                className={`pb-2 px-2.5 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === "EXPERIENCE"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                Roles ({candidate.work_experience.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("CERTIFICATIONS")}
                className={`pb-2 px-2.5 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === "CERTIFICATIONS"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Award className="h-3.5 w-3.5" />
                Certs ({candidate.certifications?.length || 0})
              </button>
            </div>

            {/* Tab Contents with Fluid AnimatePresence */}
            <AnimatePresence mode="wait">
              {/* ── TAB 1: Headline & Basic Info ────────────────────────────── */}
              {activeTab === "PROFILE" && (
                <motion.div
                  key="tab-profile"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3 pt-1"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Candidate Full Name
                    </label>
                    <Input
                      value={candidate.name}
                      onChange={(e) =>
                        setCandidate((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="h-8 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Professional Headline (Primary Title Signal)
                    </label>
                    <Input
                      value={candidate.headline}
                      onChange={(e) =>
                        setCandidate((prev) => ({ ...prev, headline: e.target.value }))
                      }
                      placeholder="e.g. Full-Stack Web Developer"
                      className="h-8 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Location
                    </label>
                    <Input
                      value={candidate.location}
                      onChange={(e) =>
                        setCandidate((prev) => ({ ...prev, location: e.target.value }))
                      }
                      className="h-8 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Professional Summary (Context Signal)
                    </label>
                    <Textarea
                      value={candidate.summary}
                      onChange={(e) =>
                        setCandidate((prev) => ({ ...prev, summary: e.target.value }))
                      }
                      rows={3}
                      className="text-xs resize-none"
                    />
                  </div>
                </motion.div>
              )}

              {/* ── TAB 2: Skills Tag Editor ──────────────────────────────────── */}
              {activeTab === "SKILLS" && (
                <motion.div
                  key="tab-skills"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3 pt-1"
                >
                  <form onSubmit={handleAddSkill} className="flex gap-2">
                    <Input
                      placeholder="Type a skill and press Enter..."
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-8 px-3 text-xs font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white cursor-pointer transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </form>

                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 rounded-xl bg-muted/40 border">
                    {candidate.skills.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic p-1">
                        No skills attached. Add skills above to test skill matching.
                      </p>
                    ) : (
                      <AnimatePresence>
                        {candidate.skills.map((skill) => (
                          <motion.span
                            key={skill}
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={{ duration: 0.12 }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-background border shadow-2xs group"
                          >
                            <span className="text-foreground">{skill}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSkill(skill)}
                              className="text-muted-foreground hover:text-destructive transition-colors ml-0.5 cursor-pointer"
                              title={`Remove ${skill}`}
                            >
                              ×
                            </button>
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── TAB 3: Work Experience Editor ─────────────────────────────── */}
              {activeTab === "EXPERIENCE" && (
                <motion.div
                  key="tab-experience"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3 pt-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground">
                      Work History Roles
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddExperience}
                      className="h-7 px-2.5 text-[11px] font-bold gap-1 cursor-pointer hover:bg-muted active:scale-95 transition-all"
                    >
                      <Plus className="h-3 w-3" />
                      Add Role
                    </Button>
                  </div>

                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    <AnimatePresence>
                      {candidate.work_experience.map((exp, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="p-3 rounded-xl bg-muted/40 border space-y-2 relative group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Input
                              placeholder="Job Title"
                              value={exp.job_title}
                              onChange={(e) =>
                                handleUpdateExperience(idx, { job_title: e.target.value })
                              }
                              className="h-7 text-xs font-semibold flex-1 bg-background"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveExperience(idx)}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                              title="Remove Role"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Company Name"
                              value={exp.company_name}
                              onChange={(e) =>
                                handleUpdateExperience(idx, { company_name: e.target.value })
                              }
                              className="h-7 text-xs flex-1 bg-background"
                            />
                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground shrink-0 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(exp.is_current_role)}
                                onChange={(e) =>
                                  handleUpdateExperience(idx, { is_current_role: e.target.checked })
                                }
                                className="rounded border-input text-indigo-600 focus:ring-indigo-500"
                              />
                              Current Role
                            </label>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* ── TAB 4: Certifications Editor ──────────────────────────────── */}
              {activeTab === "CERTIFICATIONS" && (
                <motion.div
                  key="tab-certifications"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3 pt-1"
                >
                  <form onSubmit={handleAddCertification} className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Certificate Name (e.g. AWS Solutions Architect)"
                        value={newCertName}
                        onChange={(e) => setNewCertName(e.target.value)}
                        className="h-8 text-xs flex-1"
                      />
                      <Input
                        placeholder="Issuer (e.g. AWS)"
                        value={newCertIssuer}
                        onChange={(e) => setNewCertIssuer(e.target.value)}
                        className="h-8 text-xs w-28 shrink-0"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="h-8 px-3 text-xs font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white cursor-pointer transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>
                  </form>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {(!candidate.certifications || candidate.certifications.length === 0) ? (
                      <p className="text-xs text-muted-foreground italic p-2 rounded-xl bg-muted/40 border">
                        No certifications added. Add verified credentials above.
                      </p>
                    ) : (
                      <AnimatePresence>
                        {candidate.certifications.map((cert, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="p-2.5 rounded-xl bg-muted/40 border flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">
                                {cert.certificate_name}
                              </p>
                              {cert.issuing_organization && (
                                <p className="text-[11px] text-muted-foreground">
                                  {cert.issuing_organization}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveCertification(idx)}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0"
                              title="Remove Certificate"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── RIGHT COLUMN: Simulation Results & Matching Breakdown ────────── */}
        <div className="lg:col-span-7 space-y-5">
          <AnimatePresence mode="wait">
            {!result && !loading && (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-12 text-center bg-card rounded-2xl border border-dashed space-y-3"
              >
                <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 w-fit mx-auto">
                  <Play className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">Ready to Run Simulation</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Click <strong>&quot;Run Match Simulation&quot;</strong> to evaluate the candidate profile against the active database taxonomy rules and scoring model.
                </p>
              </motion.div>
            )}

            {loading && (
              <motion.div
                key="loading-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="p-12 text-center bg-card rounded-2xl border space-y-3"
              >
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
                <p className="text-xs font-semibold text-muted-foreground">
                  Analyzing query and executing matching engine algorithm...
                </p>
              </motion.div>
            )}

            {result && !loading && (
              <motion.div
                key="result-state"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Resolved Intent & Overall Compatibility Card */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 block mb-1">
                      Resolved Role Intent
                    </span>
                    <h3 className="text-lg font-black text-indigo-700 dark:text-indigo-300">
                      {result.resolvedContext?.resolved_role ?? "Unresolved Raw Keyword"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span>Category:</span>
                      <span className="font-semibold text-foreground">
                        {result.resolvedContext?.category_name ?? "General"}
                      </span>
                      <span>·</span>
                      <span>Matched Alias:</span>
                      <span className="font-semibold text-foreground">
                        {result.resolvedContext?.matched_alias || "Direct Keyword"}
                      </span>
                      <span>·</span>
                      <span>Weight:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {Math.round((result.resolvedContext?.match_weight ?? 1) * 100)}%
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 bg-card p-3 rounded-xl border shadow-2xs">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Match Score
                      </span>
                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                        {result.overallScore}%
                      </span>
                    </div>
                    {result.confidence && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        {result.confidence.level}
                      </span>
                    )}
                  </div>
                </motion.div>

                {/* Candidate vs Taxonomy Comparison Summary */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.05 }}
                  className="p-4 rounded-2xl bg-card border shadow-xs space-y-3"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-indigo-500" />
                    Candidate Profile Evaluation Summary
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                        Evaluated Candidate
                      </span>
                      <p className="font-bold text-foreground truncate">{candidate.name}</p>
                      <p className="text-muted-foreground truncate">{candidate.headline}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                        Signals Evaluated
                      </span>
                      <p className="font-bold text-foreground">
                        {candidate.skills.length} skills · {candidate.certifications?.length || 0} certs
                      </p>
                      <p className="text-muted-foreground">
                        {candidate.work_experience.length} work history roles checked
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Breakdown Sections & Verified Signals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Score Breakdown */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    className="p-5 bg-card rounded-2xl border shadow-xs space-y-3"
                  >
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                      Scoring Factor Breakdown
                    </h4>
                    <div className="space-y-2">
                      {result.sections.map((sec, idx) => {
                        const pct = Math.round((sec.score / (sec.max || 1)) * 100);
                        return (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-muted/30 border space-y-1"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground">{sec.label}</span>
                              <span className="font-mono font-bold text-foreground">
                                {sec.score} / {sec.max} pts
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, pct)}%` }}
                                transition={{ duration: 0.35, ease: "easeOut" }}
                                className="h-full bg-indigo-600 rounded-full"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>

                  {/* Evidence & Signals */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.15 }}
                    className="p-5 bg-card rounded-2xl border shadow-xs space-y-3"
                  >
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      Verified Evidence Signals
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {result.evidence.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          No direct matching signals verified.
                        </p>
                      ) : (
                        result.evidence.map((ev, idx) => (
                          <motion.span
                            key={idx}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.15, delay: idx * 0.03 }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          >
                            <Check className="h-3 w-3" />
                            <span>{ev.label}:</span>
                            <span className="font-normal text-muted-foreground truncate max-w-[120px]">
                              {ev.value}
                            </span>
                          </motion.span>
                        ))
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Execution Trace Log */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.2 }}
                  className="p-5 bg-card rounded-2xl border shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-500" />
                      Engine Execution Trace Log
                    </h4>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {result.trace.length} Steps
                    </span>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl font-mono text-xs text-zinc-300 space-y-2 max-h-72 overflow-y-auto shadow-inner">
                    {result.trace.length === 0 ? (
                      <p className="text-zinc-500 text-xs">No execution trace generated.</p>
                    ) : (
                      result.trace.map((tr, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.1, delay: idx * 0.02 }}
                          className="flex items-start justify-between gap-3 border-b border-zinc-800/80 pb-1.5 hover:bg-zinc-900/50 p-1.5 rounded-lg transition-colors"
                        >
                          <div className="space-y-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-indigo-950 text-indigo-300 border border-indigo-800/60 mr-2">
                              {tr.factor}
                            </span>
                            <span className="text-zinc-200">{tr.result}</span>
                          </div>
                          <span
                            className={`text-xs font-bold shrink-0 px-2 py-0.5 rounded-full ${
                              tr.points > 0
                                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {tr.points > 0 ? `+${tr.points} pts` : `${tr.points} pts`}
                          </span>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
