// src/modules/vos-admin/role-matching/components/SearchKeywordManager.tsx

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Search, Plus, Loader2, Check, ShieldAlert, Pencil,     X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { useSearchKeywords } from "../hooks/useSearchKeywords";
import { useStandardRoles } from "../hooks/useStandardRoles";
import { normalizeKeyword, validateKeywordInput } from "../validators";
import { SearchKeyword } from "../types";
import type { AiSuggestResult, AiSuggestedKeyword } from "@/app/api/vos-admin/job-roles/ai-suggest/route";

export function SearchKeywordManager() {
  const { roles } = useStandardRoles();
  const [selectedRoleId, setSelectedRoleId] = useState<number | undefined>(undefined);
  const { keywords, loading, addKeyword, editKeyword } = useSearchKeywords(selectedRoleId);

  const [openModal, setOpenModal] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<SearchKeyword | null>(null);

  const [aliasName, setAliasName] = useState("");
  const [targetRoleId, setTargetRoleId] = useState<number>(0);
  const [weight, setWeight] = useState<number>(1.0);
  const [isPrimary, setIsPrimary] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // AI Suggest state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTargetRoleId, setAiTargetRoleId] = useState<number>(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const abortAi = useRequestAbort();
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestedKeyword[]>([]);
  const [aiGovernance, setAiGovernance] = useState<AiSuggestResult["governance"] | undefined>(undefined);
  const [aiCached, setAiCached] = useState(false);
  const [selectedAliases, setSelectedAliases] = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);

  const openCreateModal = () => {
    setEditingKeyword(null);
    setAliasName("");
    setTargetRoleId(roles[0]?.role_id ?? 0);
    setWeight(1.0);
    setIsPrimary(false);
    setFormError("");
    setOpenModal(true);
  };

  const openEditModal = (k: SearchKeyword) => {
    setEditingKeyword(k);
    setAliasName(k.alias_name);
    setTargetRoleId(k.role_id);
    setWeight(k.match_weight ?? 1.0);
    setIsPrimary(!!k.is_primary);
    setFormError("");
    setOpenModal(true);
  };

  const handleSave = async () => {
    const valid = validateKeywordInput(aliasName, targetRoleId);
    if (!valid.valid) {
      setFormError(valid.error || "Invalid input");
      return;
    }

    setSubmitting(true);
    setFormError("");

    let ok = false;
    if (editingKeyword) {
      ok = await editKeyword({
        alias_id: editingKeyword.alias_id,
        alias_name: aliasName.trim(),
        normalized_alias: normalizeKeyword(aliasName),
        role_id: targetRoleId,
        match_weight: weight,
        is_primary: isPrimary,
      });
    } else {
      ok = await addKeyword({
        alias_name: aliasName.trim(),
        normalized_alias: normalizeKeyword(aliasName),
        role_id: targetRoleId,
        match_weight: weight,
        is_primary: isPrimary,
      });
    }

    setSubmitting(false);
    if (ok) {
      setOpenModal(false);
    }
  };

 

  // The generator writes to whichever role the panel targets, which is not
  // always the one selected in the toolbar — the heading has to name the former.
  const aiTargetRole = roles.find((r) => r.role_id === (aiTargetRoleId || selectedRoleId));

  const handleAiSuggest = useCallback(async (overrideRoleId?: number) => {
    const roleIdToUse = overrideRoleId || selectedRoleId || roles[0]?.role_id;
    const targetRoleObj = roles.find((r) => r.role_id === roleIdToUse);
    if (!targetRoleObj) {
      setAiError("No standard role is available to generate for. Reload this page once the role list is readable.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    setAiSuggestions([]);
    setSelectedAliases(new Set());
    // The aliases are written to whichever role is selected when Add is clicked,
    // so only the read for the role still selected may fill this list.
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
      setAiSuggestions(data.keywords);
      setAiGovernance(data.governance);
      setAiCached(data.cached);
      setSelectedAliases(new Set(data.keywords.map((k) => k.alias)));
    } catch (err: unknown) {
      if (signal.aborted) return;
      setAiError((err as Error).message || "AI suggestion failed.");
    } finally {
      if (!signal.aborted) setAiLoading(false);
    }
  }, [selectedRoleId, roles, abortAi]);

  /** Switching the target role invalidates anything generated for the old one. */
  const changeAiTargetRole = useCallback((roleId: number) => {
    abortAi();
    setAiTargetRoleId(roleId);
    setAiSuggestions([]);
    setSelectedAliases(new Set());
    setAiGovernance(undefined);
    setAiCached(false);
    setAiError("");
  }, [abortAi]);

  const openAiModal = () => {
    const defaultRole = selectedRoleId ?? roles[0]?.role_id ?? 0;
    abortAi();
    setAiTargetRoleId(defaultRole);
    setAiSuggestions([]);
    setSelectedAliases(new Set());
    setAiError("");
    setAiModalOpen(true);
  };

  const toggleAlias = (alias: string) => {
    setSelectedAliases((prev) => {
      const next = new Set(prev);
      if (next.has(alias)) next.delete(alias);
      else next.add(alias);
      return next;
    });
  };

  // The loaded aliases belong to the role selected in the toolbar, so they only
  // answer "already mapped?" for that role. Comparing another role's suggestions
  // against them dropped aliases the target role had never had.
  const dedupeMatchesTarget = selectedRoleId === undefined || selectedRoleId === aiTargetRoleId;
  const aliasesForTarget = useMemo(() => {
    const target = aiTargetRoleId || selectedRoleId;
    return new Set(
      keywords
        .filter((k) => k.role_id === target)
        .map((k) => k.normalized_alias || normalizeKeyword(k.alias_name))
    );
  }, [keywords, aiTargetRoleId, selectedRoleId]);

  const handleBulkAdd = async () => {
    const targetId = aiTargetRoleId || selectedRoleId;
    if (!targetId) {
      setAiError("Choose the role these keywords belong to before adding them.");
      return;
    }
    if (selectedAliases.size === 0) return;
    setBulkAdding(true);
    const toAdd = aiSuggestions.filter((k) => selectedAliases.has(k.alias));

    const newOnly = dedupeMatchesTarget
      ? toAdd.filter((k) => !aliasesForTarget.has(normalizeKeyword(k.alias)))
      : toAdd;

    const notSaved: string[] = [];
    for (const k of newOnly) {
      const ok = await addKeyword({
        alias_name: k.alias,
        normalized_alias: normalizeKeyword(k.alias),
        role_id: targetId,
        match_weight: k.weight,
        is_primary: false,
      });
      if (!ok) notSaved.push(k.alias);
    }

    setBulkAdding(false);
    abortAi();
    setAiSuggestions([]);
    setSelectedAliases(new Set());
    setAiModalOpen(false);
    if (notSaved.length > 0) {
      toast.error(`${notSaved.length} of ${newOnly.length} suggested keyword(s) were not saved: ${notSaved.join(", ")}.`);
    }
  };



  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Search className="h-5 w-5 text-emerald-600" />
            Search Keywords &amp; Synonyms
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Map search terms recruiters use to official standard roles with relevance weights.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={openAiModal}
            className="h-9 px-4 rounded-xl text-xs font-bold gap-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 shadow-md transition-all"
          >
 
            AI Keyword Generator
          </Button>
          <select
            value={selectedRoleId ?? ""}
            onChange={(e) => {
              setSelectedRoleId(e.target.value ? Number(e.target.value) : undefined);
            }}
            className="h-9 text-xs rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 font-medium"
          >
            <option value="">Filter by Standard Role...</option>
            {roles.map((r) => (
              <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
            ))}
          </select>
          <Button onClick={openCreateModal} className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-2 border-0">
            <Plus className="h-4 w-4" />
            Add Search Keyword
          </Button>
        </div>
      </div>

      {/* AI Suggest Error */}
      {aiError && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {aiError}
        </div>
      )}

      {/* AI Suggestion Review Panel */}
      {aiSuggestions.length > 0 && (
        <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
 
              <span className="text-sm font-bold text-violet-800 dark:text-violet-200">
                AI Suggestions for &ldquo;{aiTargetRole?.role_name ?? "no role selected"}&rdquo;
              </span>
              {aiCached && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-200 dark:bg-violet-900 text-violet-700 dark:text-violet-300">
                  CACHED · 0 RPD
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setAiSuggestions([]); setSelectedAliases(new Set()); }} className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-600">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {aiSuggestions.map((k) => (
              <button
                key={k.alias}
                type="button"
                onClick={() => toggleAlias(k.alias)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  selectedAliases.has(k.alias)
                    ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {selectedAliases.has(k.alias) && <Check className="h-3 w-3" />}
                {k.alias}
                <span className={`text-[10px] font-bold ${ selectedAliases.has(k.alias) ? "text-violet-200" : "text-zinc-400" }`}>
                  {Math.round(k.weight * 100)}%
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-violet-200 dark:border-violet-800">
            <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">
              {selectedAliases.size} of {aiSuggestions.length} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedAliases(new Set())} className="h-8 text-xs">
                Deselect All
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedAliases(new Set(aiSuggestions.map((k) => k.alias)))} className="h-8 text-xs">
                Select All
              </Button>
              <Button
                size="sm"
                onClick={handleBulkAdd}
                disabled={bulkAdding || selectedAliases.size === 0}
                className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white gap-1.5 border-0"
              >
                {bulkAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add {selectedAliases.size} Keyword{selectedAliases.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 uppercase tracking-wider text-zinc-500 font-bold">
            <tr>
              <th className="p-4">Alias ID</th>
              <th className="p-4">Search Keyword / Alias</th>
              <th className="p-4">Normalized Alias</th>
              <th className="p-4">Target Standard Role</th>
              <th className="p-4">Match Weight</th>
              <th className="p-4">Primary</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading search keywords…
                </td>
              </tr>
            ) : keywords.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-400">
                  No search keywords found.
                </td>
              </tr>
            ) : (
              keywords.map((k, index) => (
                <tr key={`${k.alias_id}-${index}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">

                  <td className="p-4 font-mono text-zinc-400">#{k.alias_id}</td>
                  <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{k.alias_name}</td>
                  <td className="p-4 font-mono text-zinc-500">{k.normalized_alias}</td>
                  <td className="p-4 text-indigo-600 dark:text-indigo-400 font-semibold">{k.role_name || k.role_id}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {Math.round(k.match_weight * 100)}%
                    </span>
                  </td>
                  <td className="p-4">
                    {k.is_primary ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
                        <Check className="h-3 w-3" /> Primary
                      </span>
                    ) : (
                      <span className="text-zinc-400 text-[11px]">Synonym</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(k)} className="h-7 w-7 p-0 text-zinc-500 hover:text-emerald-600">
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
              {editingKeyword ? `Edit Keyword #${editingKeyword.alias_id}` : "Add Search Keyword & Synonym"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            {formError && <p className="text-rose-600 text-xs font-semibold">{formError}</p>}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Search Keyword / Synonym</label>
              <Input placeholder="e.g. React Developer" value={aliasName} onChange={(e) => setAliasName(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Target Standard Role</label>
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
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">Match Weight (Relevance)</label>
                <span className="font-bold text-emerald-600">{Math.round(weight * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.01"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="isPrimary" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
              <label htmlFor="isPrimary" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Set as Primary Canonical Title</label>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" size="sm" onClick={() => setOpenModal(false)} className="h-9 text-xs">Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={submitting} className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editingKeyword ? "Update Keyword" : "Save Search Keyword"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Assistant Modal */}
      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl border-violet-100 dark:border-violet-900 overflow-hidden p-0">
          <div className="bg-gradient-to-r from-indigo-950 via-zinc-900 to-violet-950 text-white p-6 space-y-1 relative">
            <div className="flex items-center gap-2">
              
              <DialogTitle className="text-lg font-extrabold text-white">
                Gemini AI Keyword Generator
              </DialogTitle>
            </div>
            <p className="text-xs text-indigo-200/80">
              Instantly generate search terms, alternate job titles, and recruiter query synonyms for any role.
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
                  {/* {aiLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )} */}
                  {aiSuggestions.length > 0 ? "Regenerate" : "Generate"}
                </Button>
              </div>
            </div>

            {aiError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{aiError}</span>
              </div>
            )}

            {aiSuggestions.length > 0 && (
              <div className="space-y-3 pt-2">
                {/* Governance Summary Badges */}
                {aiGovernance && (
                  <div className="flex flex-wrap gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold">
                    {aiGovernance.autoApplied.length > 0 && (
                      <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                        ✓ {aiGovernance.autoApplied.length} Auto-Applied
                      </span>
                    )}
                    {aiGovernance.reused.length > 0 && (
                      <span className="text-indigo-700 dark:text-indigo-300 font-medium">
                        ↻ {aiGovernance.reused.length} Reused
                      </span>
                    )}
                    {aiGovernance.reviewRequired.length > 0 && (
                      <span className="text-amber-700 dark:text-amber-300 font-medium">
                        ⚠ {aiGovernance.reviewRequired.length} Exceptions Queued
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      Suggested Keywords ({selectedAliases.size}/{aiSuggestions.length} selected)
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
                      onClick={() => setSelectedAliases(new Set(aiSuggestions.map((k) => k.alias)))}
                      className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-zinc-300">·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedAliases(new Set())}
                      className="text-[11px] font-semibold text-zinc-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 max-h-72 overflow-y-auto p-1.5 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50">
                  {aiSuggestions.map((k) => {
                    const isInDb = dedupeMatchesTarget && aliasesForTarget.has(normalizeKeyword(k.alias));
                    const isSelected = selectedAliases.has(k.alias);

                    return (
                      <button
                        key={k.alias}
                        type="button"
                        onClick={() => toggleAlias(k.alias)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? "bg-violet-600 text-white border-violet-600 shadow-xs"
                            : "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-violet-300"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                        <span>{k.alias}</span>
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
                          {Math.round(k.weight * 100)}%
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
                    disabled={bulkAdding || selectedAliases.size === 0}
                    className="h-9 text-xs bg-violet-600 hover:bg-violet-700 text-white font-bold gap-1.5 border-0 shadow-sm"
                  >
                    {bulkAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add {selectedAliases.size} Keyword{selectedAliases.size !== 1 ? "s" : ""}
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

