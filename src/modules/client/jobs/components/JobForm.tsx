/* eslint-disable react-hooks/set-state-in-effect */
// src/modules/client/jobs/components/JobForm.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Search,
  Plus,
  X,
  PlusCircle,
  Trash2,
  HelpCircle,
  Building,
  Briefcase,
  MapPin,
  CircleDollarSign,
  GraduationCap,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { addMasterSkillAction, getMasterSkillsAction } from "../services/jobs.actions";
import { JobFormData, JOB_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS, JobType, ExperienceLevel } from "../types";
import { RichTextEditor } from "./RichTextEditor";
import { useRoleCategories } from "../hooks/useRoleCategories";
import { SuggestCategoryModal } from "./SuggestCategoryModal";
import JobPipelineSection from "@/modules/client/pipeline/components/JobPipelineSection";

interface JobFormProps {
  data: JobFormData;
  onChange: (field: keyof JobFormData, value: string | number | boolean | null | string[] | { id: number; skill_name: string; source?: string; confidence_score?: number | null }[]) => void;
  onCancel: () => void;
  onSubmit: () => void;
  saving: boolean;
  editingJob: boolean;
  existingJobs?: { job_id: number; job_title: string; is_deleted?: number | boolean; status?: string }[];
  currentJobId?: number | null;
}

const BENEFITS_OPTIONS = [
  "HMO / Medical Insurance",
  "Paid Leave (Sick, Vacation)",
  "Work From Home / Remote Option",
  "Flexible Work Hours",
  "Dental & Vision Benefits",
  "13th Month Pay & Bonuses",
  "Life Insurance",
  "Professional Development / Training",
];

const EDUCATION_OPTIONS = [
  "High School Graduate",
  "Vocational / Associate Degree",
  "Bachelor's Degree Graduate",
  "Master's Degree / Post-Graduate",
  "Doctorate / PhD",
  "No Education Requirement / Open to All",
];

const JOB_TYPE_OPTIONS = (Object.entries(JOB_TYPE_LABELS) as [JobType, string][]).map(([k, v]) => ({
  value: k,
  label: v,
}));

const EXP_LEVEL_OPTIONS = (Object.entries(EXPERIENCE_LEVEL_LABELS) as [ExperienceLevel, string][]).map(([k, v]) => ({
  value: k,
  label: v,
}));

const EDUCATION_SELECT_OPTIONS = EDUCATION_OPTIONS.map((edu) => ({
  value: edu,
  label: edu,
}));

// Client-side cache for master skills list: only requested once across the session
let globalSkillsCache: { id: number; skill_name: string }[] | null = null;
let globalSkillsFetchPromise: Promise<{ id: number; skill_name: string }[]> | null = null;

async function getClientMasterSkills(): Promise<{ id: number; skill_name: string }[]> {
  if (globalSkillsCache) return globalSkillsCache;
  if (!globalSkillsFetchPromise) {
    globalSkillsFetchPromise = getMasterSkillsAction()
      .then((skills) => {
        globalSkillsCache = skills;
        globalSkillsFetchPromise = null;
        return skills;
      })
      .catch((err) => {
        globalSkillsFetchPromise = null;
        console.error("Failed to load master skills:", err);
        return [];
      });
  }
  return globalSkillsFetchPromise;
}

function filterSkillsInMemory(skills: { id: number; skill_name: string }[], query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const matches = skills.filter((s) => s.skill_name.toLowerCase().includes(q));
  return matches
    .sort((a, b) => {
      const nameA = a.skill_name.toLowerCase();
      const nameB = b.skill_name.toLowerCase();

      // 1. Exact match
      const exactA = nameA === q;
      const exactB = nameB === q;
      if (exactA && !exactB) return -1;
      if (!exactA && exactB) return 1;

      // 2. Starts with
      const startsA = nameA.startsWith(q);
      const startsB = nameB.startsWith(q);
      if (startsA && !startsB) return -1;
      if (!startsA && startsB) return 1;

      // If both start with the query, sort by shorter length first
      if (startsA && startsB) {
        return nameA.length - nameB.length;
      }

      // 3. Contains index comparison
      const idxA = nameA.indexOf(q);
      const idxB = nameB.indexOf(q);
      if (idxA !== idxB) {
        return idxA - idxB;
      }

      return nameA.localeCompare(nameB);
    })
    .slice(0, 20);
}

export default function JobForm({
  data,
  onChange,
  onCancel,
  onSubmit,
  saving,
  editingJob,
  existingJobs,
  currentJobId,
}: JobFormProps) {
  const { categories: roleCategories, findCategoryById } = useRoleCategories();
  const [step, setStep] = useState(1);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  // Category Searchable Combobox & Suggestion State
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [suggestCategoryModalOpen, setSuggestCategoryModalOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  // Company Profile for Logo in Preview Mode
  const [companyProfile, setCompanyProfile] = useState<{
    company_name?: string | null;
    company_logo?: string | null;
  } | null>(null);

  useEffect(() => {
    async function loadCompanyProfile() {
      try {
        const res = await fetch("/api/client/company-profile", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json.company) {
            setCompanyProfile(json.company);
          }
        }
      } catch {
        // ignore
      }
    }
    loadCompanyProfile();
  }, []);

  const companyLogoUrl = React.useMemo(() => {
    const raw = companyProfile?.company_logo;
    if (!raw) return null;
    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) {
      return raw;
    }
    return `/api/client/assets/${raw}`;
  }, [companyProfile?.company_logo]);

  const filteredRoleCategories = React.useMemo(() => {
    if (!categorySearchQuery.trim()) return roleCategories;
    const q = categorySearchQuery.toLowerCase().trim();
    return roleCategories.filter(
      (c) =>
        c.category_name.toLowerCase().includes(q) ||
        c.category_code.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [roleCategories, categorySearchQuery]);

  // Skills Auto-Complete State
  const [skillQuery, setSkillQuery] = useState("");
  const [skillResults, setSkillResults] = useState<{ id: number; skill_name: string }[]>([]);
  const [isSearchingSkills, setIsSearchingSkills] = useState(false);
  const [skillDropdownOpen, setSkillDropdownOpen] = useState(false);
  const skillInputContainerRef = useRef<HTMLDivElement>(null);
 

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        skillInputContainerRef.current &&
        !skillInputContainerRef.current.contains(event.target as Node)
      ) {
        setSkillDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Recommended Skills State
  const [recommendedSkills, setRecommendedSkills] = useState<{ id: number; skill_name: string; source: "TEMPLATE" | "KEYWORD"; weight: number }[]>([]);
  const [isFetchingRecommendations, setIsFetchingRecommendations] = useState(false);
  const recommendationsDebounce = useRef<NodeJS.Timeout | null>(null);

  // The debounce only delays a request; once it has fired, a slower earlier
  // response can still land after a newer one and replace its suggestions.
  const recommendationsSeqRef = useRef(0);
  const skillsSeqRef = useRef(0);

  // Fetch dynamic skill recommendations when job title or job description changes
  useEffect(() => {
    if (recommendationsDebounce.current) clearTimeout(recommendationsDebounce.current);

    const title = data.job_title || "";
    let rawDescription = "";
    if (data.job_description) {
      try {
        const parsed = JSON.parse(data.job_description);
        rawDescription = parsed.text || "";
      } catch {
        rawDescription = data.job_description;
      }
    }

    if (!title.trim() && !rawDescription.trim()) {
      recommendationsSeqRef.current++;
      setRecommendedSkills([]);
      // The cleanup below cancels the pending timer, so that timer's `finally`
      // never runs — clear the flag here or the spinner sticks forever.
      setIsFetchingRecommendations(false);
      return;
    }

    const seq = ++recommendationsSeqRef.current;
    setIsFetchingRecommendations(true);
    recommendationsDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/client/jobs/recommend-skills?title=${encodeURIComponent(title)}&description=${encodeURIComponent(rawDescription)}`);
        if (res.ok) {
          const json = await res.json();
          if (seq !== recommendationsSeqRef.current) return;
          setRecommendedSkills(json.skills || []);
        }
      } catch (err) {
        console.error("Failed to fetch recommendations:", err);
      } finally {
        if (seq === recommendationsSeqRef.current) setIsFetchingRecommendations(false);
      }
    }, 500);

    return () => {
      if (recommendationsDebounce.current) clearTimeout(recommendationsDebounce.current);
    };
  }, [data.job_title, data.job_description]);

  // Screening Questions Local Input State
  const [questionInput, setQuestionInput] = useState("");

  // Custom Benefit Local Input & List States
  const [customBenefitInput, setCustomBenefitInput] = useState("");
  const [allBenefits, setAllBenefits] = useState<string[]>(BENEFITS_OPTIONS);

  useEffect(() => {
    if (data.benefits && data.benefits.length > 0) {
      const merged = Array.from(new Set([...BENEFITS_OPTIONS, ...data.benefits]));
      setAllBenefits(merged);
    }
  }, [data.benefits]);

  // Client-cached master skills search: requests once across the session
  useEffect(() => {
    const q = skillQuery.trim();
    if (q.length < 2) {
      skillsSeqRef.current++;
      setSkillResults([]);
      setIsSearchingSkills(false);
      return;
    }

    if (globalSkillsCache) {
      const results = filterSkillsInMemory(globalSkillsCache, q);
      setSkillResults(results);
      setIsSearchingSkills(false);
      return;
    }

    const seq = ++skillsSeqRef.current;
    setIsSearchingSkills(true);
    getClientMasterSkills()
      .then((allSkills) => {
        if (seq !== skillsSeqRef.current) return;
        const results = filterSkillsInMemory(allSkills, q);
        setSkillResults(results);
      })
      .catch((err) => {
        console.error("Failed to query skills:", err);
        if (seq === skillsSeqRef.current) setSkillResults([]);
      })
      .finally(() => {
        if (seq === skillsSeqRef.current) {
          setIsSearchingSkills(false);
        }
      });
  }, [skillQuery]);

  const validateStep = (currentStep: number): boolean => {
    const errors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!data.job_title?.trim()) {
        errors.job_title = "Job title is required.";
      } else if (data.job_title.trim().length < 3 || data.job_title.trim().length > 100) {
        errors.job_title = "Job title must be between 3 and 100 characters.";
      } else if (!/^[a-zA-Z0-9\s\-/&,.()#+]+$/.test(data.job_title.trim()) || !/[a-zA-Z0-9]/.test(data.job_title.trim())) {
        errors.job_title = "Job title contains invalid characters. Use letters, numbers, spaces, and standard symbols (- / & , . ( ) + #).";
      } else if (existingJobs && existingJobs.length > 0) {
        const trimmed = data.job_title.trim().toLowerCase();
        const isDuplicate = existingJobs.some((j) => {
          if (!j.job_title) return false;
          if (currentJobId && j.job_id === currentJobId) return false;
          if (j.is_deleted === 1 || j.is_deleted === true) return false;
          if (j.status === "CLOSED") return false;
          return j.job_title.trim().toLowerCase() === trimmed;
        });
        if (isDuplicate) {
          errors.job_title = "A job posting with this title already exists in your company.";
        }
      }
      if (!data.job_category) {
        errors.job_category = "Job category is required.";
      }
      if (!data.job_type) {
        errors.job_type = "Employment type is required.";
      }
      if (!data.work_arrangement) {
        errors.work_arrangement = "Work arrangement is required.";
      }
      if (!data.job_location?.trim()) {
        errors.job_location = "Location is required.";
      }
    }

    if (currentStep === 2) {
      if (!data.job_description?.trim()) {
        errors.job_description = "Job description is required.";
      }
      if (!data.job_responsibilities?.trim()) {
        errors.job_responsibilities = "Core responsibilities are required.";
      }
      if (!data.job_qualifications?.trim()) {
        errors.job_qualifications = "Qualifications & requirements details are required.";
      }
    }

    if (currentStep === 3) {
      if (!data.salary_negotiable) {
        const minVal = Number(data.salary_min);
        const maxVal = Number(data.salary_max);
        if (!data.salary_min && !data.salary_max) {
          errors.salary_info = "Please specify min/max salary or tick negotiable.";
        } else if (data.salary_min && data.salary_max && minVal > maxVal) {
          errors.salary_info = "Maximum salary cannot be less than minimum salary.";
        }
      }
    }

    setLocalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setStep((prev) => prev - 1);
  };

  const handleFinalSubmit = () => {
    if (validateStep(step)) {
      onSubmit();
    }
  };

  // Skill Add / Remove
  const handleSelectSkill = (skill: { id: number; skill_name: string }) => {
    const currentSkills = data.skills || [];
    if (!currentSkills.some((s) => s.skill_name.toLowerCase() === skill.skill_name.toLowerCase())) {
      const recommended = recommendedSkills.find(
        (r) => r.id === skill.id || r.skill_name.toLowerCase() === skill.skill_name.toLowerCase()
      );
      const source = recommended ? recommended.source : "MANUAL";
      const confidence = recommended ? recommended.weight : 100;
      onChange("skills", [...currentSkills, { ...skill, source, confidence_score: confidence }]);
    }
    setSkillQuery("");
    setSkillResults([]);
    setSkillDropdownOpen(false);
  };

  const handleAddCustomSkill = async () => {
    const query = skillQuery.trim();
    if (!query) return;
    const currentSkills = data.skills || [];
    if (currentSkills.some((s) => s.skill_name.toLowerCase() === query.toLowerCase())) {
      setSkillQuery("");
      setSkillResults([]);
      return;
    }

    try {
      const savedSkill = await addMasterSkillAction(query);
      if (savedSkill && savedSkill.id) {
        const newSkill = { id: Number(savedSkill.id), skill_name: savedSkill.skill_name };
        if (globalSkillsCache && !globalSkillsCache.some((s) => s.id === newSkill.id)) {
          globalSkillsCache.push(newSkill);
        }
        onChange("skills", [
          ...currentSkills,
          {
            id: Number(savedSkill.id),
            skill_name: savedSkill.skill_name,
            source: "MANUAL",
            confidence_score: 100,
          },
        ]);
      }
    } catch (e) {
      console.error("Failed to add master skill:", e);
      // Fallback
      onChange("skills", [
        ...currentSkills,
        {
          id: -Date.now(),
          skill_name: query,
          source: "MANUAL",
          confidence_score: 100,
        },
      ]);
    }
    setSkillQuery("");
    setSkillResults([]);
    setSkillDropdownOpen(false);
  };

  const handleRemoveSkill = (skillId: number) => {
    const currentSkills = data.skills || [];
    onChange("skills", currentSkills.filter((s) => s.id !== skillId));
  };

  // Screening Questions Add / Remove
  const handleAddQuestion = () => {
    if (!questionInput.trim()) return;
    const currentQuestions = data.screening_questions || [];
    onChange("screening_questions", [...currentQuestions, questionInput.trim()]);
    setQuestionInput("");
  };

  const handleRemoveQuestion = (idx: number) => {
    const currentQuestions = data.screening_questions || [];
    onChange("screening_questions", currentQuestions.filter((_, i) => i !== idx));
  };

  // Benefits toggle
  const handleToggleBenefit = (benefit: string) => {
    const currentBenefits = data.benefits || [];
    if (currentBenefits.includes(benefit)) {
      onChange("benefits", currentBenefits.filter((b) => b !== benefit));
    } else {
      onChange("benefits", [...currentBenefits, benefit]);
    }
  };

  const handleAddCustomBenefit = () => {
    if (!customBenefitInput.trim()) return;
    const value = customBenefitInput.trim();
    if (!allBenefits.includes(value)) {
      setAllBenefits((prev) => [...prev, value]);
    }
    const currentBenefits = data.benefits || [];
    if (!currentBenefits.includes(value)) {
      onChange("benefits", [...currentBenefits, value]);
    }
    setCustomBenefitInput("");
  };

  const renderInlineMarkdown = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*|<b>.*?<\/b>|<strong>.*?<\/strong>)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
        return (
          <strong key={idx} className="font-bold text-zinc-900 dark:text-zinc-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("<b>") && part.endsWith("</b>") && part.length >= 7) {
        return (
          <strong key={idx} className="font-bold text-zinc-900 dark:text-zinc-100">
            {part.slice(3, -4)}
          </strong>
        );
      }
      if (part.startsWith("<strong>") && part.endsWith("</strong>") && part.length >= 17) {
        return (
          <strong key={idx} className="font-bold text-zinc-900 dark:text-zinc-100">
            {part.slice(8, -9)}
          </strong>
        );
      }
      return part;
    });
  };

  const renderFormattedContent = (text: string | null | undefined) => {
    if (!text) return <p className="text-xs text-zinc-400 italic">No information provided.</p>;
    if (/<(b|strong|ul|ol|li|p|div|br)\b[^>]*>/i.test(text)) {
      return (
        <div
          className="text-xs text-zinc-650 dark:text-zinc-350 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_b]:font-bold"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
        />
      );
    }
    const blocks = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return (
      <div className="space-y-2.5">
        {blocks.map((block, bIdx) => {
          const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
          const isList =
            lines.length > 0 &&
            (lines.every((line) => line.startsWith("-") || line.startsWith("*") || line.startsWith("•") || /^\d+\./.test(line)) ||
              (lines.length > 1 && lines.some((line) => line.startsWith("-") || line.startsWith("*") || line.startsWith("•") || /^\d+\./.test(line))));

          if (isList) {
            return (
              <ul key={bIdx} className="space-y-1.5 list-disc pl-4 text-xs text-zinc-650 dark:text-zinc-350 leading-relaxed">
                {lines.map((line, lIdx) => {
                  const cleaned = line.replace(/^[-*•\d+\.]\s*/, "");
                  return <li key={lIdx}>{renderInlineMarkdown(cleaned)}</li>;
                })}
              </ul>
            );
          } else {
            return (
              <p key={bIdx} className="text-xs text-zinc-650 dark:text-zinc-350 leading-relaxed whitespace-pre-wrap">
                {renderInlineMarkdown(block)}
              </p>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 5-Step Progress Bar Indicator */}
      <div className="relative flex items-center justify-between px-5 py-3.5 bg-zinc-50/50 dark:bg-zinc-900/40 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
        {/* Progress Line */}
        <div className="absolute top-[32px] left-12 right-12 h-0.5 bg-zinc-200 dark:bg-zinc-800 -translate-y-1/2 z-0">
          <div
            className="h-full bg-[#14a800] transition-all duration-300 ease-out"
            style={{ width: `${((step - 1) / 4) * 100}%` }}
          />
        </div>

        {/* Step Steps */}
        {[
          { label: "Basic Info", icon: "1" },
          { label: "Details", icon: "2" },
          { label: "Salary", icon: "3" },
          { label: "Screening", icon: "4" },
          { label: "Preview", icon: "5" },
        ].map((s, idx) => {
          const curIdx = idx + 1;
          const isDone = step > curIdx;
          const isActive = step === curIdx;

          return (
            <div key={idx} className="relative z-10 flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => curIdx < step && setStep(curIdx)}
                disabled={curIdx >= step || saving}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border-2 max-md:size-10
                  ${isDone
                    ? "bg-[#14a800] border-[#14a800] text-white shadow-sm"
                    : isActive
                      ? "bg-white dark:bg-zinc-950 border-[#14a800] text-[#14a800] shadow-sm shadow-[#14a800]/10"
                      : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400"
                  }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : s.icon}
              </button>
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors duration-300 hidden sm:block
                ${isActive ? "text-[#14a800]" : isDone ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Wizard Contents */}
      <div
        className="flex-1 overflow-y-auto pr-2 my-4 min-h-0 overscroll-contain"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* STEP 1: Basic Information */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn px-1">
            {/* Job Title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="jf-title" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Job Title <span className="text-rose-500">*</span>
                </Label>
                <span
                  className={`text-[11px] font-mono ${
                    (data.job_title?.length ?? 0) > 100
                      ? "text-rose-500 font-bold"
                      : "text-muted-foreground"
                  }`}
                >
                  {data.job_title?.length ?? 0}/100
                </span>
              </div>
              <Input
                id="jf-title"
                maxLength={100}
                value={data.job_title ?? ""}
                onChange={(e) => {
                  onChange("job_title", e.target.value);
                  if (localErrors.job_title) setLocalErrors((p) => ({ ...p, job_title: "" }));
                }}
                placeholder="e.g. Senior Full Stack Engineer"
                className={`h-10 md:text-sm border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg max-md:h-10 max-md:text-base ${localErrors.job_title ? "border-rose-455 focus:border-rose-500 focus:ring-rose-500" : ""
                  }`}
              />
              {localErrors.job_title && (
                <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {localErrors.job_title}
                </p>
              )}
            </div>

            {/* Category & Employment Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="jf-category" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Role Category <span className="text-rose-500">*</span>
                </Label>
                <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="jf-category"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={categoryPopoverOpen}
                      className={cn(
                        "w-full h-10 justify-between text-sm rounded-lg font-normal border-zinc-200 hover:border-emerald-500 bg-background max-md:min-h-10",
                        !data.job_category && !data.category_id && "text-muted-foreground",
                        localErrors.job_category && "border-rose-500 focus:ring-rose-500"
                      )}
                    >
                      <span className="truncate">
                        {data.category_id
                          ? findCategoryById(data.category_id)?.category_name || data.job_category || "Select Role Category"
                          : data.job_category || "Select Role Category"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search categories..."
                        value={categorySearchQuery}
                        onValueChange={setCategorySearchQuery}
                        className="h-9 md:text-xs max-md:h-10 max-md:text-base"
                      />
                      <CommandList
                        className="max-h-60 overflow-y-auto overscroll-contain"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {filteredRoleCategories.length === 0 ? (
                          <div className="py-4 px-3 text-center space-y-2">
                            <p className="text-xs text-muted-foreground">
                              No categories matching &quot;{categorySearchQuery}&quot;
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCategoryPopoverOpen(false);
                                setSuggestCategoryModalOpen(true);
                              }}
                              className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5 max-md:min-h-10"
                            >
                              <Plus className="h-3 w-3" />
                              Suggest &quot;{categorySearchQuery}&quot;
                            </Button>
                          </div>
                        ) : (
                          <CommandGroup>
                            {filteredRoleCategories.map((cat) => {
                              const isSelected =
                                (data.category_id && data.category_id === cat.category_id) ||
                                (!data.category_id && data.job_category?.toLowerCase() === cat.category_name.toLowerCase());
                              return (
                                <CommandItem
                                  key={cat.category_id}
                                  value={String(cat.category_id)}
                                  onSelect={() => {
                                    onChange("category_id", cat.category_id);
                                    onChange("job_category", cat.category_name);
                                    if (localErrors.job_category) setLocalErrors((p) => ({ ...p, job_category: "" }));
                                    setCategoryPopoverOpen(false);
                                  }}
                                  className="text-xs flex items-center justify-between cursor-pointer py-2 max-md:min-h-10"
                                >
                                  <div>
                                    <span className="font-medium text-foreground">{cat.category_name}</span>
                                    {cat.description && (
                                      <p className="text-[10px] text-muted-foreground line-clamp-1">{cat.description}</p>
                                    )}
                                  </div>
                                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        )}
                        <div className="p-2 border-t border-border/80 bg-muted/30">
                          <button
                            type="button"
                            onClick={() => {
                              setCategoryPopoverOpen(false);
                              setSuggestCategoryModalOpen(true);
                            }}
                            className="w-full text-left text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-primary/5 transition-colors font-medium cursor-pointer max-md:min-h-10"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Can&apos;t find the right category? <span className="underline ml-auto font-semibold text-primary">Suggest new</span>
                          </button>
                        </div>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {localErrors.job_category && (
                  <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> {localErrors.job_category}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="jf-type" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Employment Type <span className="text-rose-500">*</span>
                </Label>
                <SearchableSelect
                  options={JOB_TYPE_OPTIONS}
                  value={data.job_type}
                  onValueChange={(v) => {
                    onChange("job_type", v as JobType);
                    if (localErrors.job_type) setLocalErrors((p) => ({ ...p, job_type: "" }));
                  }}
                  placeholder="Select Type"
                  className={`h-10 md:text-sm border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg ${localErrors.job_type ? "border-rose-455 focus:border-rose-500 focus:ring-rose-500" : ""
                    }`}
                />
                {localErrors.job_type && (
                  <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> {localErrors.job_type}
                  </p>
                )}
              </div>
            </div>

            {/* Work Arrangement & Openings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Work Arrangement <span className="text-rose-500">*</span>
                </Label>
                <div
                  className={`flex gap-4 p-2.5 bg-zinc-50/50 dark:bg-zinc-900/35 border rounded-lg ${localErrors.work_arrangement ? "border-rose-455" : "border-zinc-200/60 dark:border-zinc-800/80"
                    }`}
                >
                  {["Remote", "Hybrid", "On-site"].map((arr) => (
                    <label key={arr} className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer max-md:min-h-10">
                      <input
                        type="radio"
                        name="work_arrangement"
                        value={arr}
                        checked={data.work_arrangement === arr}
                        onChange={(e) => {
                          onChange("work_arrangement", e.target.value);
                          if (localErrors.work_arrangement) setLocalErrors((p) => ({ ...p, work_arrangement: "" }));
                        }}
                        className="text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                      />
                      {arr}
                    </label>
                  ))}
                </div>
                {localErrors.work_arrangement && (
                  <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> {localErrors.work_arrangement}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="jf-openings" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Number of Openings
                </Label>
                <Input
                  id="jf-openings"
                  type="number"
                  min={1}
                  value={data.number_of_openings ?? ""}
                  onChange={(e) => onChange("number_of_openings", e.target.value)}
                  placeholder="e.g. 1"
                  className="h-10 md:text-sm border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg max-md:h-10 max-md:text-base"
                />
              </div>
            </div>

            {/* Location & Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="jf-location" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                 Address <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="jf-location"
                  value={data.job_location ?? ""}
                  onChange={(e) => {
                    onChange("job_location", e.target.value);
                    if (localErrors.job_location) setLocalErrors((p) => ({ ...p, job_location: "" }));
                  }}
                  placeholder="e.g. Manila, Philippines"
                  className={`h-10 md:text-sm border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg max-md:h-10 max-md:text-base ${localErrors.job_location ? "border-rose-455 focus:border-rose-500 focus:ring-rose-500" : ""
                    }`}
                />
                {localErrors.job_location && (
                  <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> {localErrors.job_location}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="jf-dept" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Department / Business Unit
                </Label>
                <Input
                  id="jf-dept"
                  value={data.job_department ?? ""}
                  onChange={(e) => onChange("job_department", e.target.value)}
                  placeholder="e.g. Engineering"
                  className="h-10 md:text-sm border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg max-md:h-10 max-md:text-base"
                />
              </div>
            </div>

            {/* Autocomplete Master Skills (Moved from Step 2) */}
            <div className="space-y-2 pt-4 border-t border-zinc-200/60 dark:border-zinc-800/80">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Required Skills / Technologies
              </Label>
              <div ref={skillInputContainerRef} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Type skills to search (e.g. React)..."
                  value={skillQuery}
                  onFocus={() => {
                    if (!globalSkillsCache) {
                      getClientMasterSkills();
                    }
                    if (skillQuery.trim().length > 0 || skillResults.length > 0) {
                      setSkillDropdownOpen(true);
                    }
                  }}
                  onChange={(e) => {
                    setSkillQuery(e.target.value);
                    setSkillDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSkillDropdownOpen(false);
                      return;
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const query = skillQuery.trim();
                      if (!query) return;

                      const exactMatch = skillResults.find(
                        (s) => s.skill_name.toLowerCase() === query.toLowerCase()
                      );
                      if (exactMatch) {
                        handleSelectSkill(exactMatch);
                      } else if (skillResults.length > 0) {
                        handleSelectSkill(skillResults[0]);
                      } else {
                        handleAddCustomSkill();
                      }
                    }
                  }}
                  className="pl-9 h-10 md:text-sm border-zinc-200 rounded-lg animate-none focus-visible:ring-emerald-500 max-md:h-10 max-md:text-base"
                />
                {isSearchingSkills && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent pointer-events-none" />
                )}

                {/* Dropdown Results list */}
                <AnimatePresence>
                  {skillDropdownOpen && (skillResults.length > 0 || skillQuery.trim().length > 0) && (
                    <motion.ul
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto overscroll-contain bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg divide-y divide-zinc-150 dark:divide-zinc-800/80"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        {skillResults.map((skill) => (
                          <motion.li
                            key={`${skill.id}-${skill.skill_name}`}
                            layout
                            initial={{ opacity: 0, y: -3 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -3 }}
                            transition={{ duration: 0.12 }}
                            onClick={() => handleSelectSkill(skill)}
                            className="px-4 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer flex items-center justify-between max-md:min-h-10"
                          >
                            <span>{skill.skill_name}</span>
                            <Plus className="h-3.5 w-3.5 text-zinc-400" />
                          </motion.li>
                        ))}
                      </AnimatePresence>
                      {skillQuery.trim().length > 0 && !skillResults.some(s => s.skill_name.toLowerCase() === skillQuery.trim().toLowerCase()) && (
                        <motion.li
                          layout
                          initial={{ opacity: 0, y: -3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.12 }}
                          onClick={handleAddCustomSkill}
                          className="px-4 py-2.5 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 cursor-pointer flex items-center justify-between font-medium border-t border-zinc-100 dark:border-zinc-800/50 max-md:min-h-10"
                        >
                          <span>+ Add &quot;{skillQuery.trim()}&quot; as a custom skill</span>
                          <Plus className="h-3.5 w-3.5" />
                        </motion.li>
                      )}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>

              {/* Suggested Skills */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-semibold text-zinc-500 block uppercase tracking-wider">
                  Suggested Skills (Click to add)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {isFetchingRecommendations ? (
                    <span className="text-xs text-zinc-400 italic">Analyzing requirements & loading suggestions...</span>
                  ) : recommendedSkills.length > 0 ? (
                    recommendedSkills.map((skill) => {
                      const isAdded = (data.skills || []).some(
                        (s) => s.skill_name.toLowerCase() === skill.skill_name.toLowerCase()
                      );
                      return (
                        <button
                          key={`${skill.id}-${skill.skill_name}`}
                          type="button"
                          onClick={() => !isAdded && handleSelectSkill(skill)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 transition-all duration-200 max-md:min-h-10
                            ${isAdded
                              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-450 border-zinc-205 dark:border-zinc-700 cursor-not-allowed opacity-50"
                              : "bg-zinc-50 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-350 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 hover:text-[#14a800] dark:hover:border-emerald-600 cursor-pointer"
                            }`}
                          disabled={isAdded}
                        >
                          {skill.skill_name}
                          {!isAdded && <Plus className="h-3 w-3" />}
                        </button>
                      );
                    })
                  ) : (
                    [
                      { id: 1050, skill_name: "Project Management" },
                      { id: 1051, skill_name: "Communication" },
                      { id: 1052, skill_name: "Problem Solving" },
                      { id: 1053, skill_name: "Teamwork" },
                      { id: 1054, skill_name: "Time Management" },
                    ].map((skill) => {
                      const isAdded = (data.skills || []).some(
                        (s) => s.skill_name.toLowerCase() === skill.skill_name.toLowerCase()
                      );
                      return (
                        <button
                          key={`${skill.id}-${skill.skill_name}`}
                          type="button"
                          onClick={() => !isAdded && handleSelectSkill(skill)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 transition-all duration-200 max-md:min-h-10
                            ${isAdded
                              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-450 border-zinc-205 dark:border-zinc-700 cursor-not-allowed opacity-50"
                              : "bg-zinc-50 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-350 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 hover:text-[#14a800] dark:hover:border-emerald-600 cursor-pointer"
                            }`}
                          disabled={isAdded}
                        >
                          {skill.skill_name}
                          {!isAdded && <Plus className="h-3 w-3" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Selected Skills Chips */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                <AnimatePresence mode="popLayout">
                  {(data.skills || []).map((skill) => (
                    <motion.div
                      key={`${skill.id}-${skill.skill_name}`}
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Badge
                        variant="secondary"
                        className="px-2.5 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-md border-0 inline-flex items-center gap-1.5 whitespace-normal break-words max-w-full text-left leading-normal h-auto"
                      >
                        <span className="break-words">{skill.skill_name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill.id)}
                          className="text-zinc-400 hover:text-rose-500 transition-colors shrink-0"
                        >
                          <X className="h-3 w-3 max-md:relative max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']" />
                        </button>
                      </Badge>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {(data.skills || []).length === 0 && (
                  <p className="text-[11px] text-zinc-400 italic">No skills selected yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Job Details */}
        {step === 2 && (
          <div className="space-y-5 animate-fadeIn px-1">
            {/* Job Description */}
            <div className="space-y-1.5">
              <Label htmlFor="jf-desc" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Job Description <span className="text-rose-500">*</span>
              </Label>
              <RichTextEditor
                id="jf-desc"
                value={data.job_description ?? ""}
                fieldType="job_description"
                jobTitle={data.job_title}
                onChange={(val) => {
                  onChange("job_description", val);
                  if (localErrors.job_description) setLocalErrors((p) => ({ ...p, job_description: "" }));
                }}
                placeholder="Describe the overall purpose of the role and team context..."
                error={!!localErrors.job_description}
              />
              {localErrors.job_description && (
                <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> {localErrors.job_description}
                </p>
              )}
            </div>

            {/* Core Responsibilities */}
            <div className="space-y-1.5">
              <Label htmlFor="jf-resp" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Core Responsibilities <span className="text-rose-500">*</span>
              </Label>
              <RichTextEditor
                id="jf-resp"
                value={data.job_responsibilities ?? ""}
                fieldType="job_responsibilities"
                jobTitle={data.job_title}
                onChange={(val) => {
                  onChange("job_responsibilities", val);
                  if (localErrors.job_responsibilities) setLocalErrors((p) => ({ ...p, job_responsibilities: "" }));
                }}
                placeholder="Outline key daily tasks, reports, and scope of responsibility..."
                error={!!localErrors.job_responsibilities}
              />
              {localErrors.job_responsibilities && (
                <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> {localErrors.job_responsibilities}
                </p>
              )}
            </div>

            {/* Qualifications & Requirements */}
            <div className="space-y-1.5">
              <Label htmlFor="jf-quals" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Qualifications & Requirements <span className="text-rose-500">*</span>
              </Label>
              <RichTextEditor
                id="jf-quals"
                value={data.job_qualifications ?? ""}
                fieldType="job_qualifications"
                jobTitle={data.job_title}
                onChange={(val) => {
                  onChange("job_qualifications", val);
                  if (localErrors.job_qualifications) setLocalErrors((p) => ({ ...p, job_qualifications: "" }));
                }}
                placeholder="List required skills, education, and years of experience..."
                error={!!localErrors.job_qualifications}
              />
              {localErrors.job_qualifications && (
                <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> {localErrors.job_qualifications}
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Salary and Benefits */}
        {step === 3 && (
          <div className="space-y-5 animate-fadeIn px-1">
            {/* Salary details card */}
            <div className="space-y-4 p-5 bg-zinc-50/50 dark:bg-zinc-900/35 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 flex items-center gap-1.5">
                  <CircleDollarSign className="h-4 w-4 text-emerald-600" /> Salary Information
                </Label>
                <div className="flex items-center gap-2 max-md:min-h-10">
                  <Checkbox
                    id="jf-negotiable"
                    checked={data.salary_negotiable}
                    onCheckedChange={(v) => {
                      onChange("salary_negotiable", Boolean(v));
                      if (localErrors.salary_info) setLocalErrors((p) => ({ ...p, salary_info: "" }));
                    }}
                  />
                  <Label htmlFor="jf-negotiable" className="text-xs font-semibold text-zinc-650 dark:text-zinc-350 cursor-pointer">
                    Salary is negotiable / undisclosed
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Salary Structure</Label>
                  <Select
                    value={data.salary_type || "Salary Range"}
                    onValueChange={(v) => {
                      onChange("salary_type", v);
                      // Clear max salary if not a range type
                      if (v !== "Salary Range") {
                        onChange("salary_max", "");
                      }
                      if (localErrors.salary_info) setLocalErrors((p) => ({ ...p, salary_info: "" }));
                    }}
                    disabled={data.salary_negotiable}
                  >
                    <SelectTrigger className="h-10 md:text-sm border-zinc-200 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Salary Range", "Fixed Salary", "Hourly Rate"].map((t) => (
                        <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* If Fixed Salary */}
                {(data.salary_type === "Fixed Salary") && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="jf-sal-min" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Salary Amount (₱)</Label>
                    <Input
                      id="jf-sal-min"
                      type="number"
                      min={0}
                      value={data.salary_min ?? ""}
                      onChange={(e) => {
                        onChange("salary_min", e.target.value);
                        if (localErrors.salary_info) setLocalErrors((p) => ({ ...p, salary_info: "" }));
                      }}
                      placeholder="e.g. 35000"
                      disabled={data.salary_negotiable}
                      className="h-10 md:text-sm border-zinc-200 rounded-lg max-md:h-10 max-md:text-base"
                    />
                  </div>
                )}

                {/* If Hourly Rate */}
                {(data.salary_type === "Hourly Rate") && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="jf-sal-min" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Hourly Rate (₱ / hr)</Label>
                    <Input
                      id="jf-sal-min"
                      type="number"
                      min={0}
                      value={data.salary_min ?? ""}
                      onChange={(e) => {
                        onChange("salary_min", e.target.value);
                        if (localErrors.salary_info) setLocalErrors((p) => ({ ...p, salary_info: "" }));
                      }}
                      placeholder="e.g. 500"
                      disabled={data.salary_negotiable}
                      className="h-10 md:text-sm border-zinc-200 rounded-lg max-md:h-10 max-md:text-base"
                    />
                  </div>
                )}

                {/* If Salary Range */}
                {(data.salary_type === "Salary Range" || !data.salary_type) && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="jf-sal-min" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Minimum Salary (₱)</Label>
                      <Input
                        id="jf-sal-min"
                        type="number"
                        min={0}
                        value={data.salary_min ?? ""}
                        onChange={(e) => {
                          onChange("salary_min", e.target.value);
                          if (localErrors.salary_info) setLocalErrors((p) => ({ ...p, salary_info: "" }));
                        }}
                        placeholder="e.g. 25000"
                        disabled={data.salary_negotiable}
                        className="h-10 md:text-sm border-zinc-200 rounded-lg max-md:h-10 max-md:text-base"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="jf-sal-max" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Maximum Salary (₱)</Label>
                      <Input
                        id="jf-sal-max"
                        type="number"
                        min={0}
                        value={data.salary_max ?? ""}
                        onChange={(e) => {
                          onChange("salary_max", e.target.value);
                          if (localErrors.salary_info) setLocalErrors((p) => ({ ...p, salary_info: "" }));
                        }}
                        placeholder="e.g. 50000"
                        disabled={data.salary_negotiable}
                        className="h-10 md:text-sm border-zinc-200 rounded-lg max-md:h-10 max-md:text-base"
                      />
                    </div>
                  </>
                )}
              </div>

              {localErrors.salary_info && (
                <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {localErrors.salary_info}
                </p>
              )}
            </div>

            {/* Benefits selector list */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Company Benefits / Incentives
              </Label>
              <div className="space-y-4 p-4 bg-zinc-50/50 dark:bg-zinc-900/35 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allBenefits.map((benefit) => (
                    <label key={benefit} className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none max-md:min-h-10">
                      <Checkbox
                        checked={(data.benefits || []).includes(benefit)}
                        onCheckedChange={() => handleToggleBenefit(benefit)}
                        className="mt-0.5"
                      />
                      <span>{benefit}</span>
                    </label>
                  ))}
                </div>

                {/* Custom Benefit Input */}
                <div className="flex gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <Input
                    type="text"
                    placeholder="Add other custom benefit (e.g., Free Lunch, Stock Options)..."
                    value={customBenefitInput}
                    onChange={(e) => setCustomBenefitInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomBenefit();
                      }
                    }}
                    className="h-10 md:text-sm border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg max-w-md max-md:h-10 max-md:text-base"
                  />
                  <Button
                    type="button"
                    onClick={handleAddCustomBenefit}
                    className="h-10 px-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-350 hover:bg-zinc-200 rounded-lg border-0 shadow-none text-xs flex items-center gap-1.5 shrink-0 max-md:min-h-10"
                  >
                    <Plus className="h-4 w-4" /> Add Benefit
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Candidate Screening */}
        {step === 4 && (
          <div className="space-y-5 animate-fadeIn px-1">
            {/* Experience & Education */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="jf-exp" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Target Experience Level
                </Label>
                <SearchableSelect
                  options={EXP_LEVEL_OPTIONS}
                  value={data.experience_level || "MID"}
                  onValueChange={(v) => onChange("experience_level", v as ExperienceLevel)}
                  placeholder="Select Level"
                  className="h-10 md:text-sm border-zinc-200 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="jf-education" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Minimum Education Required
                </Label>
                <SearchableSelect
                  options={EDUCATION_SELECT_OPTIONS}
                  value={data.education || "Bachelor's Degree Graduate"}
                  onValueChange={(v) => onChange("education", v)}
                  placeholder="Select Minimum Education"
                  className="h-10 md:text-sm border-zinc-200 rounded-lg"
                />
              </div>
            </div>

            {/* Screening Questions List Creator */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <HelpCircle className="h-4 w-4 text-emerald-600" /> Candidate Screening Questions <span className="text-zinc-400 font-normal">(Optional)</span>
              </div>

              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="e.g. How many years of experience do you have in Next.js?"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddQuestion())}
                  className="h-10 md:text-sm border-zinc-200 rounded-lg max-md:h-10 max-md:text-base"
                />
                <Button
                  type="button"
                  onClick={handleAddQuestion}
                  className="h-10 px-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-350 hover:bg-zinc-200 rounded-lg border-0 shadow-none flex items-center gap-1.5 max-md:min-h-10"
                >
                  <PlusCircle className="h-4 w-4" /> Add
                </Button>
              </div>

              {/* Questions Stack */}
              <div className="space-y-2 mt-3">
                {(data.screening_questions || []).map((q, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                  >
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate pr-4">
                      {index + 1}. &quot;{q}&quot;
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveQuestion(index)}
                      className="h-7 w-7 text-zinc-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/20 max-md:size-10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                {(data.screening_questions || []).length === 0 && (
                  <p className="text-[11px] text-zinc-400 italic text-center py-4">
                    No custom screening questions added yet. Candidates can apply directly.
                  </p>
                )}
              </div>
            </div>

            {/* ATS Hiring Pipeline Snapshot & Customization */}
            <div className="pt-2">
              <JobPipelineSection
                jobId={data.job_id ?? null}
                selectedSourcePipelineId={data.source_pipeline_id ?? null}
                onSourcePipelineChange={(pipeId) => onChange("source_pipeline_id", pipeId ?? null)}
              />
            </div>
          </div>
        )}

        {/* STEP 5: Preview and Publish */}
        {step === 5 && (
          <div className="space-y-5 animate-fadeIn px-1">
            {/* Visual Header Banner */}
            <div className="p-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-white dark:bg-zinc-900 shadow-md flex items-center justify-center shrink-0 overflow-hidden border border-border/80 relative">
                {companyLogoUrl ? (
                  <Image
                    src={companyLogoUrl}
                    alt={companyProfile?.company_name || "Company Logo"}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building className="h-6 w-6 text-emerald-500" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 truncate">
                    {data.job_title || "Untitled Job Posting"}
                  </h3>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-0 text-[10px] font-bold uppercase tracking-wider">
                    Preview Mode
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1 font-medium"><MapPin className="h-3 w-3" /> {data.job_location || "Location undisclosed"}</span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1 font-medium"><Briefcase className="h-3 w-3" /> {data.job_type ? JOB_TYPE_LABELS[data.job_type] : "Type undisclosed"}</span>
                  {data.job_category && (
                    <>
                      <span>&bull;</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{data.job_category}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Grid details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Left/Middle Column Details */}
              <div className="md:col-span-2 min-w-0 space-y-4">
                {/* Description */}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Job Description</h4>
                  {renderFormattedContent(data.job_description)}
                </div>

                {/* Responsibilities */}
                {data.job_responsibilities && (
                  <div className="space-y-1 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Key Responsibilities</h4>
                    {renderFormattedContent(data.job_responsibilities)}
                  </div>
                )}

                {/* Qualifications */}
                <div className="space-y-1 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Requirements & Qualifications</h4>
                  {renderFormattedContent(data.job_qualifications)}
                </div>
              </div>

              {/* Right Column Highlights */}
              <div className="md:col-span-1 min-w-0 space-y-4 p-4 bg-zinc-50/50 dark:bg-zinc-900/35 border border-zinc-150 dark:border-zinc-800/80 rounded-xl h-fit">
                {/* Salary */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Compensation</span>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {data.salary_negotiable
                      ? "Negotiable / Undisclosed"
                      : `${data.salary_type || "Range"}: ${data.salary_min ? `₱${Number(data.salary_min).toLocaleString()}` : "—"} ${data.salary_max ? `to ₱${Number(data.salary_max).toLocaleString()}` : ""
                      }`}
                  </p>
                </div>

                {/* Details */}
                <div className="space-y-2 pt-3 border-t border-zinc-150 dark:border-zinc-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Openings</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{data.number_of_openings || "1"}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Arrangement</span>
                    <span className="font-semibold text-[#14a800]">{data.work_arrangement || "Remote"}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Target Experience</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {data.experience_level ? EXPERIENCE_LEVEL_LABELS[data.experience_level] : "Undisclosed"}
                    </span>
                  </div>
                  {data.education && (
                    <div className="flex flex-col gap-0.5 pt-1 text-xs">
                      <span className="text-zinc-500 flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> Education</span>
                      <span className="font-semibold text-zinc-850 dark:text-zinc-250 truncate">{data.education}</span>
                    </div>
                  )}
                </div>

                {/* Skills */}
                {(data.skills || []).length > 0 && (
                  <div className="space-y-1.5 pt-3 border-t border-zinc-150 dark:border-zinc-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Skills Required</span>
                    <div className="flex flex-wrap gap-1">
                      {(data.skills || []).map((s) => (
                        <Badge
                          key={s.id}
                          variant="secondary"
                          className="px-2 py-1 text-[10px] font-medium rounded whitespace-normal break-words max-w-full text-left leading-snug h-auto"
                        >
                          {s.skill_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Benefits */}
                {(data.benefits || []).length > 0 && (
                  <div className="space-y-1.5 pt-3 border-t border-zinc-150 dark:border-zinc-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Benefits</span>
                    <ul className="text-[10px] text-zinc-600 dark:text-zinc-400 space-y-1 list-disc pl-3">
                      {(data.benefits || []).map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
        <div>
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrev}
              disabled={saving}
              className="h-10 px-4 text-xs font-semibold rounded-xl flex items-center gap-1.5 max-md:min-h-10"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={saving}
              className="h-10 px-4 text-xs font-semibold rounded-xl max-md:min-h-10"
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {step < 5 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="h-10 px-5 text-xs font-semibold rounded-xl bg-[#14a800] hover:bg-[#118f00] text-white border-0 shadow-sm flex items-center gap-1.5 max-md:min-h-10"
            >
              Next <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleFinalSubmit}
              disabled={saving}
              className="h-10 px-6 text-xs font-semibold rounded-xl bg-[#14a800] hover:bg-[#118f00] text-white border-0 shadow-sm flex items-center gap-1.5 max-md:min-h-10"
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  {editingJob ? "Save Changes" : "Create Posting"}
                  <Check className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <SuggestCategoryModal
        open={suggestCategoryModalOpen}
        onOpenChange={setSuggestCategoryModalOpen}
        initialQuery={categorySearchQuery}
        jobId={data.job_id ?? null}
        onSelectCategory={(catId, catName) => {
          if (catId) {
            onChange("category_id", catId);
          } else {
            onChange("category_id", null);
          }
          onChange("job_category", catName);
          if (localErrors.job_category) setLocalErrors((p) => ({ ...p, job_category: "" }));
        }}
      />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 220ms ease-out forwards;
        }
      `}</style>
    </div>
  );
}
