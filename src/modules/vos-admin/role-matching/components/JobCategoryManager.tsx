// src/modules/vos-admin/role-matching/components/JobCategoryManager.tsx

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { FolderTree, Plus, Loader2, Check, Pencil, Trash2, Sparkles, Power, Ban, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useJobCategories } from "../hooks/useJobCategories";
import { slugifyCode, validateCategoryInput } from "../validators";
import { JobCategory } from "../types";

export function JobCategoryManager() {
  const { categories, loading, addCategory, editCategory, removeCategory } = useJobCategories();
  const [openModal, setOpenModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<JobCategory | null>(null);

  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [isActiveInput, setIsActiveInput] = useState(true);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JobCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [aiDescLoading, setAiDescLoading] = useState(false);

  // Inactive categories sort to the bottom (last)
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aActive = a.is_active !== false;
      const bActive = b.is_active !== false;
      if (aActive === bActive) return a.category_id - b.category_id;
      return aActive ? -1 : 1;
    });
  }, [categories]);

  const handleToggleActive = async (cat: JobCategory) => {
    const updatedStatus = cat.is_active === false;
    const ok = await editCategory({
      category_id: cat.category_id,
      is_active: updatedStatus,
    });
    if (ok) {
      toast.success(
        `Category marked as ${updatedStatus ? "Active" : "Inactive"}.`
      );
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setNameInput("");
    setCodeInput("");
    setDescInput("");
    setIsActiveInput(true);
    setFormError("");
    setOpenModal(true);
  };

  const openEditModal = (cat: JobCategory) => {
    setEditingCategory(cat);
    setNameInput(cat.category_name);
    setCodeInput(cat.category_code);
    setDescInput(cat.description || "");
    setIsActiveInput(cat.is_active !== false);
    setFormError("");
    setOpenModal(true);
  };

  const handleSave = async () => {
    const code = codeInput.trim() || slugifyCode(nameInput);
    const valid = validateCategoryInput(nameInput, code);
    if (!valid.valid) {
      setFormError(valid.error || "Invalid input");
      return;
    }

    setSubmitting(true);
    setFormError("");

    let ok = false;
    if (editingCategory) {
      ok = await editCategory({
        category_id: editingCategory.category_id,
        category_name: nameInput.trim(),
        category_code: code,
        description: descInput.trim() || null,
        is_active: isActiveInput,
      });
    } else {
      ok = await addCategory({
        category_name: nameInput.trim(),
        category_code: code,
        description: descInput.trim() || null,
        is_active: isActiveInput,
      });
    }

    setSubmitting(false);
    if (ok) {
      setOpenModal(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const ok = await removeCategory(deleteTarget.category_id);
    setIsDeleting(false);
    if (ok) {
      toast.success(`Category "${deleteTarget.category_name}" deleted.`);
      setDeleteTarget(null);
    }
  };

  const handleAiGenerateDesc = useCallback(async () => {
    const name = nameInput.trim() || codeInput.trim();
    if (!name) return;
    setAiDescLoading(true);
    try {
      const res = await fetch("/api/vos-admin/job-roles/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_name: name, category_name: name }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.description) setDescInput(data.description);
      }
    } catch {
      // silent — description generation is non-critical
    } finally {
      setAiDescLoading(false);
    }
  }, [nameInput, codeInput]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-indigo-600" />
            Job Categories &amp; Domains
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Manage high-level job domains and industry categories.</p>
        </div>
        <Button onClick={openCreateModal} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-2 border-0">
          <Plus className="h-4 w-4" />
          Add Job Category
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 uppercase tracking-wider text-zinc-500 font-bold">
            <tr>
              <th className="p-4">Category ID</th>
              <th className="p-4">Category Name</th>
              <th className="p-4">Category Code</th>
              <th className="p-4">Description</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading job categories…
                </td>
              </tr>
            ) : sortedCategories.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-400">
                  No job categories created yet.
                </td>
              </tr>
            ) : (
              sortedCategories.map((cat) => (
                <tr
                  key={cat.category_id}
                  className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ${
                    cat.is_active === false ? "opacity-60 bg-zinc-50/50 dark:bg-zinc-900/40" : ""
                  }`}
                >
                  <td className="p-4 font-mono text-zinc-400">#{cat.category_id}</td>
                  <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    {cat.category_name}
                    {cat.is_active === false && (
                      <span className="text-[10px] uppercase font-bold text-zinc-400 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.2 rounded-md">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full font-mono text-[11px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {cat.category_code}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-500 max-w-xs truncate">{cat.description || "—"}</td>
                  <td className="p-4">
                    {cat.is_active !== false ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                        <Check className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        <Ban className="h-3 w-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(cat)}
                        title={cat.is_active !== false ? "Deactivate (Mark Inactive)" : "Activate (Mark Active)"}
                        className={`h-7 px-2 text-[11px] font-semibold gap-1 rounded-lg ${
                          cat.is_active !== false
                            ? "text-zinc-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        }`}
                      >
                        <Power className="h-3 w-3" />
                        {cat.is_active !== false ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(cat)}
                        className="h-7 w-7 p-0 text-zinc-500 hover:text-indigo-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(cat)}
                        className="h-7 w-7 p-0 text-zinc-500 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Hard Delete Confirmation Modal */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md sm:gap-2 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Confirm Hard Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs space-y-2 text-muted-foreground">
            <p>
              Are you sure you want to permanently delete the category{" "}
              <strong className="text-foreground">
                &quot;{deleteTarget?.category_name}&quot;
              </strong>{" "}
              (#{deleteTarget?.category_id})?
            </p>
            <p className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 text-amber-800 dark:text-amber-300 text-[11px]">
              <strong>Data Safeguard:</strong> This operation deletes the row from the database. If this category has active job postings or child roles, deletion will be blocked by system safeguards.
            </p>
          </div>
          <div className="flex items-center justify-end sm:gap-2 gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
              className="h-9 px-3 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="h-9 px-4 rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete Permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingCategory ? `Edit Category #${editingCategory.category_id}` : "Add New Job Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            {formError && <p className="text-rose-600 text-xs font-semibold">{formError}</p>}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Category Name</label>
              <Input
                placeholder="e.g. Frontend Software Engineering"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  if (!editingCategory && !codeInput) setCodeInput(slugifyCode(e.target.value));
                }}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Category Code</label>
              <Input placeholder="e.g. frontend" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} className="h-9 text-xs font-mono" />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
              <div className="flex gap-2">
                <Input placeholder="Brief description of this domain…" value={descInput} onChange={(e) => setDescInput(e.target.value)} className="h-9 text-xs flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAiGenerateDesc}
                  disabled={aiDescLoading || !nameInput.trim()}
                  title="Generate description with AI"
                  className="h-9 px-3 rounded-xl border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 shrink-0"
                >
                  {aiDescLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Status Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/40">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold">Category Status</div>
                <div className="text-[11px] text-muted-foreground">
                  {isActiveInput ? "Active — Available in taxonomy & matching" : "Inactive — Excluded from matching calculations"}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsActiveInput(!isActiveInput)}
                className={`h-8 text-xs font-semibold gap-1.5 ${
                  isActiveInput
                    ? "text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800"
                    : "text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800"
                }`}
              >
                <Power className="h-3.5 w-3.5" />
                {isActiveInput ? "Active" : "Inactive"}
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" size="sm" onClick={() => setOpenModal(false)} className="h-9 text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={submitting} className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editingCategory ? "Update Category" : "Save Category"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
