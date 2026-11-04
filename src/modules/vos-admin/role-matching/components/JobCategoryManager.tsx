// src/modules/vos-admin/role-matching/components/JobCategoryManager.tsx

"use client";

import React, { useState, useCallback } from "react";
import { FolderTree, Plus, Loader2, Check, Pencil, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [aiDescLoading, setAiDescLoading] = useState(false);

  const openCreateModal = () => {
    setEditingCategory(null);
    setNameInput("");
    setCodeInput("");
    setDescInput("");
    setFormError("");
    setOpenModal(true);
  };

  const openEditModal = (cat: JobCategory) => {
    setEditingCategory(cat);
    setNameInput(cat.category_name);
    setCodeInput(cat.category_code);
    setDescInput(cat.description || "");
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
      });
    } else {
      ok = await addCategory({
        category_name: nameInput.trim(),
        category_code: code,
        description: descInput.trim() || null,
        is_active: true,
      });
    }

    setSubmitting(false);
    if (ok) {
      setOpenModal(false);
    }
  };

  const handleDelete = async (catId: number) => {
    await removeCategory(catId);
    setConfirmDeleteId(null);
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
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-400">
                  No job categories created yet.
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.category_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="p-4 font-mono text-zinc-400">#{cat.category_id}</td>
                  <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{cat.category_name}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full font-mono text-[11px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {cat.category_code}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-500 max-w-xs truncate">{cat.description || "—"}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                      <Check className="h-3 w-3" /> Active
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {confirmDeleteId === cat.category_id ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-[11px] text-rose-600 font-semibold mr-1">Delete?</span>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleDelete(cat.category_id)}
                          className="h-7 px-2 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
                        >
                          Yes
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                          className="h-7 px-2 text-[11px] text-zinc-500 hover:text-zinc-900"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(cat)} className="h-7 w-7 p-0 text-zinc-500 hover:text-indigo-600">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(cat.category_id)} className="h-7 w-7 p-0 text-zinc-500 hover:text-rose-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
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
