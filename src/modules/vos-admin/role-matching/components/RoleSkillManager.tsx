// src/modules/vos-admin/role-matching/components/RoleSkillManager.tsx

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { CheckCircle2, Plus, Loader2, ShieldAlert, Star, Pencil, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { useRoleSkills } from "../hooks/useRoleSkills";
import { useStandardRoles } from "../hooks/useStandardRoles";
import { RoleSkillMapping } from "../types";
import type { AiSuggestResult, AiSuggestedSkill } from "@/app/api/vos-admin/job-roles/ai-suggest/route";

export function RoleSkillManager() {
  const { roles } = useStandardRoles();
  const [selectedRoleId, setSelectedRoleId] = useState<number | undefined>(undefined);
  const { roleSkills, masterSkills, loading, addRoleSkill, editRoleSkill } = useRoleSkills(selectedRoleId);

  const [openModal, setOpenModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<RoleSkillMapping | null>(null);

  const [targetRoleId, setTargetRoleId] = useState<number>(0);
  const [skillId, setSkillId] = useState<number>(0);
  const [weight, setWeight] = useState<number>(1.0);
  const [isRequired, setIsRequired] = useState(true);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // AI Suggest state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTargetRoleId, setAiTargetRoleId] = useState<number>(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const abortAi = useRequestAbort();
  const [aiSkillSuggestions, setAiSkillSuggestions] = useState<AiSuggestedSkill[]>([]);
  const [aiCached, setAiCached] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);

  const openCreateModal = () => {
    setEditingSkill(null);
    setTargetRoleId(roles[0]?.role_id ?? 0);
    setSkillId(masterSkills[0]?.id ?? 0);
    setWeight(1.0);
    setIsRequired(true);
    setFormError("");
    setOpenModal(true);
  };

  const openEditModal = (s: RoleSkillMapping) => {
    setEditingSkill(s);
    setTargetRoleId(s.role_id);
    setSkillId(s.skill_id);
    setWeight(s.importance_weight ?? 1.0);
    setIsRequired(!!s.is_required);
    setFormError("");
    setOpenModal(true);
  };

  const handleSave = async () => {
    if (!targetRoleId || !skillId) {
      setFormError(
        masterSkills.length === 0
          ? "No master skills are loaded, so there is nothing to map. Reload this page once the skill list is readable."
          : "Standard Role and Skill selection are required."
      );
      return;
    }

    setSubmitting(true);
    setFormError("");

    let ok = false;
    if (editingSkill) {
      ok = await editRoleSkill({
        id: editingSkill.id,
        role_id: targetRoleId,
        skill_id: skillId,
        importance_weight: weight,
        is_required: isRequired,
      });
    } else {
      ok = await addRoleSkill({
        role_id: targetRoleId,
        skill_id: skillId,
        importance_weight: weight,
        is_required: isRequired,
      });
    }

    setSubmitting(false);
    if (ok) {
      setOpenModal(false);
    }
  };

  

  const handleAiSuggest = useCallback(async (overrideRoleId?: number) => {
    const roleIdToUse = overrideRoleId || selectedRoleId || roles[0]?.role_id;
    const targetRoleObj = roles.find((r) => r.role_id === roleIdToUse);
    if (!targetRoleObj) {
      setAiError("No standard role is available to generate for. Reload this page once the role list is readable.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    setAiSkillSuggestions([]);
    setSelectedSkills(new Set());
    // A generation is posted against whatever role is selected when Add is
    // clicked, so only the read for the role still selected may fill the list.
    const signal = abortAi();
    try {
      const res = await fetch("/api/vos-admin/job-roles/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          role_name: targetRoleObj.role_name,
          category_name: targetRoleObj.category_name ?? "",
        }),
      });
      if (signal.aborted) return;
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "AI suggestion failed.");
      }
      const data: AiSuggestResult = await res.json();
      if (signal.aborted) return;
      setAiSkillSuggestions(data.skills);
      setAiCached(data.cached);
      setSelectedSkills(new Set(data.skills.map((s) => s.skill_name)));
    } catch (err: unknown) {
      if (signal.aborted) return;
      setAiError((err as Error).message || "AI skill suggestion failed.");
    } finally {
      if (!signal.aborted) setAiLoading(false);
    }
  }, [selectedRoleId, roles, abortAi]);

  /** Switching the target role invalidates anything generated for the old one. */
  const changeAiTargetRole = useCallback((roleId: number) => {
    abortAi();
    setAiTargetRoleId(roleId);
    setAiSkillSuggestions([]);
    setSelectedSkills(new Set());
    setAiCached(false);
    setAiError("");
  }, [abortAi]);

  const openAiModal = () => {
    const defaultRole = selectedRoleId ?? roles[0]?.role_id ?? 0;
    abortAi();
    setAiTargetRoleId(defaultRole);
    setAiSkillSuggestions([]);
    setSelectedSkills(new Set());
    setAiError("");
    setAiModalOpen(true);
  };

  const toggleSkill = (skillName: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skillName)) next.delete(skillName);
      else next.add(skillName);
      return next;
    });
  };

  // The loaded mappings belong to the role selected in the toolbar, so they only
  // answer "already mapped?" for that role. Comparing another role's suggestions
  // against them marked a skill as already existing because a different role had
  // it, and the bulk add then silently skipped it.
  const dedupeMatchesTarget = selectedRoleId === undefined || selectedRoleId === aiTargetRoleId;
  const mappedNamesForTarget = useMemo(() => {
    const target = aiTargetRoleId || selectedRoleId;
    return new Set(
      roleSkills
        .filter((s) => s.role_id === target)
        .map((s) => (s.skill_name || "").trim().toLowerCase())
        .filter(Boolean)
    );
  }, [roleSkills, aiTargetRoleId, selectedRoleId]);

  const handleBulkAdd = async () => {
    const targetId = aiTargetRoleId || selectedRoleId;
    if (!targetId) {
      setAiError("Choose the role these skills belong to before adding them.");
      return;
    }
    if (selectedSkills.size === 0) return;
    setBulkAdding(true);
    const toAdd = aiSkillSuggestions.filter((s) => selectedSkills.has(s.skill_name));

    const newOnly = dedupeMatchesTarget
      ? toAdd.filter((s) => !mappedNamesForTarget.has(s.skill_name.trim().toLowerCase()))
      : toAdd;

    const failed: string[] = [];
    for (const s of newOnly) {
      const matchedMaster = masterSkills.find(
        (m) => m.skill_name.toLowerCase() === s.skill_name.toLowerCase()
      );
      // Unmatched suggestions used to fall back to masterSkills[0], so a
      // generated "Kubernetes" was stored as whichever skill happened to be
      // first — usually React. Sending the name lets the route match or create
      // the master skill and refuse to guess when it cannot.
      const ok = await addRoleSkill({
        role_id: targetId,
        ...(matchedMaster ? { skill_id: matchedMaster.id } : { skill_name: s.skill_name }),
        importance_weight: s.importance_weight,
        is_required: s.is_required,
      });
      if (!ok) failed.push(s.skill_name);
    }

    setBulkAdding(false);
    abortAi();
    if (failed.length > 0) {
      toast.error(
        `${failed.length} of ${newOnly.length} suggested skill(s) were not mapped: ${failed.join(", ")}.`
      );
    }
    setAiSkillSuggestions([]);
    setSelectedSkills(new Set());
    setAiModalOpen(false);
  };



  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-violet-600" />
            Role Skills &amp; Requirements
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Associate core skills to standard job roles with importance weights &amp; requirement types.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={openAiModal}
            className="h-9 px-4 rounded-xl text-xs font-bold gap-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 shadow-md transition-all"
          >
            <Sparkles className="h-4 w-4" />
            ✨ AI Skill Generator
          </Button>
          <select
            value={selectedRoleId ?? ""}
            onChange={(e) => setSelectedRoleId(e.target.value ? Number(e.target.value) : undefined)}
            className="h-9 text-xs rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 font-medium"
          >
            <option value="">Filter by Standard Role...</option>
            {roles.map((r) => (
              <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
            ))}
          </select>
          <Button onClick={openCreateModal} className="h-9 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs gap-2 border-0">
            <Plus className="h-4 w-4" />
            Add Role Skill
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 uppercase tracking-wider text-zinc-500 font-bold">
            <tr>
              <th className="p-4">Mapping ID</th>
              <th className="p-4">Standard Role</th>
              <th className="p-4">Associated Skill</th>
              <th className="p-4">Importance Weight</th>
              <th className="p-4">Requirement Type</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading role skills…
                </td>
              </tr>
            ) : roleSkills.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-400">
                  No role skills mapped yet.
                </td>
              </tr>
            ) : (
              roleSkills.map((s, index) => (
                <tr key={`${s.id}-${index}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">

                  <td className="p-4 font-mono text-zinc-400">#{s.id}</td>
                  <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{s.role_name || s.role_id}</td>
                  <td className="p-4 text-violet-600 dark:text-violet-400 font-semibold">{s.skill_name || s.skill_id}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                      {Math.round((s.importance_weight ?? 1.0) * 100)}%
                    </span>
                  </td>
                  <td className="p-4">
                    {s.is_required ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">
                        <Star className="h-3 w-3 fill-rose-500 text-rose-500" /> Core Required
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        Bonus / Optional
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(s)} className="h-7 w-7 p-0 text-zinc-500 hover:text-violet-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingSkill ? `Edit Role Skill Mapping #${editingSkill.id}` : "Add Skill to Standard Role"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            {formError && <p className="text-rose-600 text-xs font-semibold">{formError}</p>}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Standard Role</label>
              <select
                value={targetRoleId}
                onChange={(e) => setTargetRoleId(Number(e.target.value))}
                className="w-full h-9 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 font-medium"
              >
                {roles.map((r) => (
                  <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Skill</label>
              <select
                value={skillId}
                onChange={(e) => setSkillId(Number(e.target.value))}
                className="w-full h-9 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 font-medium"
              >
                {masterSkills.length > 0 ? (
                  masterSkills.map((m) => (
                    <option key={m.id} value={m.id}>{m.skill_name}</option>
                  ))
                ) : (
                  // A hard-coded React/Node.js list used to fill this picker when
                  // the master-skill read failed, so the admin could map a real
                  // role onto ids 1-5 belonging to whatever rows those happened
                  // to be.
                  <option value={0}>No skills available to map</option>
                )}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">Importance Weight</label>
                <span className="font-bold text-violet-600">{Math.round(weight * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.01"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="isRequired" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
              <label htmlFor="isRequired" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Core Required Skill for this Role</label>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" size="sm" onClick={() => setOpenModal(false)} className="h-9 text-xs">Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={submitting} className="h-9 text-xs bg-violet-600 hover:bg-violet-700 text-white">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editingSkill ? "Update Skill Mapping" : "Save Role Skill"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Skill Assistant Modal */}
      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl border-violet-100 dark:border-violet-900 overflow-hidden p-0">
          <div className="bg-gradient-to-r from-indigo-950 via-zinc-900 to-violet-950 text-white p-6 space-y-1 relative">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-400" />
              <DialogTitle className="text-lg font-extrabold text-white">
                Gemini AI Skill Requirements Generator
              </DialogTitle>
            </div>
            <p className="text-xs text-indigo-200/80">
              Instantly generate core skill requirements, importance weights, and requirement flags for any role.
            </p>
          </div>


          <div className="p-5 space-y-4 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Target Standard Role
              </label>
              <div className="flex gap-2">
                <select
                  value={aiTargetRoleId}
                  onChange={(e) => changeAiTargetRole(Number(e.target.value))}
                  className="flex-1 h-10 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  {roles.map((r) => (
                    <option key={r.role_id} value={r.role_id}>
                      {r.role_name} ({r.category_name || "General"})
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => handleAiSuggest(aiTargetRoleId)}
                  disabled={aiLoading}
                  className="h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs gap-1.5 border-0 shrink-0"
                >
                  {aiLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {aiSkillSuggestions.length > 0 ? "Regenerate" : "Generate"}
                </Button>
              </div>
            </div>

            {aiError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{aiError}</span>
              </div>
            )}

            {aiSkillSuggestions.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      Suggested Skill Requirements ({selectedSkills.size}/{aiSkillSuggestions.length} selected)
                    </span>
                    {aiCached && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
                        CACHED · 0 RPD
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedSkills(new Set(aiSkillSuggestions.map((s) => s.skill_name)))}
                      className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-zinc-300">·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSkills(new Set())}
                      className="text-[11px] font-semibold text-zinc-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 max-h-72 overflow-y-auto p-1.5 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50">
                  {aiSkillSuggestions.map((s) => {
                    const norm = s.skill_name.trim().toLowerCase();
                    const isInDb = dedupeMatchesTarget && mappedNamesForTarget.has(norm);
                    const isSelected = selectedSkills.has(s.skill_name);

                    return (
                      <button
                        key={s.skill_name}
                        type="button"
                        onClick={() => toggleSkill(s.skill_name)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? "bg-violet-600 text-white border-violet-600 shadow-xs"
                            : "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-violet-300"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                        <span>{s.skill_name}</span>
                        {s.is_required && (
                          <Star className={`h-3 w-3 ${isSelected ? "fill-amber-300 text-amber-300" : "fill-amber-500 text-amber-500"}`} />
                        )}
                        {isInDb && (
                          <span
                            className={`px-1.5 py-0.5 rounded-md font-mono text-[9px] font-bold uppercase tracking-wider ${
                              isSelected
                                ? "bg-emerald-500/30 text-emerald-100 border border-emerald-400/40"
                                : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            }`}
                          >
                            ✓ ALREADY EXISTS

                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold ${
                            isSelected ? "text-violet-200" : "text-zinc-400"
                          }`}
                        >
                          {Math.round(s.importance_weight * 100)}%
                        </span>
                      </button>
                    );
                  })}
                </div>


                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <Button variant="outline" size="sm" onClick={() => setAiModalOpen(false)} className="h-9 text-xs">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBulkAdd}
                    disabled={bulkAdding || selectedSkills.size === 0}
                    className="h-9 text-xs bg-violet-600 hover:bg-violet-700 text-white font-bold gap-1.5 border-0 shadow-sm"
                  >
                    {bulkAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add {selectedSkills.size} Skill{selectedSkills.size !== 1 ? "s" : ""}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

