"use client";

// src/modules/vos-admin/role-matching/components/MatchingTaxonomyEditor.tsx

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Briefcase,
  Search,
  CheckCircle2,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  SlidersHorizontal,
  ShieldAlert,
  Power,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useJobCategories } from "../hooks/useJobCategories";
import { useStandardRoles } from "../hooks/useStandardRoles";
import { useSearchKeywords } from "../hooks/useSearchKeywords";
import { useRoleSkills } from "../hooks/useRoleSkills";
import { RoleDetailSheet } from "./RoleDetailSheet";
import { slugifyCode } from "../validators";
import { JobCategory, StandardRole, ExperienceLevel } from "../types";

const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "ENTRY", label: "Entry Level" },
  { value: "MID", label: "Mid Level" },
  { value: "SENIOR", label: "Senior Level" },
  { value: "LEAD", label: "Lead / Manager" },
  { value: "EXECUTIVE", label: "Executive / Director" },
];

export function MatchingTaxonomyEditor() {
  const {
    categories,
    loading: catLoading,
    addCategory,
    editCategory,
    removeCategory,
  } = useJobCategories();

  const {
    roles,
    loading: rolesLoading,
    addRole,
    editRole,
    removeRole,
  } = useStandardRoles();

  const {
    keywords,
    loading: kwLoading,
    addKeyword,
    editKeyword,
    removeKeyword,
  } = useSearchKeywords();

  const {
    roleSkills,
    masterSkills,
    loading: skillsLoading,
    addRoleSkill,
    editRoleSkill,
    removeRoleSkill,
  } = useRoleSkills();

  // Search Query across all 4 tiers
  const [searchQuery, setSearchQuery] = useState("");

  // Category Expansion State
  const [expandedCats, setExpandedCats] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
  });

  // Role Expansion State
  const [expandedRoles, setExpandedRoles] = useState<Record<number, boolean>>({});

  // Active Role for Detail Sheet
  const [selectedRoleForDetail, setSelectedRoleForDetail] = useState<StandardRole | null>(null);

  // Category Modal State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<JobCategory | null>(null);
  const [catNameInput, setCatNameInput] = useState("");
  const [catCodeInput, setCatCodeInput] = useState("");
  const [catDescInput, setCatDescInput] = useState("");
  const [catIsActiveInput, setCatIsActiveInput] = useState(true);
  const [catSaving, setCatSaving] = useState(false);

  // Role Modal State
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<StandardRole | null>(null);
  const [targetCatIdForNewRole, setTargetCatIdForNewRole] = useState<number>(1);
  const [roleNameInput, setRoleNameInput] = useState("");
  const [roleExpLevelInput, setRoleExpLevelInput] = useState<ExperienceLevel>("MID");
  const [roleIsActiveInput, setRoleIsActiveInput] = useState(true);
  const [roleSaving, setRoleSaving] = useState(false);

  const [generalError, setGeneralError] = useState("");
  const [deleteCatTarget, setDeleteCatTarget] = useState<JobCategory | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<StandardRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleCat = (id: number) => {
    setExpandedCats((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleRole = (roleId: number) => {
    setExpandedRoles((prev) => ({ ...prev, [roleId]: !prev[roleId] }));
  };

  // Group keywords by role_id
  const keywordsByRole = useMemo(() => {
    const map = new Map<number, typeof keywords>();
    for (const kw of keywords) {
      const list = map.get(kw.role_id) || [];
      list.push(kw);
      map.set(kw.role_id, list);
    }
    return map;
  }, [keywords]);

  // Group role skills by role_id
  const skillsByRole = useMemo(() => {
    const map = new Map<number, typeof roleSkills>();
    for (const rs of roleSkills) {
      const list = map.get(rs.role_id) || [];
      list.push(rs);
      map.set(rs.role_id, list);
    }
    return map;
  }, [roleSkills]);

  // ── Category CRUD ─────────────────────────────────────────────────────────
  const openAddCategory = () => {
    setEditingCategory(null);
    setCatNameInput("");
    setCatCodeInput("");
    setCatDescInput("");
    setCatIsActiveInput(true);
    setGeneralError("");
    setCategoryModalOpen(true);
  };

  const openEditCategory = (cat: JobCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategory(cat);
    setCatNameInput(cat.category_name);
    setCatCodeInput(cat.category_code);
    setCatDescInput(cat.description || "");
    setCatIsActiveInput(cat.is_active !== false);
    setGeneralError("");
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!catNameInput.trim()) {
      setGeneralError("Category name is required.");
      return;
    }
    const code = catCodeInput.trim() || slugifyCode(catNameInput);
    setCatSaving(true);
    setGeneralError("");

    let ok = false;
    if (editingCategory) {
      ok = await editCategory({
        category_id: editingCategory.category_id,
        category_name: catNameInput.trim(),
        category_code: code,
        description: catDescInput.trim(),
        is_active: catIsActiveInput,
      });
    } else {
      ok = await addCategory({
        category_name: catNameInput.trim(),
        category_code: code,
        description: catDescInput.trim(),
        is_active: catIsActiveInput,
      });
    }

    setCatSaving(false);
    if (ok) {
      setCategoryModalOpen(false);
    }
  };

  const handleToggleCategoryActive = async (cat: JobCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = cat.is_active === false;
    const ok = await editCategory({
      category_id: cat.category_id,
      is_active: updated,
    });
    if (ok) {
      toast.success(`Category "${cat.category_name}" marked as ${updated ? "Active" : "Inactive"}.`);
    }
  };

  const handleDeleteCategory = (cat: JobCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteCatTarget(cat);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deleteCatTarget) return;
    setIsDeleting(true);
    const ok = await removeCategory(deleteCatTarget.category_id);
    setIsDeleting(false);
    if (ok) {
      toast.success(`Category "${deleteCatTarget.category_name}" deleted.`);
      setDeleteCatTarget(null);
    }
  };

  // ── Role CRUD ─────────────────────────────────────────────────────────────
  const openAddRoleForCategory = (catId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRole(null);
    setTargetCatIdForNewRole(catId);
    setRoleNameInput("");
    setRoleExpLevelInput("MID");
    setRoleIsActiveInput(true);
    setGeneralError("");
    setRoleModalOpen(true);
  };

  const openEditRole = (role: StandardRole, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRole(role);
    setTargetCatIdForNewRole(role.category_id);
    setRoleNameInput(role.role_name);
    setRoleExpLevelInput(role.experience_level || "MID");
    setRoleIsActiveInput(role.is_active !== false);
    setGeneralError("");
    setRoleModalOpen(true);
  };

  const handleToggleRoleActive = async (role: StandardRole, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = role.is_active === false;
    const ok = await editRole({
      role_id: role.role_id,
      is_active: updated,
    });
    if (ok) {
      toast.success(`Role "${role.role_name}" marked as ${updated ? "Active" : "Inactive"}.`);
    }
  };

  const handleSaveRole = async () => {
    if (!roleNameInput.trim()) {
      setGeneralError("Role name is required.");
      return;
    }
    setRoleSaving(true);
    setGeneralError("");

    let ok = false;
    if (editingRole) {
      ok = await editRole({
        role_id: editingRole.role_id,
        role_name: roleNameInput.trim(),
        category_id: targetCatIdForNewRole,
        experience_level: roleExpLevelInput,
        is_active: roleIsActiveInput,
      });
    } else {
      ok = await addRole({
        role_name: roleNameInput.trim(),
        category_id: targetCatIdForNewRole,
        experience_level: roleExpLevelInput,
        is_active: roleIsActiveInput,
      });
    }

    setRoleSaving(false);
    if (ok) {
      setRoleModalOpen(false);
    }
  };

  const handleDeleteRole = (role: StandardRole, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteRoleTarget(role);
  };

  const handleConfirmDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    setIsDeleting(true);
    const ok = await removeRole(deleteRoleTarget.role_id);
    setIsDeleting(false);
    if (ok) {
      toast.success(`Role "${deleteRoleTarget.role_name}" deleted.`);
      setDeleteRoleTarget(null);
    }
  };

  // ── Search & Filter Logic ─────────────────────────────────────────────────
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return categories;

    return categories.filter((cat) => {
      // 1. Match category name or code
      if (
        cat.category_name.toLowerCase().includes(q) ||
        cat.category_code.toLowerCase().includes(q)
      ) {
        return true;
      }

      // 2. Match any role under this category
      const catRoles = roles.filter(
        (r) =>
          r.category_id === cat.category_id ||
          (r.category_code && r.category_code === cat.category_code)
      );

      return catRoles.some((role) => {
        if (role.role_name.toLowerCase().includes(q)) return true;

        // Match skills of this role
        const rSkills = skillsByRole.get(role.role_id) || [];
        if (rSkills.some((s) => s.skill_name?.toLowerCase().includes(q))) return true;

        // Match keywords of this role
        const rKeywords = keywordsByRole.get(role.role_id) || [];
        if (rKeywords.some((k) => k.alias_name?.toLowerCase().includes(q))) return true;

        return false;
      });
    });
  }, [categories, roles, skillsByRole, keywordsByRole, searchQuery]);

  // Inactive categories sort to the bottom (last)
  const sortedCategories = useMemo(() => {
    return [...filteredCategories].sort((a, b) => {
      const aActive = a.is_active !== false;
      const bActive = b.is_active !== false;
      if (aActive === bActive) return a.category_id - b.category_id;
      return aActive ? -1 : 1;
    });
  }, [filteredCategories]);

  const loading = catLoading || rolesLoading || kwLoading || skillsLoading;

  return (
    <div className="space-y-4">
      {/* Search & Actions Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories, roles, skills, or keywords..."
            className="pl-9 h-9 text-xs rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={openAddCategory}
            size="sm"
            className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border-0"
          >
            <Plus className="h-4 w-4" />
            Add Job Category
          </Button>
        </div>
      </div>

      {/* Local validation messages only; save and read failures are toasted */}
      {generalError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {generalError}
        </div>
      )}

      {/* Main Tree Card */}
      <div className="p-4 sm:p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mr-2" />
            <span className="text-sm text-zinc-500">Loading matching taxonomy…</span>
          </div>
        ) : sortedCategories.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="p-12 text-center text-muted-foreground text-xs"
          >
            No matching taxonomy items found for &quot;{searchQuery}&quot;.
          </motion.div>
        ) : (
          <AnimatePresence>
            {sortedCategories.map((cat, catIdx) => {
              const isCatExpanded = searchQuery.trim() ? true : !!expandedCats[cat.category_id];
              const rawRoles = roles.filter(
                (r) =>
                  r.category_id === cat.category_id ||
                  (r.category_code && r.category_code === cat.category_code)
              );
              // Inactive roles sort to the bottom (last)
              const catRoles = [...rawRoles].sort((a, b) => {
                const aActive = a.is_active !== false;
                const bActive = b.is_active !== false;
                if (aActive === bActive) return a.role_id - b.role_id;
                return aActive ? -1 : 1;
              });

              return (
                <motion.div
                  layout
                  key={cat.category_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15, delay: catIdx * 0.02 }}
                  className={`border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs ${
                    cat.is_active === false ? "opacity-60 bg-zinc-50/50 dark:bg-zinc-900/40" : ""
                  }`}
                >
                  {/* Category Header Row */}
                  <div
                    onClick={() => toggleCat(cat.category_id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isCatExpanded ? (
                        <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
                      )}
                      <FolderTree className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                        {cat.category_name}
                      </span>
                      <span className="text-[10px] font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.2 rounded-full border border-indigo-200 dark:border-indigo-800">
                        {cat.category_code}
                      </span>
                      {cat.is_active === false && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-200/80 dark:bg-zinc-800 px-1.5 py-0.2 rounded-md">
                          Inactive
                        </span>
                      )}
                      <span className="text-xs text-zinc-500 font-medium ml-1">
                        ({catRoles.length} {catRoles.length === 1 ? "role" : "roles"})
                      </span>
                    </div>

                    {/* Category Action Buttons */}
                    <div className="flex items-center gap-1 self-end sm:self-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleCategoryActive(cat, e)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                          cat.is_active !== false
                            ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        }`}
                        title={cat.is_active !== false ? "Deactivate Category" : "Activate Category"}
                      >
                        <Power className="h-3 w-3" />
                        {cat.is_active !== false ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openAddRoleForCategory(cat.category_id, e)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        Add Role
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openEditCategory(cat, e)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-zinc-200/60 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        title="Edit Category"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCategory(cat, e)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete Category"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Category Roles Section */}
                  <AnimatePresence initial={false}>
                    {isCatExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.16, ease: "easeInOut" }}
                        className="p-3 sm:p-4 space-y-2.5 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 overflow-hidden"
                      >
                        {catRoles.length === 0 ? (
                          <p className="text-xs text-zinc-400 py-2 pl-4 italic">
                            No standard roles mapped under this category.
                          </p>
                        ) : (
                          catRoles.map((role) => {
                            const isRoleExpanded = searchQuery.trim() ? true : !!expandedRoles[role.role_id];
                            const rSkills = skillsByRole.get(role.role_id) || [];
                            const rKeywords = keywordsByRole.get(role.role_id) || [];

                            return (
                              <div
                                key={role.role_id}
                                className={`border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl overflow-hidden transition-all bg-zinc-50/40 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700 ${
                                  role.is_active === false ? "opacity-60 bg-zinc-50/50 dark:bg-zinc-900/40" : ""
                                }`}
                              >
                                {/* Role Row */}
                                <div
                                  onClick={() => toggleRole(role.role_id)}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between w-full p-3 gap-2 text-left hover:bg-zinc-100/60 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {isRoleExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                    )}
                                    <Briefcase className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                    <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                                      {role.role_name}
                                    </span>
                                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0">
                                      {role.experience_level}
                                    </span>
                                    {role.is_active === false && (
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-200/80 dark:bg-zinc-800 px-1.5 py-0.2 rounded-md shrink-0">
                                        Inactive
                                      </span>
                                    )}
                                    <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline">
                                      · {rSkills.length} skills · {rKeywords.length} keywords
                                    </span>
                                  </div>

                                  {/* Role Action Buttons */}
                                  <div
                                    className="flex items-center gap-1.5 self-end sm:self-auto shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => handleToggleRoleActive(role, e)}
                                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                                        role.is_active !== false
                                          ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                      }`}
                                      title={role.is_active !== false ? "Deactivate Role" : "Activate Role"}
                                    >
                                      <Power className="h-3 w-3" />
                                      {role.is_active !== false ? "Deactivate" : "Activate"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedRoleForDetail(role)}
                                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                      <SlidersHorizontal className="h-3 w-3" />
                                      Manage Details
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => openEditRole(role, e)}
                                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-zinc-200/60 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                                      title="Edit Role"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeleteRole(role, e)}
                                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                      title="Delete Role"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                                {/* Inline Skills & Keywords Section */}
                                <AnimatePresence initial={false}>
                                  {isRoleExpanded && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.16, ease: "easeInOut" }}
                                      className="p-4 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-4 bg-white dark:bg-zinc-950/40 overflow-hidden"
                                    >
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Core Skills Box */}
                                        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 space-y-2.5">
                                          <div className="flex items-center justify-between pb-1 border-b border-zinc-200/60 dark:border-zinc-800/60">
                                            <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                                              <CheckCircle2 className="h-3.5 w-3.5 text-violet-500" />
                                              Core Skills ({rSkills.length})
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => setSelectedRoleForDetail(role)}
                                              className="text-[10px] text-violet-600 dark:text-violet-400 font-bold hover:underline cursor-pointer"
                                            >
                                              + Edit in Sheet
                                            </button>
                                          </div>

                                          {rSkills.length === 0 ? (
                                            <p className="text-[11px] text-zinc-400 py-1 italic">
                                              No core skills mapped yet.
                                            </p>
                                          ) : (
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                              {rSkills.map((s) => {
                                                const pct = Math.round(Number(s.importance_weight ?? 1.0) * 100);
                                                return (
                                                  <div
                                                    key={s.id}
                                                    className="flex items-center justify-between text-xs gap-2 py-0.5"
                                                  >
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                                                        {s.skill_name || `Skill #${s.skill_id}`}
                                                      </span>
                                                      <button
                                                        type="button"
                                                        onClick={() => editRoleSkill({ id: s.id, is_required: !s.is_required })}
                                                        title={`Click to change to ${s.is_required ? "Preferred" : "Required"}`}
                                                        className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold transition-all cursor-pointer hover:opacity-80 active:scale-95 shrink-0 ${
                                                          s.is_required
                                                            ? "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100"
                                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200"
                                                        }`}
                                                      >
                                                        {s.is_required ? "REQ" : "PREF"}
                                                      </button>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                      <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                        <div
                                                          className="h-full bg-violet-600 rounded-full"
                                                          style={{ width: `${pct}%` }}
                                                        />
                                                      </div>
                                                      <span className="text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-400 w-7 text-right">
                                                        {pct}%
                                                      </span>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>

                                        {/* Keywords Box */}
                                        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 space-y-2.5">
                                          <div className="flex items-center justify-between pb-1 border-b border-zinc-200/60 dark:border-zinc-800/60">
                                            <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                                              <Search className="h-3.5 w-3.5 text-emerald-500" />
                                              Keywords &amp; Synonyms ({rKeywords.length})
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => setSelectedRoleForDetail(role)}
                                              className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                                            >
                                              + Edit in Sheet
                                            </button>
                                          </div>

                                          {rKeywords.length === 0 ? (
                                            <p className="text-[11px] text-zinc-400 py-1 italic">
                                              No keywords mapped yet.
                                            </p>
                                          ) : (
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                              {rKeywords.map((kw) => {
                                                const matchPct = Math.round(Number(kw.match_weight ?? 1.0) * 100);
                                                return (
                                                  <div
                                                    key={kw.alias_id}
                                                    className="flex items-center justify-between text-xs gap-2 py-0.5"
                                                  >
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                                                        {kw.alias_name}
                                                      </span>
                                                      {Boolean(kw.is_primary) && (
                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
                                                          PRIMARY
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                      <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                        <div
                                                          className="h-full bg-emerald-600 rounded-full"
                                                          style={{ width: `${matchPct}%` }}
                                                        />
                                                      </div>
                                                      <span className="text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-400 w-7 text-right">
                                                        {matchPct}%
                                                      </span>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* ── ROLE DETAIL SLIDE-OVER SHEET ───────────────────────────────────── */}
      {selectedRoleForDetail && (
        <RoleDetailSheet
          role={selectedRoleForDetail}
          categories={categories}
          skills={roleSkills}
          keywords={keywords}
          masterSkills={masterSkills}
          open={!!selectedRoleForDetail}
          onClose={() => setSelectedRoleForDetail(null)}
          onUpdateRole={editRole}
          onAddSkill={addRoleSkill}
          onEditSkill={editRoleSkill}
          onRemoveSkill={removeRoleSkill}
          onAddKeyword={addKeyword}
          onEditKeyword={editKeyword}
          onRemoveKeyword={removeKeyword}
        />
      )}

      {/* ── MODAL: Create / Edit Category ─────────────────────────────────── */}
      {categoryModalOpen && (
        <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">
                {editingCategory ? "Edit Job Category" : "Add New Job Category"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold">Category Name *</label>
                <Input
                  value={catNameInput}
                  onChange={(e) => {
                    setCatNameInput(e.target.value);
                    if (!editingCategory && (!catCodeInput || catCodeInput === slugifyCode(catNameInput))) {
                      setCatCodeInput(slugifyCode(e.target.value));
                    }
                  }}
                  placeholder="e.g. Artificial Intelligence & ML"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Category Code (Unique Slug)</label>
                <Input
                  value={catCodeInput}
                  onChange={(e) => setCatCodeInput(e.target.value)}
                  placeholder="e.g. ai_ml"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Description</label>
                <textarea
                  rows={3}
                  value={catDescInput}
                  onChange={(e) => setCatDescInput(e.target.value)}
                  placeholder="Category domain scope and guidelines…"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Category Status Toggle */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/40">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold">Category Status</div>
                  <div className="text-[11px] text-muted-foreground">
                    {catIsActiveInput ? "Active — Included in taxonomy & matching" : "Inactive — Excluded from matching"}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCatIsActiveInput(!catIsActiveInput)}
                  className={`h-8 text-xs font-semibold gap-1.5 ${
                    catIsActiveInput
                      ? "text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800"
                      : "text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800"
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  {catIsActiveInput ? "Active" : "Inactive"}
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setCategoryModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveCategory}
                disabled={catSaving || !catNameInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {catSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Save Category
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── MODAL: Create / Edit Role ─────────────────────────────────────── */}
      {roleModalOpen && (
        <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">
                {editingRole ? "Edit Standard Role" : "Add Standard Role"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold">Standard Role Name *</label>
                <Input
                  value={roleNameInput}
                  onChange={(e) => setRoleNameInput(e.target.value)}
                  placeholder="e.g. Machine Learning Engineer"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Job Category</label>
                <SearchableSelect
                  value={String(targetCatIdForNewRole)}
                  onValueChange={(val) => setTargetCatIdForNewRole(Number(val))}
                  options={categories.map((c) => ({
                    value: String(c.category_id),
                    label: c.category_name,
                  }))}
                  placeholder="Select category"
                  triggerClassName="h-9 text-xs w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Experience Level</label>
                <SearchableSelect
                  value={roleExpLevelInput}
                  onValueChange={(val) => setRoleExpLevelInput(val as ExperienceLevel)}
                  options={EXPERIENCE_LEVEL_OPTIONS}
                  placeholder="Select experience level"
                  triggerClassName="h-9 text-xs w-full"
                />
              </div>

              {/* Role Status Toggle */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/40">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold">Role Status</div>
                  <div className="text-[11px] text-muted-foreground">
                    {roleIsActiveInput ? "Active — Eligible for matching algorithm" : "Inactive — Excluded from matching calculations"}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRoleIsActiveInput(!roleIsActiveInput)}
                  className={`h-8 text-xs font-semibold gap-1.5 ${
                    roleIsActiveInput
                      ? "text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800"
                      : "text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800"
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  {roleIsActiveInput ? "Active" : "Inactive"}
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setRoleModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRole}
                disabled={roleSaving || !roleNameInput.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {roleSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Save Role
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── MODAL: Delete Category Confirmation ───────────────────────────── */}
      <Dialog open={Boolean(deleteCatTarget)} onOpenChange={(open) => !open && setDeleteCatTarget(null)}>
        <DialogContent className="sm:max-w-md sm:gap-2 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Confirm Category Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs space-y-2 text-muted-foreground">
            <p>
              Are you sure you want to permanently delete category{" "}
              <strong className="text-foreground">&quot;{deleteCatTarget?.category_name}&quot;</strong> (#{deleteCatTarget?.category_id})?
            </p>
            <p className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 text-amber-800 dark:text-amber-300 text-[11px]">
              <strong>Data Safeguard:</strong> This permanently deletes the category. If active standard roles or job postings reference this category, deletion will be blocked by system safeguards.
            </p>
          </div>
          <div className="flex items-center justify-end sm:gap-2 gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteCatTarget(null)}
              className="h-9 px-3 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleConfirmDeleteCategory}
              className="h-9 px-4 rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete Permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: Delete Role Confirmation ──────────────────────────────── */}
      <Dialog open={Boolean(deleteRoleTarget)} onOpenChange={(open) => !open && setDeleteRoleTarget(null)}>
        <DialogContent className="sm:max-w-md sm:gap-2 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Confirm Role Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs space-y-2 text-muted-foreground">
            <p>
              Are you sure you want to permanently delete standard role{" "}
              <strong className="text-foreground">&quot;{deleteRoleTarget?.role_name}&quot;</strong> (#{deleteRoleTarget?.role_id})?
            </p>
            <p className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 text-amber-800 dark:text-amber-300 text-[11px]">
              <strong>Data Safeguard:</strong> This permanently deletes the standard role. If mapped skills, search keywords, or job postings reference this role, deletion will be blocked by system safeguards.
            </p>
          </div>
          <div className="flex items-center justify-end sm:gap-2 gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteRoleTarget(null)}
              className="h-9 px-3 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleConfirmDeleteRole}
              className="h-9 px-4 rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete Permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
