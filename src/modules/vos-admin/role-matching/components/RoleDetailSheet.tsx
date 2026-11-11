"use client";

// src/modules/vos-admin/role-matching/components/RoleDetailSheet.tsx

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Briefcase,
  CheckCircle2,
  Search,
  Plus,
 
  Edit2,
  ShieldAlert,
  Loader2,
  Check,
  Bot,
  RefreshCw,
  Power,
  Pencil,
  CheckSquare,
  // Square,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  StandardRole,
  JobCategory,
  RoleSkillMapping,
  SearchKeyword,
  MasterSkill,
  ExperienceLevel,
} from "../types";
import { normalizeKeyword } from "../validators";
import { useRequestAbort } from "@/hooks/useRequestAbort";

interface RoleDetailSheetProps {
  role: StandardRole | null;
  categories: JobCategory[];
  skills: RoleSkillMapping[];
  keywords: SearchKeyword[];
  masterSkills: MasterSkill[];
  open: boolean;
  onClose: () => void;
  onUpdateRole: (role: Partial<StandardRole>) => Promise<boolean>;
  onAddSkill: (payload: Partial<RoleSkillMapping>) => Promise<boolean>;
  onEditSkill: (payload: Partial<RoleSkillMapping>) => Promise<boolean>;
  onRemoveSkill: (id: number) => Promise<boolean>;
  onAddKeyword: (payload: Partial<SearchKeyword>) => Promise<boolean>;
  onEditKeyword?: (payload: Partial<SearchKeyword>) => Promise<boolean>;
  onRemoveKeyword: (aliasId: number) => Promise<boolean>;
}

const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "ENTRY", label: "Entry Level" },
  { value: "MID", label: "Mid Level" },
  { value: "SENIOR", label: "Senior Level" },
  { value: "LEAD", label: "Lead / Manager" },
  { value: "EXECUTIVE", label: "Executive / Director" },
];

function isActiveStatus(val: unknown): boolean {
  return val !== false && val !== 0 && val !== "0" && val !== "false";
}

export function RoleDetailSheet({
  role,
  categories,
  skills,
  keywords,
  masterSkills,
  open,
  onClose,
  onUpdateRole,
  onAddSkill,
  onEditSkill,
  onRemoveSkill,
  onAddKeyword,
  onEditKeyword,
  onRemoveKeyword,
}: RoleDetailSheetProps) {
  // Active Tab
  const [activeTab, setActiveTab] = useState<"SKILLS" | "KEYWORDS" | "SETTINGS">("SKILLS");

  // Edit Role State
  const [roleNameInput, setRoleNameInput] = useState(role?.role_name || "");
  const [expLevelInput, setExpLevelInput] = useState<ExperienceLevel>(role?.experience_level || "MID");
  const [catIdInput, setCatIdInput] = useState<number>(role?.category_id || 1);
  const [roleSaving, setRoleSaving] = useState(false);

  // Add Skill Modal State
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<number | "">("");
  const [customSkillName, setCustomSkillName] = useState("");
  const [skillWeight, setSkillWeight] = useState("0.90");
  const [isSkillRequired, setIsSkillRequired] = useState(true);
  const [skillSaving, setSkillSaving] = useState(false);

  // Add Keyword Modal State
  const [keywordModalOpen, setKeywordModalOpen] = useState(false);
  const [aliasNameInput, setAliasNameInput] = useState("");
  const [keywordWeight, setKeywordWeight] = useState("0.90");
  const [isKeywordPrimary, setIsKeywordPrimary] = useState(false);
  const [keywordSaving, setKeywordSaving] = useState(false);

  // Edit Skill Modal State
  const [editingSkillTarget, setEditingSkillTarget] = useState<RoleSkillMapping | null>(null);
  const [editSkillWeight, setEditSkillWeight] = useState("0.90");
  const [editSkillRequired, setEditSkillRequired] = useState(true);
  const [editSkillSaving, setEditSkillSaving] = useState(false);

  // Edit Keyword Modal State
  const [editingKeywordTarget, setEditingKeywordTarget] = useState<SearchKeyword | null>(null);
  const [editAliasName, setEditAliasName] = useState("");
  const [editKeywordWeight, setEditKeywordWeight] = useState("0.90");
  const [editKeywordPrimary, setEditKeywordPrimary] = useState(false);
  const [editKeywordSaving, setEditKeywordSaving] = useState(false);

  // Multiple Delete States
  const [isBulkDeleteSkillMode, setIsBulkDeleteSkillMode] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<number>>(new Set());
  const [isBulkDeletingSkills, setIsBulkDeletingSkills] = useState(false);
  const [isBulkUpdatingSkills, setIsBulkUpdatingSkills] = useState(false);
  const [bulkDeleteSkillsConfirmOpen, setBulkDeleteSkillsConfirmOpen] = useState(false);

  const [isBulkDeleteKwMode, setIsBulkDeleteKwMode] = useState(false);
  const [selectedKwIds, setSelectedKwIds] = useState<Set<number>>(new Set());
  const [isBulkDeletingKws, setIsBulkDeletingKws] = useState(false);
  const [isBulkUpdatingKws, setIsBulkUpdatingKws] = useState(false);
  const [bulkDeleteKwConfirmOpen, setBulkDeleteKwConfirmOpen] = useState(false);

  // Drag-to-select Checkbox Refs
  const isDragSelectingSkills = useRef(false);
  const skillDragTargetValue = useRef<boolean>(true);
  const isDragSelectingKws = useRef(false);
  const kwDragTargetValue = useRef<boolean>(true);

  // Global mouseup listener for drag-selection
  useEffect(() => {
    const handleMouseUp = () => {
      isDragSelectingSkills.current = false;
      isDragSelectingKws.current = false;
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Filter Tabs States
  const [skillFilterTab, setSkillFilterTab] = useState<"ALL" | "REQUIRED" | "ACTIVE" | "INACTIVE">("ALL");
  const [kwFilterTab, setKwFilterTab] = useState<"ALL" | "PRIMARY" | "ACTIVE" | "INACTIVE">("ALL");

  // AI Generator States
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiType, setAiType] = useState<"SKILLS" | "KEYWORDS">("SKILLS");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiItems, setAiItems] = useState<{
    label: string;
    weight: number;
    is_required?: boolean;
    matched_master_id?: number | null;
    is_new?: boolean;
  }[]>([]);
  const [selectedAiItems, setSelectedAiItems] = useState<Set<string>>(new Set());
  const abortAi = useRequestAbort();
  const [aiBulkSaving, setAiBulkSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Session-scoped history of shown suggestions (capped at 25 items)
  const [sessionSkillsHistory, setSessionSkillsHistory] = useState<string[]>([]);
  const [sessionKeywordsHistory, setSessionKeywordsHistory] = useState<string[]>([]);

  // Sync role state when role changes
  React.useEffect(() => {
    if (role) {
      // This sheet is not keyed by role, so a generation started for the
      // previous role would otherwise render into the new one — and its Apply
      // button writes to `role.role_id`, which has already moved on.
      abortAi();
      queueMicrotask(() => {
        setRoleNameInput(role.role_name);
        setExpLevelInput(role.experience_level || "MID");
        setCatIdInput(role.category_id || 1);
        setErrorMessage("");
        setSessionSkillsHistory([]);
        setSessionKeywordsHistory([]);
        setAiItems([]);
        setSelectedAiItems(new Set());
        setAiModalOpen(false);
        setIsBulkDeleteSkillMode(false);
        setSelectedSkillIds(new Set());
        setIsBulkDeleteKwMode(false);
        setSelectedKwIds(new Set());
        setEditingSkillTarget(null);
        setEditingKeywordTarget(null);
        setSkillFilterTab("ALL");
        setKwFilterTab("ALL");
      });
    }
  }, [role, abortAi]);

  // Radix unmounts the sheet content when it closes but keeps this component
  // alive, so an open AI panel would reappear over whichever role opens next.
  React.useEffect(() => {
    if (open) return;
    abortAi();
    queueMicrotask(() => {
      setAiModalOpen(false);
      setAiItems([]);
      setSelectedAiItems(new Set());
      setAiError(null);
      setIsBulkDeleteSkillMode(false);
      setSelectedSkillIds(new Set());
      setIsBulkDeleteKwMode(false);
      setSelectedKwIds(new Set());
      setEditingSkillTarget(null);
      setEditingKeywordTarget(null);
    });
  }, [open, abortAi]);

  // Filter skills and keywords for this specific role
  const roleSkills = useMemo(
    () => (role ? skills.filter((s) => s.role_id === role.role_id) : []),
    [skills, role]
  );
  const roleKeywords = useMemo(
    () => (role ? keywords.filter((k) => k.role_id === role.role_id) : []),
    [keywords, role]
  );

  // Search & Pagination States
  const [skillSearch, setSkillSearch] = useState("");
  const [skillPage, setSkillPage] = useState(1);
  const [kwSearch, setKwSearch] = useState("");
  const [kwPage, setKwPage] = useState(1);
  const pageSize = 10;

  // Deletion Target States for Confirmation Dialog
  const [deleteSkillTarget, setDeleteSkillTarget] = useState<RoleSkillMapping | null>(null);
  const [deleteKeywordTarget, setDeleteKeywordTarget] = useState<SearchKeyword | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Counts for Filter Tabs
  const skillCounts = useMemo(() => {
    let required = 0;
    let active = 0;
    let inactive = 0;
    for (const s of roleSkills) {
      if (s.is_required) required++;
      if (isActiveStatus(s.is_active)) active++;
      else inactive++;
    }
    return { all: roleSkills.length, required, active, inactive };
  }, [roleSkills]);

  const kwCounts = useMemo(() => {
    let primary = 0;
    let active = 0;
    let inactive = 0;
    for (const k of roleKeywords) {
      if (k.is_primary) primary++;
      if (isActiveStatus(k.is_active)) active++;
      else inactive++;
    }
    return { all: roleKeywords.length, primary, active, inactive };
  }, [roleKeywords]);

  // Filtered & Inactive-Last Sorted Skills
  const filteredAndSortedSkills = useMemo(() => {
    let list = roleSkills;

    if (skillFilterTab === "REQUIRED") {
      list = list.filter((s) => Boolean(s.is_required));
    } else if (skillFilterTab === "ACTIVE") {
      list = list.filter((s) => isActiveStatus(s.is_active));
    } else if (skillFilterTab === "INACTIVE") {
      list = list.filter((s) => !isActiveStatus(s.is_active));
    }

    if (skillSearch.trim()) {
      const q = skillSearch.toLowerCase().trim();
      list = list.filter((s) => (s.skill_name || "").toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const aActive = isActiveStatus(a.is_active);
      const bActive = isActiveStatus(b.is_active);
      if (aActive === bActive) return Number(b.importance_weight ?? 1) - Number(a.importance_weight ?? 1);
      return aActive ? -1 : 1;
    });
  }, [roleSkills, skillFilterTab, skillSearch]);

  const totalSkillPages = Math.max(1, Math.ceil(filteredAndSortedSkills.length / pageSize));
  const safeSkillPage = Math.min(skillPage, totalSkillPages);
  const paginatedSkills = useMemo(() => {
    const start = (safeSkillPage - 1) * pageSize;
    return filteredAndSortedSkills.slice(start, start + pageSize);
  }, [filteredAndSortedSkills, safeSkillPage, pageSize]);

  // Filtered & Inactive-Last Sorted Keywords
  const filteredAndSortedKeywords = useMemo(() => {
    let list = roleKeywords;

    if (kwFilterTab === "PRIMARY") {
      list = list.filter((k) => Boolean(k.is_primary));
    } else if (kwFilterTab === "ACTIVE") {
      list = list.filter((k) => isActiveStatus(k.is_active));
    } else if (kwFilterTab === "INACTIVE") {
      list = list.filter((k) => !isActiveStatus(k.is_active));
    }

    if (kwSearch.trim()) {
      const q = kwSearch.toLowerCase().trim();
      list = list.filter((k) => (k.alias_name || "").toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const aActive = isActiveStatus(a.is_active);
      const bActive = isActiveStatus(b.is_active);
      if (aActive === bActive) return Number(b.match_weight ?? 1) - Number(a.match_weight ?? 1);
      return aActive ? -1 : 1;
    });
  }, [roleKeywords, kwFilterTab, kwSearch]);

  const totalKwPages = Math.max(1, Math.ceil(filteredAndSortedKeywords.length / pageSize));
  const safeKwPage = Math.min(kwPage, totalKwPages);
  const paginatedKeywords = useMemo(() => {
    const start = (safeKwPage - 1) * pageSize;
    return filteredAndSortedKeywords.slice(start, start + pageSize);
  }, [filteredAndSortedKeywords, safeKwPage, pageSize]);

  const handleConfirmDeleteSkill = async () => {
    if (!deleteSkillTarget) return;
    setIsDeletingItem(true);
    const ok = await onRemoveSkill(deleteSkillTarget.id);
    setIsDeletingItem(false);
    if (ok) {
      toast.success(`Skill "${deleteSkillTarget.skill_name}" deleted.`);
      setDeleteSkillTarget(null);
    }
  };

  const handleConfirmDeleteKeyword = async () => {
    if (!deleteKeywordTarget) return;
    setIsDeletingItem(true);
    const ok = await onRemoveKeyword(deleteKeywordTarget.alias_id);
    setIsDeletingItem(false);
    if (ok) {
      toast.success(`Keyword "${deleteKeywordTarget.alias_name}" deleted.`);
      setDeleteKeywordTarget(null);
    }
  };

  // Toggle Active State Handlers
  const handleToggleSkillActive = async (s: RoleSkillMapping) => {
    const currentActive = isActiveStatus(s.is_active);
    const ok = await onEditSkill({ id: s.id, is_active: !currentActive });
    if (ok) {
      toast.success(`Skill "${s.skill_name || "Skill"}" marked as ${!currentActive ? "Active" : "Inactive"}.`);
    }
  };

  const handleToggleKeywordActive = async (kw: SearchKeyword) => {
    if (!onEditKeyword) return;
    const currentActive = isActiveStatus(kw.is_active);
    const ok = await onEditKeyword({ alias_id: kw.alias_id, is_active: !currentActive });
    if (ok) {
      toast.success(`Keyword "${kw.alias_name}" marked as ${!currentActive ? "Active" : "Inactive"}.`);
    }
  };

  // Edit Handlers
  const openEditSkillModal = (s: RoleSkillMapping) => {
    setEditingSkillTarget(s);
    setEditSkillWeight(String(s.importance_weight ?? "0.90"));
    setEditSkillRequired(Boolean(s.is_required));
    setErrorMessage("");
  };

  const handleSaveEditSkill = async () => {
    if (!editingSkillTarget) return;
    const w = parseFloat(editSkillWeight);
    if (isNaN(w) || w < 0 || w > 1) {
      setErrorMessage("Importance weight must be between 0.0 and 1.0.");
      return;
    }
    setEditSkillSaving(true);
    const ok = await onEditSkill({
      id: editingSkillTarget.id,
      importance_weight: w,
      is_required: editSkillRequired,
    });
    setEditSkillSaving(false);
    if (ok) {
      toast.success(`Skill "${editingSkillTarget.skill_name}" updated.`);
      setEditingSkillTarget(null);
    }
  };

  const openEditKeywordModal = (kw: SearchKeyword) => {
    setEditingKeywordTarget(kw);
    setEditAliasName(kw.alias_name);
    setEditKeywordWeight(String(kw.match_weight ?? "0.90"));
    setEditKeywordPrimary(Boolean(kw.is_primary));
    setErrorMessage("");
  };

  const handleSaveEditKeyword = async () => {
    if (!editingKeywordTarget || !onEditKeyword) return;
    const alias = editAliasName.trim();
    if (!alias) {
      setErrorMessage("Keyword alias is required.");
      return;
    }
    const w = parseFloat(editKeywordWeight);
    if (isNaN(w) || w < 0 || w > 1) {
      setErrorMessage("Match weight must be between 0.0 and 1.0.");
      return;
    }
    setEditKeywordSaving(true);
    const ok = await onEditKeyword({
      alias_id: editingKeywordTarget.alias_id,
      alias_name: alias,
      normalized_alias: normalizeKeyword(alias),
      match_weight: w,
      is_primary: editKeywordPrimary,
    });
    setEditKeywordSaving(false);
    if (ok) {
      toast.success(`Keyword "${alias}" updated.`);
      setEditingKeywordTarget(null);
    }
  };

  // Bulk Deletion Handlers
  const handleToggleSelectAllSkills = () => {
    if (selectedSkillIds.size === filteredAndSortedSkills.length) {
      setSelectedSkillIds(new Set());
    } else {
      setSelectedSkillIds(new Set(filteredAndSortedSkills.map((s) => s.id)));
    }
  };

  const handleConfirmBulkDeleteSkills = async () => {
    if (selectedSkillIds.size === 0) return;
    setIsBulkDeletingSkills(true);
    let successCount = 0;
    const ids = Array.from(selectedSkillIds);
    for (const id of ids) {
      const ok = await onRemoveSkill(id);
      if (ok) successCount++;
    }
    setIsBulkDeletingSkills(false);
    setBulkDeleteSkillsConfirmOpen(false);
    setSelectedSkillIds(new Set());
    setIsBulkDeleteSkillMode(false);
    if (successCount > 0) {
      toast.success(`${successCount} skill${successCount > 1 ? "s" : ""} deleted.`);
    }
  };

  const handleBulkSetSkillActive = async (targetActive: boolean) => {
    if (selectedSkillIds.size === 0) return;
    setIsBulkUpdatingSkills(true);
    let successCount = 0;
    const ids = Array.from(selectedSkillIds);
    for (const id of ids) {
      const ok = await onEditSkill({ id, is_active: targetActive });
      if (ok) successCount++;
    }
    setIsBulkUpdatingSkills(false);
    if (successCount > 0) {
      toast.success(
        `${successCount} skill${successCount > 1 ? "s" : ""} marked as ${
          targetActive ? "Active" : "Inactive"
        }.`
      );
      setSelectedSkillIds(new Set());
    }
  };

  const handleToggleSelectAllKeywords = () => {
    if (selectedKwIds.size === filteredAndSortedKeywords.length) {
      setSelectedKwIds(new Set());
    } else {
      setSelectedKwIds(new Set(filteredAndSortedKeywords.map((k) => k.alias_id)));
    }
  };

  const handleConfirmBulkDeleteKeywords = async () => {
    if (selectedKwIds.size === 0) return;
    setIsBulkDeletingKws(true);
    let successCount = 0;
    const ids = Array.from(selectedKwIds);
    for (const id of ids) {
      const ok = await onRemoveKeyword(id);
      if (ok) successCount++;
    }
    setIsBulkDeletingKws(false);
    setBulkDeleteKwConfirmOpen(false);
    setSelectedKwIds(new Set());
    setIsBulkDeleteKwMode(false);
    if (successCount > 0) {
      toast.success(`${successCount} keyword${successCount > 1 ? "s" : ""} deleted.`);
    }
  };

  const handleBulkSetKeywordActive = async (targetActive: boolean) => {
    if (selectedKwIds.size === 0 || !onEditKeyword) return;
    setIsBulkUpdatingKws(true);
    let successCount = 0;
    const ids = Array.from(selectedKwIds);
    for (const id of ids) {
      const ok = await onEditKeyword({ alias_id: id, is_active: targetActive });
      if (ok) successCount++;
    }
    setIsBulkUpdatingKws(false);
    if (successCount > 0) {
      toast.success(
        `${successCount} keyword${successCount > 1 ? "s" : ""} marked as ${
          targetActive ? "Active" : "Inactive"
        }.`
      );
      setSelectedKwIds(new Set());
    }
  };

  // Drag-to-select Handlers for Skills
  const handleSkillCheckboxMouseDown = (id: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const isCurrentlyChecked = selectedSkillIds.has(id);
    const targetVal = !isCurrentlyChecked;
    isDragSelectingSkills.current = true;
    skillDragTargetValue.current = targetVal;
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (targetVal) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSkillCheckboxMouseEnter = (id: number) => {
    if (!isDragSelectingSkills.current) return;
    const targetVal = skillDragTargetValue.current;
    setSelectedSkillIds((prev) => {
      if (targetVal && !prev.has(id)) {
        const next = new Set(prev);
        next.add(id);
        return next;
      } else if (!targetVal && prev.has(id)) {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }
      return prev;
    });
  };

  // Drag-to-select Handlers for Keywords
  const handleKwCheckboxMouseDown = (aliasId: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const isCurrentlyChecked = selectedKwIds.has(aliasId);
    const targetVal = !isCurrentlyChecked;
    isDragSelectingKws.current = true;
    kwDragTargetValue.current = targetVal;
    setSelectedKwIds((prev) => {
      const next = new Set(prev);
      if (targetVal) next.add(aliasId);
      else next.delete(aliasId);
      return next;
    });
  };

  const handleKwCheckboxMouseEnter = (aliasId: number) => {
    if (!isDragSelectingKws.current) return;
    const targetVal = kwDragTargetValue.current;
    setSelectedKwIds((prev) => {
      if (targetVal && !prev.has(aliasId)) {
        const next = new Set(prev);
        next.add(aliasId);
        return next;
      } else if (!targetVal && prev.has(aliasId)) {
        const next = new Set(prev);
        next.delete(aliasId);
        return next;
      }
      return prev;
    });
  };

  if (!role) return null;

  // ── Role Settings Save ──────────────────────────────────────────────────────
  const handleSaveRole = async () => {
    if (!roleNameInput.trim()) {
      setErrorMessage("Role name is required.");
      return;
    }
    setRoleSaving(true);
    setErrorMessage("");
    await onUpdateRole({
      role_id: role.role_id,
      role_name: roleNameInput.trim(),
      experience_level: expLevelInput,
      category_id: catIdInput,
    });
    setRoleSaving(false);
  };

  const handleToggleRoleActive = async () => {
    if (!role) return;
    const updated = role.is_active === false;
    setRoleSaving(true);
    const ok = await onUpdateRole({
      role_id: role.role_id,
      is_active: updated,
    });
    setRoleSaving(false);
    if (ok) {
      toast.success(`Role marked as ${updated ? "Active" : "Inactive"}.`);
    }
  };

  // ── Add Single Skill ────────────────────────────────────────────────────────
  const handleCreateSkill = async () => {
    const w = parseFloat(skillWeight);
    if (isNaN(w) || w < 0 || w > 1) {
      setErrorMessage("Importance weight must be between 0.0 and 1.0.");
      return;
    }

    let finalSkillId = typeof selectedSkillId === "number" ? selectedSkillId : null;

    setSkillSaving(true);
    setErrorMessage("");

    try {
      // If custom skill entered
      if (!finalSkillId && customSkillName.trim()) {
        const createRes = await fetch("/api/vos-admin/job-roles/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ create_master: true, skill_name: customSkillName.trim() }),
        });
        if (createRes.ok) {
          const masterJson = await createRes.json();
          finalSkillId = masterJson.id;
        } else {
          // Without this the sheet answered a failed master-skill write with
          // "select or enter a valid skill", as if the admin had typed nothing.
          const errJson = await createRes.json().catch(() => null);
          setErrorMessage(
            typeof errJson?.error === "string" ? errJson.error : `"${customSkillName.trim()}" could not be added to the master skill list.`
          );
          setSkillSaving(false);
          return;
        }
      }

      if (!finalSkillId) {
        setErrorMessage("Please select or enter a valid skill.");
        setSkillSaving(false);
        return;
      }

      const selectedMaster = masterSkills.find((m) => m.id === finalSkillId);
      const skillName = customSkillName.trim() || selectedMaster?.skill_name;

      const ok = await onAddSkill({
        role_id: role.role_id,
        skill_id: finalSkillId,
        skill_name: skillName,
        importance_weight: w,
        is_required: isSkillRequired,
      });

      if (ok) {
        setSkillModalOpen(false);
        setSelectedSkillId("");
        setCustomSkillName("");
        setSkillWeight("0.90");
        setIsSkillRequired(true);
      }
      // A rejected save is toasted with the reason from the route; repeating it
      // here would show the same failure twice.
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "The skill could not be saved.");
    } finally {
      setSkillSaving(false);
    }
  };

  // ── Add Single Keyword ──────────────────────────────────────────────────────
  const handleCreateKeyword = async () => {
    const alias = aliasNameInput.trim();
    if (!alias) {
      setErrorMessage("Keyword alias is required.");
      return;
    }
    const w = parseFloat(keywordWeight);
    if (isNaN(w) || w < 0 || w > 1) {
      setErrorMessage("Match weight must be between 0.0 and 1.0.");
      return;
    }

    setKeywordSaving(true);
    setErrorMessage("");

    const ok = await onAddKeyword({
      role_id: role.role_id,
      alias_name: alias,
      normalized_alias: normalizeKeyword(alias),
      match_weight: w,
      is_primary: isKeywordPrimary,
    });

    setKeywordSaving(false);
    if (ok) {
      setKeywordModalOpen(false);
      setAliasNameInput("");
      setKeywordWeight("0.90");
      setIsKeywordPrimary(false);
    }
  };

  // ── AI Suggestion Trigger ───────────────────────────────────────────────────
  const handleOpenAiModal = async (type: "SKILLS" | "KEYWORDS", forceRefresh = false) => {
    setAiType(type);
    setAiModalOpen(true);
    setAiLoading(true);
    setAiError(null);
    // Always cleared: Apply branches on the tab that is open now, so items left
    // over from the other tab would be posted as the wrong kind of row.
    setAiItems([]);
    setSelectedAiItems(new Set());

    // Only the newest generation may own this panel.
    const signal = abortAi();
    try {
      const catObj = categories.find((c) => c.category_id === role.category_id);
      const prevSuggestions = forceRefresh
        ? (type === "SKILLS" ? sessionSkillsHistory : sessionKeywordsHistory)
        : [];

      const res = await fetch("/api/vos-admin/job-roles/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          role_name: role.role_name,
          category_name: catObj?.category_name || "",
          existing_skills: roleSkills.map((s) => ({
            skill_id: s.skill_id,
            name: s.skill_name || "",
          })),
          existing_keywords: roleKeywords.map((k) => k.alias_name),
          previous_suggestions: prevSuggestions.slice(-25),
          force_refresh: forceRefresh,
        }),
      });

      if (signal.aborted) return;
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `AI suggestion failed (${res.status})`);
      }
      const data = await res.json();
      if (signal.aborted) return;

      if (type === "SKILLS") {
        const skillsList = (data.skills || []).map((s: {
          skill_name: string;
          importance_weight?: number;
          weight?: number;
          is_required?: boolean;
          matched_master_id?: number | null;
          is_new_skill?: boolean;
        }) => {
          const rawWeight = s.importance_weight ?? s.weight ?? 0.90;
          const parsedWeight =
            typeof rawWeight === "number" && !isNaN(rawWeight)
              ? rawWeight
              : parseFloat(String(rawWeight)) || 0.90;
          return {
            label: s.skill_name,
            weight: parsedWeight,
            is_required: Boolean(s.is_required),
            matched_master_id: s.matched_master_id ?? null,
            is_new: Boolean(s.is_new_skill),
          };
        });
        setAiItems(skillsList);
        setSelectedAiItems(new Set(skillsList.map((s: { label: string }) => s.label)));

        // Record session history (capped at 25)
        const incomingLabels = skillsList.map((s: { label: string }) => s.label);
        setSessionSkillsHistory((prev) => Array.from(new Set([...prev, ...incomingLabels])).slice(-25));
      } else {
        const kwList = (data.keywords || []).map((k: {
          alias: string;
          weight?: number;
          match_weight?: number;
        }) => {
          const rawWeight = k.weight ?? k.match_weight ?? 0.90;
          const parsedWeight =
            typeof rawWeight === "number" && !isNaN(rawWeight)
              ? rawWeight
              : parseFloat(String(rawWeight)) || 0.90;
          return {
            label: k.alias,
            weight: parsedWeight,
            is_new: true,
          };
        });
        setAiItems(kwList);
        setSelectedAiItems(new Set(kwList.map((k: { label: string }) => k.label)));

        // Record session history (capped at 25)
        const incomingLabels = kwList.map((k: { label: string }) => k.label);
        setSessionKeywordsHistory((prev) => Array.from(new Set([...prev, ...incomingLabels])).slice(-25));
      }
    } catch (err: unknown) {
      if (signal.aborted) return;
      setAiError((err as Error).message || "Failed to generate AI suggestions.");
    } finally {
      if (!signal.aborted) setAiLoading(false);
    }
  };

  // ── AI Bulk Save ────────────────────────────────────────────────────────────
  const handleAiBulkApply = async () => {
    setAiBulkSaving(true);
    const selected = aiItems.filter((i) => selectedAiItems.has(i.label));
    const addedLabels = new Set(selected.map((i) => i.label));
    const notSaved: string[] = [];

    if (aiType === "SKILLS") {
      // Remove newly mapped skills from session candidate history
      setSessionSkillsHistory((prev) => prev.filter((name) => !addedLabels.has(name)));

      for (const item of selected) {
        // Use matched_master_id if returned from server, or search masterSkills cache, or create
        let skillId = item.matched_master_id;
        if (!skillId) {
          skillId = masterSkills.find((m) => m.skill_name.toLowerCase() === item.label.toLowerCase())?.id;
        }

        if (!skillId) {
          const createRes = await fetch("/api/vos-admin/job-roles/skills", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ create_master: true, skill_name: item.label }),
          }).catch(() => null);
          if (createRes?.ok) {
            const masterJson = await createRes.json();
            skillId = masterJson.id;
          }
        }

        const ok = skillId
          ? await onAddSkill({
              role_id: role.role_id,
              skill_id: skillId,
              skill_name: item.label,
              importance_weight: item.weight,
              is_required: Boolean(item.is_required),
            })
          : false;
        if (!ok) notSaved.push(item.label);
      }
    } else {
      // Remove newly mapped keywords from session candidate history
      setSessionKeywordsHistory((prev) => prev.filter((name) => !addedLabels.has(name)));

      for (const item of selected) {
        const ok = await onAddKeyword({
          role_id: role.role_id,
          alias_name: item.label,
          normalized_alias: normalizeKeyword(item.label),
          match_weight: item.weight,
          is_primary: false,
        });
        if (!ok) notSaved.push(item.label);
      }
    }

    setAiBulkSaving(false);
    abortAi();
    setAiModalOpen(false);
    // Each row was posted on its own, so "Applied" is only true for the ones
    // that landed; without this the panel closed as if all were saved.
    if (notSaved.length > 0) {
      toast.error(`${notSaved.length} selected suggestion(s) were not saved: ${notSaved.join(", ")}.`);
    }
  };

  /** Closing the panel abandons whatever was being generated for the open tab. */
  const closeAiModal = (next: boolean) => {
    if (!next) abortAi();
    setAiModalOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl rounded-2xl overflow-hidden p-0 gap-0 h-[95vh] sm:h-[95vh] max-h-[95vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between gap-4 shrink-0 bg-zinc-50/80 dark:bg-zinc-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
              <Briefcase className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold truncate text-zinc-900 dark:text-zinc-100">
                  {role.role_name}
                </DialogTitle>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    role.is_active !== false
                      ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  <Power className="h-2.5 w-2.5" />
                  {role.is_active !== false ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                <span>{role.category_name}</span>
                <span>·</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {role.experience_level}
                </span>
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b flex items-center gap-2 shrink-0 bg-background">
          <button
            type="button"
            onClick={() => setActiveTab("SKILLS")}
            className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "SKILLS"
                ? "border-violet-600 text-violet-600 dark:text-violet-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Core Skills ({roleSkills.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("KEYWORDS")}
            className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "KEYWORDS"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            Keywords &amp; Synonyms ({roleKeywords.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("SETTINGS")}
            className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "SETTINGS"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Edit2 className="h-3.5 w-3.5" />
            Role Settings
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 shrink-0">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* Body Content with Fluid Tab Transitions */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4 text-xs">
          <AnimatePresence mode="wait">
            {/* ── TAB 1: SKILLS ───────────────────────────────────────────────── */}
            {activeTab === "SKILLS" && (
              <motion.div
                key="tab-skills"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="space-y-3"
              >
                {/* Search & Actions Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search core skills..."
                      value={skillSearch}
                      onChange={(e) => {
                        setSkillSearch(e.target.value);
                        setSkillPage(1);
                      }}
                      className="pl-8 pr-7 h-8 text-xs rounded-xl"
                    />
                    {skillSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setSkillSearch("");
                          setSkillPage(1);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenAiModal("SKILLS")}
                      className="h-8 text-xs gap-1.5 font-bold border-violet-200 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/50 cursor-pointer"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      AI Suggest
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setSkillModalOpen(true)}
                      className="h-8 text-xs gap-1.5 font-bold bg-violet-600 hover:bg-violet-700 active:scale-95 text-white border-0 cursor-pointer transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Skill
                    </Button>
                    <Button
                      size="sm"
                      variant={isBulkDeleteSkillMode ? "default" : "outline"}
                      onClick={() => {
                        setIsBulkDeleteSkillMode(!isBulkDeleteSkillMode);
                        if (isBulkDeleteSkillMode) setSelectedSkillIds(new Set());
                      }}
                      className={`h-8 text-xs gap-1.5 font-bold cursor-pointer transition-all ${
                        isBulkDeleteSkillMode
                          ? "bg-violet-700 text-white hover:bg-violet-800"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                      title="Toggle multiple selection"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      {isBulkDeleteSkillMode ? "Exit Selection" : "Multiple Select"}
                    </Button>
                  </div>
                </div>

                {/* Filter Tabs: All | Required | Active | Inactive */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/60 w-fit text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSkillFilterTab("ALL");
                      setSkillPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      skillFilterTab === "ALL"
                        ? "bg-background text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-semibold">{skillCounts.all}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSkillFilterTab("REQUIRED");
                      setSkillPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      skillFilterTab === "REQUIRED"
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Required <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-900/60 font-semibold">{skillCounts.required}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSkillFilterTab("ACTIVE");
                      setSkillPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      skillFilterTab === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Active <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-900/60 font-semibold">{skillCounts.active}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSkillFilterTab("INACTIVE");
                      setSkillPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      skillFilterTab === "INACTIVE"
                        ? "bg-zinc-200/80 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Inactive <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-700 font-semibold">{skillCounts.inactive}</span>
                  </button>
                </div>

                {/* Multiple Selection Active Bar with Smooth Motion */}
                <AnimatePresence>
                  {isBulkDeleteSkillMode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/60 text-xs">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="select-all-skills"
                            checked={filteredAndSortedSkills.length > 0 && selectedSkillIds.size === filteredAndSortedSkills.length}
                            onChange={handleToggleSelectAllSkills}
                            className="h-4 w-4 rounded border-border text-violet-600 focus:ring-violet-500 cursor-pointer"
                          />
                          <label htmlFor="select-all-skills" className="font-bold text-violet-950 dark:text-violet-200 cursor-pointer select-none">
                            Select All ({filteredAndSortedSkills.length})
                          </label>
                          <span className="text-muted-foreground font-medium">·</span>
                          <span className="font-semibold text-violet-800 dark:text-violet-300">
                            {selectedSkillIds.size} selected
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={selectedSkillIds.size === 0 || isBulkUpdatingSkills}
                            onClick={() => handleBulkSetSkillActive(true)}
                            className="h-7 px-2 text-xs font-semibold gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 cursor-pointer"
                            title="Mark selected skills as active"
                          >
                            {isBulkUpdatingSkills ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Power className="h-3 w-3 text-emerald-600" />
                            )}
                            Mark Active
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={selectedSkillIds.size === 0 || isBulkUpdatingSkills}
                            onClick={() => handleBulkSetSkillActive(false)}
                            className="h-7 px-2 text-xs font-semibold gap-1 text-zinc-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-border cursor-pointer"
                            title="Mark selected skills as inactive"
                          >
                            {isBulkUpdatingSkills ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Power className="h-3 w-3 text-zinc-500" />
                            )}
                            Mark Inactive
                          </Button>
 
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsBulkDeleteSkillMode(false);
                              setSelectedSkillIds(new Set());
                            }}
                            className="h-7 px-2 text-xs font-semibold cursor-pointer"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {filteredAndSortedSkills.length === 0 ? (
                  <div className="p-8 text-center bg-muted/30 rounded-xl border border-dashed text-muted-foreground">
                    {skillSearch
                      ? "No skills match your search query."
                      : skillFilterTab !== "ALL"
                      ? `No ${skillFilterTab.toLowerCase()} skills found.`
                      : "No skills mapped yet. Click \"Add Skill\" or \"AI Suggest\" to add core competencies."}
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden bg-background flex flex-col min-h-[460px] justify-between">
                    {/* Fixed Pagination Motion */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`skills-page-${safeSkillPage}-${skillFilterTab}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="divide-y divide-border flex-1"
                      >
                        {paginatedSkills.map((s) => {
                          const pct = Math.round(Number(s.importance_weight ?? 1.0) * 100);
                          const active = isActiveStatus(s.is_active);
                          return (
                            <div
                              key={s.id}
                              className={`p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors ${
                                !active ? "opacity-60 bg-muted/20" : ""
                              } ${isBulkDeleteSkillMode ? "select-none" : ""}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold text-foreground text-xs truncate">
                                  {s.skill_name || `Skill #${s.skill_id}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onEditSkill({ id: s.id, is_required: !s.is_required })}
                                  title={`Click to change to ${s.is_required ? "Preferred" : "Required"}`}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-all cursor-pointer hover:opacity-80 active:scale-95 select-none ${
                                    s.is_required
                                      ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/60"
                                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                  }`}
                                >
                                  {s.is_required ? "Required" : "Preferred"}
                                </button>
                                {!active && (
                                  <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-200/80 dark:bg-zinc-800">
                                    Inactive
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {/* Retained Percentage (Progress bar removed) */}
                                <span className="font-mono text-xs font-bold text-foreground px-2 py-0.5 rounded-md bg-muted/40 border border-border/50 min-w-11 text-center">
                                  {pct}%
                                </span>

                                {/* Active / Inactive Toggle Button (Icon-only) */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleSkillActive(s)}
                                  className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-all cursor-pointer ${
                                    active
                                      ? "text-zinc-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-border"
                                      : "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
                                  }`}
                                  title={active ? "Deactivate Skill" : "Activate Skill"}
                                  aria-label={active ? "Deactivate Skill" : "Activate Skill"}
                                >
                                  <Power className="h-3.5 w-3.5" />
                                </button>

                                {/* Edit Button (Icon-only) */}
                                <button
                                  type="button"
                                  onClick={() => openEditSkillModal(s)}
                                  className="p-1.5 rounded-lg border border-border text-zinc-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                  title="Edit Skill"
                                  aria-label="Edit Skill"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>

        
                                {/* Checkbox at rightmost (ONLY when Multiple Delete is toggled on) */}
                                {isBulkDeleteSkillMode && (
                                  <div
                                    className="pl-2 pr-0.5 py-1 border-l border-border/60 flex items-center cursor-pointer select-none"
                                    onMouseDown={(e) => handleSkillCheckboxMouseDown(s.id, e)}
                                    onMouseEnter={() => handleSkillCheckboxMouseEnter(s.id)}
                                    title={selectedSkillIds.has(s.id) ? "Deselect" : "Select (drag to select multiple)"}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedSkillIds.has(s.id)}
                                      onChange={(e) => {
                                        setSelectedSkillIds((prev) => {
                                          const next = new Set(prev);
                                          if (e.target.checked) next.add(s.id);
                                          else next.delete(s.id);
                                          return next;
                                        });
                                      }}
                                      className="h-4 w-4 rounded border-border text-violet-600 focus:ring-violet-500 cursor-pointer pointer-events-none"
                                      aria-label={`Select ${s.skill_name || "skill"}`}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>

                    {/* Skills Pagination Footer */}
                    {filteredAndSortedSkills.length > pageSize && (
                      <div className="px-3 py-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground bg-muted/20">
                        <div>
                          Showing {(safeSkillPage - 1) * pageSize + 1} to{" "}
                          {Math.min(safeSkillPage * pageSize, filteredAndSortedSkills.length)} of{" "}
                          {filteredAndSortedSkills.length} skills
                        </div>
                        <Pagination className="mx-0 w-auto justify-end">
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (safeSkillPage > 1) setSkillPage((p) => p - 1);
                                }}
                                className={safeSkillPage <= 1 ? "pointer-events-none opacity-40 cursor-not-allowed" : "cursor-pointer"}
                              />
                            </PaginationItem>
                            {Array.from({ length: totalSkillPages }, (_, i) => i + 1)
                              .filter((p) => p === 1 || p === totalSkillPages || Math.abs(p - safeSkillPage) <= 1)
                              .map((page, idx, arr) => {
                                const prev = arr[idx - 1];
                                return (
                                  <React.Fragment key={page}>
                                    {prev && page - prev > 1 && (
                                      <PaginationItem>
                                        <span className="px-1.5 text-muted-foreground">…</span>
                                      </PaginationItem>
                                    )}
                                    <PaginationItem>
                                      <PaginationLink
                                        href="#"
                                        isActive={page === safeSkillPage}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setSkillPage(page);
                                        }}
                                        className="cursor-pointer h-7 w-7 text-xs"
                                      >
                                        {page}
                                      </PaginationLink>
                                    </PaginationItem>
                                  </React.Fragment>
                                );
                              })}
                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (safeSkillPage < totalSkillPages) setSkillPage((p) => p + 1);
                                }}
                                className={safeSkillPage >= totalSkillPages ? "pointer-events-none opacity-40 cursor-not-allowed" : "cursor-pointer"}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── TAB 2: KEYWORDS ─────────────────────────────────────────────── */}
            {activeTab === "KEYWORDS" && (
              <motion.div
                key="tab-keywords"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="space-y-3"
              >
                {/* Search & Actions Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search keywords & synonyms..."
                      value={kwSearch}
                      onChange={(e) => {
                        setKwSearch(e.target.value);
                        setKwPage(1);
                      }}
                      className="pl-8 pr-7 h-8 text-xs rounded-xl"
                    />
                    {kwSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setKwSearch("");
                          setKwPage(1);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenAiModal("KEYWORDS")}
                      className="h-8 text-xs gap-1.5 font-bold border-emerald-200 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      AI Suggest
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setKeywordModalOpen(true)}
                      className="h-8 text-xs gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white border-0 cursor-pointer transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Keyword
                    </Button>
                    <Button
                      size="sm"
                      variant={isBulkDeleteKwMode ? "default" : "outline"}
                      onClick={() => {
                        setIsBulkDeleteKwMode(!isBulkDeleteKwMode);
                        if (isBulkDeleteKwMode) setSelectedKwIds(new Set());
                      }}
                      className={`h-8 text-xs gap-1.5 font-bold cursor-pointer transition-all ${
                        isBulkDeleteKwMode
                          ? "bg-emerald-700 text-white hover:bg-emerald-800"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                      title="Toggle multiple selection"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      {isBulkDeleteKwMode ? "Exit Selection" : "Multiple Select"}
                    </Button>
                  </div>
                </div>

                {/* Filter Tabs: All | Primary | Active | Inactive */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/60 w-fit text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setKwFilterTab("ALL");
                      setKwPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      kwFilterTab === "ALL"
                        ? "bg-background text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-semibold">{kwCounts.all}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setKwFilterTab("PRIMARY");
                      setKwPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      kwFilterTab === "PRIMARY"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Primary <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900/60 font-semibold">{kwCounts.primary}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setKwFilterTab("ACTIVE");
                      setKwPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      kwFilterTab === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Active <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-900/60 font-semibold">{kwCounts.active}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setKwFilterTab("INACTIVE");
                      setKwPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      kwFilterTab === "INACTIVE"
                        ? "bg-zinc-200/80 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Inactive <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-700 font-semibold">{kwCounts.inactive}</span>
                  </button>
                </div>

                {/* Multiple Selection Active Bar with Smooth Motion */}
                <AnimatePresence>
                  {isBulkDeleteKwMode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="select-all-kws"
                            checked={filteredAndSortedKeywords.length > 0 && selectedKwIds.size === filteredAndSortedKeywords.length}
                            onChange={handleToggleSelectAllKeywords}
                            className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <label htmlFor="select-all-kws" className="font-bold text-emerald-950 dark:text-emerald-200 cursor-pointer select-none">
                            Select All ({filteredAndSortedKeywords.length})
                          </label>
                          <span className="text-muted-foreground font-medium">·</span>
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                            {selectedKwIds.size} selected
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={selectedKwIds.size === 0 || isBulkUpdatingKws}
                            onClick={() => handleBulkSetKeywordActive(true)}
                            className="h-7 px-2 text-xs font-semibold gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 cursor-pointer"
                            title="Mark selected keywords as active"
                          >
                            {isBulkUpdatingKws ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Power className="h-3 w-3 text-emerald-600" />
                            )}
                            Mark Active
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={selectedKwIds.size === 0 || isBulkUpdatingKws}
                            onClick={() => handleBulkSetKeywordActive(false)}
                            className="h-7 px-2 text-xs font-semibold gap-1 text-zinc-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-border cursor-pointer"
                            title="Mark selected keywords as inactive"
                          >
                            {isBulkUpdatingKws ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Power className="h-3 w-3 text-zinc-500" />
                            )}
                            Mark Inactive
                          </Button>
 
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsBulkDeleteKwMode(false);
                              setSelectedKwIds(new Set());
                            }}
                            className="h-7 px-2 text-xs font-semibold cursor-pointer"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {filteredAndSortedKeywords.length === 0 ? (
                  <div className="p-8 text-center bg-muted/30 rounded-xl border border-dashed text-muted-foreground">
                    {kwSearch
                      ? "No keywords match your search query."
                      : kwFilterTab !== "ALL"
                      ? `No ${kwFilterTab.toLowerCase()} keywords found.`
                      : "No keywords mapped yet. Click \"Add Keyword\" or \"AI Suggest\" to add search aliases."}
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden bg-background flex flex-col min-h-[460px] justify-between">
                    {/* Fixed Pagination Motion */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`keywords-page-${safeKwPage}-${kwFilterTab}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="divide-y divide-border flex-1"
                      >
                        {paginatedKeywords.map((kw) => {
                          const matchPct = Math.round(Number(kw.match_weight ?? 1.0) * 100);
                          const active = isActiveStatus(kw.is_active);
                          return (
                            <div
                              key={kw.alias_id}
                              className={`p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors ${
                                !active ? "opacity-60 bg-muted/20" : ""
                              } ${isBulkDeleteKwMode ? "select-none" : ""}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold text-foreground text-xs truncate">
                                  {kw.alias_name}
                                </span>
                                {Boolean(kw.is_primary) && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                                    Primary
                                  </span>
                                )}
                                {!active && (
                                  <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-200/80 dark:bg-zinc-800">
                                    Inactive
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {/* Retained Percentage (Progress bar removed) */}
                                <span className="font-mono text-xs font-bold text-foreground px-2 py-0.5 rounded-md bg-muted/40 border border-border/50 min-w-11 text-center">
                                  {matchPct}%
                                </span>

                                {/* Active / Inactive Toggle Button (Icon-only) */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleKeywordActive(kw)}
                                  className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-all cursor-pointer ${
                                    active
                                      ? "text-zinc-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-border"
                                      : "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
                                  }`}
                                  title={active ? "Deactivate Keyword" : "Activate Keyword"}
                                  aria-label={active ? "Deactivate Keyword" : "Activate Keyword"}
                                >
                                  <Power className="h-3.5 w-3.5" />
                                </button>

                                {/* Edit Button (Icon-only) */}
                                <button
                                  type="button"
                                  onClick={() => openEditKeywordModal(kw)}
                                  className="p-1.5 rounded-lg border border-border text-zinc-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                  title="Edit Keyword"
                                  aria-label="Edit Keyword"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>

                              
                                {/* Checkbox at rightmost (ONLY when Multiple Delete is toggled on) */}
                                {isBulkDeleteKwMode && (
                                  <div
                                    className="pl-2 pr-0.5 py-1 border-l border-border/60 flex items-center cursor-pointer select-none"
                                    onMouseDown={(e) => handleKwCheckboxMouseDown(kw.alias_id, e)}
                                    onMouseEnter={() => handleKwCheckboxMouseEnter(kw.alias_id)}
                                    title={selectedKwIds.has(kw.alias_id) ? "Deselect" : "Select (drag to select multiple)"}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedKwIds.has(kw.alias_id)}
                                      onChange={(e) => {
                                        setSelectedKwIds((prev) => {
                                          const next = new Set(prev);
                                          if (e.target.checked) next.add(kw.alias_id);
                                          else next.delete(kw.alias_id);
                                          return next;
                                        });
                                      }}
                                      className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer pointer-events-none"
                                      aria-label={`Select ${kw.alias_name}`}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>

                    {/* Keywords Pagination Footer */}
                    {filteredAndSortedKeywords.length > pageSize && (
                      <div className="px-3 py-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground bg-muted/20">
                        <div>
                          Showing {(safeKwPage - 1) * pageSize + 1} to{" "}
                          {Math.min(safeKwPage * pageSize, filteredAndSortedKeywords.length)} of{" "}
                          {filteredAndSortedKeywords.length} keywords
                        </div>
                        <Pagination className="mx-0 w-auto justify-end">
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (safeKwPage > 1) setKwPage((p) => p - 1);
                                }}
                                className={safeKwPage <= 1 ? "pointer-events-none opacity-40 cursor-not-allowed" : "cursor-pointer"}
                              />
                            </PaginationItem>
                            {Array.from({ length: totalKwPages }, (_, i) => i + 1)
                              .filter((p) => p === 1 || p === totalKwPages || Math.abs(p - safeKwPage) <= 1)
                              .map((page, idx, arr) => {
                                const prev = arr[idx - 1];
                                return (
                                  <React.Fragment key={page}>
                                    {prev && page - prev > 1 && (
                                      <PaginationItem>
                                        <span className="px-1.5 text-muted-foreground">…</span>
                                      </PaginationItem>
                                    )}
                                    <PaginationItem>
                                      <PaginationLink
                                        href="#"
                                        isActive={page === safeKwPage}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setKwPage(page);
                                        }}
                                        className="cursor-pointer h-7 w-7 text-xs"
                                      >
                                        {page}
                                      </PaginationLink>
                                    </PaginationItem>
                                  </React.Fragment>
                                );
                              })}
                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (safeKwPage < totalKwPages) setKwPage((p) => p + 1);
                                }}
                                className={safeKwPage >= totalKwPages ? "pointer-events-none opacity-40 cursor-not-allowed" : "cursor-pointer"}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── TAB 3: ROLE SETTINGS ────────────────────────────────────────── */}
            {activeTab === "SETTINGS" && (
              <motion.div
                key="tab-settings"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="space-y-4 max-w-lg"
              >
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Standard Role Name</label>
                  <Input
                    value={roleNameInput}
                    onChange={(e) => setRoleNameInput(e.target.value)}
                    placeholder="e.g. Frontend Developer"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Category</label>
                  <SearchableSelect
                    value={String(catIdInput)}
                    onValueChange={(val) => setCatIdInput(Number(val))}
                    options={categories.map((c) => ({
                      value: String(c.category_id),
                      label: c.category_name,
                    }))}
                    placeholder="Select category"
                    triggerClassName="h-9 text-xs w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Experience Level</label>
                  <SearchableSelect
                    value={expLevelInput}
                    onValueChange={(val) => setExpLevelInput(val as ExperienceLevel)}
                    options={EXPERIENCE_LEVEL_OPTIONS}
                    placeholder="Select experience level"
                    triggerClassName="h-9 text-xs w-full"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/40">
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-foreground">Role Status</label>
                    <p className="text-[11px] text-muted-foreground">
                      {role.is_active !== false
                        ? "Active: Included in match simulation and candidate scoring."
                        : "Inactive: Excluded from matching and sorted to the bottom."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={roleSaving}
                    onClick={handleToggleRoleActive}
                    className={`h-8 px-3 text-xs font-bold gap-1.5 rounded-xl ${
                      role.is_active !== false
                        ? "text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                        : "text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {role.is_active !== false ? "Deactivate Role" : "Activate Role"}
                  </Button>
                </div>

                <Button
                  onClick={handleSaveRole}
                  disabled={roleSaving || !roleNameInput.trim()}
                  className="h-9 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
                >
                  {roleSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Save Role Settings
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </DialogContent>

      {/* ── SUB-MODAL: Add Skill ───────────────────────────────────────────── */}
      <Dialog open={skillModalOpen} onOpenChange={setSkillModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Add Core Skill to Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold">Select Master Skill</label>
              <SearchableSelect
                value={selectedSkillId ? String(selectedSkillId) : ""}
                onValueChange={(val) => setSelectedSkillId(val ? Number(val) : "")}
                options={masterSkills.map((m) => ({
                  value: String(m.id),
                  label: m.skill_name,
                }))}
                placeholder="Choose master skill..."
                triggerClassName="h-9 text-xs w-full"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold">Or Create New Skill</label>
              <Input
                value={customSkillName}
                onChange={(e) => setCustomSkillName(e.target.value)}
                placeholder="e.g. Next.js"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold">Importance Weight (0.0 – 1.0)</label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={skillWeight}
                onChange={(e) => setSkillWeight(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="skill-req-check"
                checked={isSkillRequired}
                onChange={(e) => setIsSkillRequired(e.target.checked)}
                className="rounded border-input text-violet-600 focus:ring-violet-500 h-4 w-4"
              />
              <label htmlFor="skill-req-check" className="font-medium text-foreground cursor-pointer">
                Mark as Required Skill (Mandatory for role matching)
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setSkillModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateSkill}
              disabled={skillSaving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {skillSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save Skill
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── SUB-MODAL: Add Keyword ─────────────────────────────────────────── */}
      <Dialog open={keywordModalOpen} onOpenChange={setKeywordModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Add Search Keyword / Synonym</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold">Keyword Alias</label>
              <Input
                value={aliasNameInput}
                onChange={(e) => setAliasNameInput(e.target.value)}
                placeholder="e.g. Front End Engineer"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold">Match Weight (0.0 – 1.0)</label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={keywordWeight}
                onChange={(e) => setKeywordWeight(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="kw-primary-check"
                checked={isKeywordPrimary}
                onChange={(e) => setIsKeywordPrimary(e.target.checked)}
                className="rounded border-input text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <label htmlFor="kw-primary-check" className="font-medium text-foreground cursor-pointer">
                Primary Role Keyword
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setKeywordModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateKeyword}
              disabled={keywordSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {keywordSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save Keyword
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── SUB-MODAL: AI Suggest Additional Skills / Keywords ────────────── */}
      <Dialog open={aiModalOpen} onOpenChange={closeAiModal}>
          <DialogContent className="sm:max-w-xl rounded-2xl max-h-[85vh] flex flex-col p-6 gap-4">
            <DialogHeader className="flex flex-row items-center justify-between gap-2 border-b pb-3">
              <div>
                <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Bot className="h-4 w-4 text-violet-500" />
                  Suggest Additional {aiType === "SKILLS" ? "Skills" : "Keywords"} for {role.role_name}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  AI suggestions are deduplicated against current mappings and cross-referenced with the Master Taxonomy.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={aiLoading}
                onClick={() => handleOpenAiModal(aiType, true)}
                className="h-8 text-xs gap-1.5 font-medium shrink-0 border-zinc-200 dark:border-zinc-800"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${aiLoading ? "animate-spin text-violet-600" : ""}`} />
                Regenerate
              </Button>
            </DialogHeader>

            {/* Context Section: Existing Mapped Items */}
            <div className="rounded-xl p-3 bg-muted/40 border border-border text-xs space-y-1.5">
              <div className="flex items-center justify-between text-muted-foreground font-medium">
                <span>Existing {aiType === "SKILLS" ? "Role Skills" : "Keywords"} (Protected & Excluded):</span>
                <span className="font-mono">
                  {aiType === "SKILLS" ? roleSkills.length : roleKeywords.length} mapped
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                {aiType === "SKILLS" ? (
                  roleSkills.length === 0 ? (
                    <span className="text-muted-foreground italic">None mapped yet</span>
                  ) : (
                    roleSkills.map((s) => (
                      <span
                        key={s.id}
                        className="px-2 py-0.5 rounded-md bg-background border border-border text-muted-foreground text-[11px] font-medium"
                      >
                        ✓ {s.skill_name || `Skill #${s.skill_id}`}
                      </span>
                    ))
                  )
                ) : roleKeywords.length === 0 ? (
                  <span className="text-muted-foreground italic">None mapped yet</span>
                ) : (
                  roleKeywords.map((k) => (
                    <span
                      key={k.alias_id}
                      className="px-2 py-0.5 rounded-md bg-background border border-border text-muted-foreground text-[11px] font-medium"
                    >
                      ✓ {k.alias_name}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Graceful Error Display */}
            {aiError && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>{aiError}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenAiModal(aiType, true)}
                  className="h-7 text-xs px-2.5 font-bold border-amber-300 text-amber-800 dark:text-amber-200"
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Suggestions List */}
            <div className="flex-1 overflow-y-auto space-y-2 text-xs pr-1 min-h-[160px]">
              {aiLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500 mx-auto mb-2" />
                  Analyzing job taxonomy & deduplicating suggestions…
                </div>
              ) : aiItems.length === 0 && !aiError ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No new unique suggestions found.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenAiModal(aiType, true)}
                    className="mt-3 text-xs gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Force Generate Fresh Ideas
                  </Button>
                </div>
              ) : (
                aiItems.map((item, idx) => {
                  const isChecked = selectedAiItems.has(item.label);
                  return (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.12, delay: idx * 0.02 }}
                      onClick={() => {
                        setSelectedAiItems((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.label)) next.delete(item.label);
                          else next.add(item.label);
                          return next;
                        });
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/20"
                          : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-4 w-4 rounded flex items-center justify-center border transition-colors ${
                            isChecked
                              ? "bg-violet-600 border-violet-600 text-white"
                              : "border-input"
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3" />}
                        </div>
                        <span className="font-semibold text-foreground">{item.label}</span>

                        {/* Taxonomy Classification Badge */}
                        {aiType === "SKILLS" && (
                          item.matched_master_id || !item.is_new ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              Master Skill
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              New Skill
                            </span>
                          )
                        )}

                        {Boolean(item.is_required) && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                            Required
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        {Math.round(item.weight * 100)}%
                      </span>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-xs text-muted-foreground">
                {selectedAiItems.size} of {aiItems.length} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => closeAiModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAiBulkApply}
                  disabled={aiBulkSaving || selectedAiItems.size === 0}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {aiBulkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Apply Selected ({selectedAiItems.size})
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* Edit Skill Modal */}
      <Dialog open={Boolean(editingSkillTarget)} onOpenChange={(open) => !open && setEditingSkillTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Pencil className="h-4 w-4 text-violet-600" />
              Edit Skill: {editingSkillTarget?.skill_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Importance Weight (0.0 – 1.0)</label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={editSkillWeight}
                onChange={(e) => setEditSkillWeight(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit-skill-req-check"
                checked={editSkillRequired}
                onChange={(e) => setEditSkillRequired(e.target.checked)}
                className="rounded border-input text-violet-600 focus:ring-violet-500 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="edit-skill-req-check" className="font-medium text-foreground cursor-pointer select-none">
                Mark as Required Skill (Mandatory for role matching)
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setEditingSkillTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEditSkill}
              disabled={editSkillSaving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {editSkillSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Keyword Modal */}
      <Dialog open={Boolean(editingKeywordTarget)} onOpenChange={(open) => !open && setEditingKeywordTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Pencil className="h-4 w-4 text-emerald-600" />
              Edit Search Keyword / Synonym
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Keyword Alias</label>
              <Input
                value={editAliasName}
                onChange={(e) => setEditAliasName(e.target.value)}
                placeholder="e.g. Front End Engineer"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Match Weight (0.0 – 1.0)</label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={editKeywordWeight}
                onChange={(e) => setEditKeywordWeight(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit-kw-primary-check"
                checked={editKeywordPrimary}
                onChange={(e) => setEditKeywordPrimary(e.target.checked)}
                className="rounded border-input text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="edit-kw-primary-check" className="font-medium text-foreground cursor-pointer select-none">
                Primary Role Keyword
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setEditingKeywordTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEditKeyword}
              disabled={editKeywordSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {editKeywordSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Skill Confirmation Modal */}
      <Dialog
        open={Boolean(deleteSkillTarget)}
        onOpenChange={(open) => !open && setDeleteSkillTarget(null)}
      >
        <DialogContent className="sm:max-w-md sm:gap-2 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Confirm Skill Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs space-y-2 text-muted-foreground">
            <p>
              Are you sure you want to permanently delete the skill mapping{" "}
              <strong className="text-foreground">
                &quot;{deleteSkillTarget?.skill_name}&quot;
              </strong>?
            </p>
            <p className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 text-amber-800 dark:text-amber-300 text-[11px]">
              <strong>Data Safeguard:</strong> This operation deletes the skill mapping from this role. Candidates requiring this skill will no longer match against this requirement.
            </p>
          </div>
          <div className="flex items-center justify-end sm:gap-2 gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeletingItem}
              onClick={() => setDeleteSkillTarget(null)}
              className="h-9 px-3 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeletingItem}
              onClick={handleConfirmDeleteSkill}
              className="h-9 px-3 rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeletingItem ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Delete Skill
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Skills Confirmation Modal */}
      <Dialog open={bulkDeleteSkillsConfirmOpen} onOpenChange={setBulkDeleteSkillsConfirmOpen}>
        <DialogContent className="sm:max-w-md sm:gap-2 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Confirm Bulk Skill Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs space-y-2 text-muted-foreground">
            <p>
              Are you sure you want to delete <strong className="text-foreground">{selectedSkillIds.size}</strong> selected skill mapping{selectedSkillIds.size > 1 ? "s" : ""}?
            </p>
            <p className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 text-amber-800 dark:text-amber-300 text-[11px]">
              <strong>Data Safeguard:</strong> This operation deletes all selected skill mappings from this role. Candidates requiring these skills will no longer match against these requirements.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isBulkDeletingSkills}
              onClick={() => setBulkDeleteSkillsConfirmOpen(false)}
              className="h-9 px-3 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isBulkDeletingSkills}
              onClick={handleConfirmBulkDeleteSkills}
              className="h-9 px-3 rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isBulkDeletingSkills ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Delete {selectedSkillIds.size} Skills
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Keyword Confirmation Modal */}
      <Dialog
        open={Boolean(deleteKeywordTarget)}
        onOpenChange={(open) => !open && setDeleteKeywordTarget(null)}
      >
        <DialogContent className="sm:max-w-md sm:gap-2 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Confirm Keyword Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs space-y-2 text-muted-foreground">
            <p>
              Are you sure you want to permanently delete the keyword/synonym{" "}
              <strong className="text-foreground">
                &quot;{deleteKeywordTarget?.alias_name}&quot;
              </strong>?
            </p>
            <p className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 text-amber-800 dark:text-amber-300 text-[11px]">
              <strong>Data Safeguard:</strong> This removes this search alias/synonym from the role&apos;s lexical index.
            </p>
          </div>
          <div className="flex items-center justify-end sm:gap-2 gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeletingItem}
              onClick={() => setDeleteKeywordTarget(null)}
              className="h-9 px-3 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeletingItem}
              onClick={handleConfirmDeleteKeyword}
              className="h-9 px-3 rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeletingItem ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Delete Keyword
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Keywords Confirmation Modal */}
      <Dialog open={bulkDeleteKwConfirmOpen} onOpenChange={setBulkDeleteKwConfirmOpen}>
        <DialogContent className="sm:max-w-md sm:gap-2 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Confirm Bulk Keyword Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs space-y-2 text-muted-foreground">
            <p>
              Are you sure you want to delete <strong className="text-foreground">{selectedKwIds.size}</strong> selected keyword{selectedKwIds.size > 1 ? "s" : ""}?
            </p>
            <p className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 text-amber-800 dark:text-amber-300 text-[11px]">
              <strong>Data Safeguard:</strong> This removes all selected search aliases/synonyms from the role&apos;s lexical index.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isBulkDeletingKws}
              onClick={() => setBulkDeleteKwConfirmOpen(false)}
              className="h-9 px-3 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isBulkDeletingKws}
              onClick={handleConfirmBulkDeleteKeywords}
              className="h-9 px-3 rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isBulkDeletingKws ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Delete {selectedKwIds.size} Keywords
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
