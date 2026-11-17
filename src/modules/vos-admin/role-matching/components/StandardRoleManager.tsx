// src/modules/vos-admin/role-matching/components/StandardRoleManager.tsx

"use client";

import React, { useState, useMemo } from "react";
import { Briefcase, Plus, Loader2, Check, Pencil, Power, Ban, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useStandardRoles } from "../hooks/useStandardRoles";
import { useJobCategories } from "../hooks/useJobCategories";
import { validateRoleInput } from "../validators";
import { ExperienceLevel, StandardRole } from "../types";

const LEVELS: ExperienceLevel[] = ["ENTRY", "JUNIOR", "MID", "SENIOR", "LEAD", "EXECUTIVE"];

export function StandardRoleManager() {
  const { categories } = useJobCategories();
  const [selectedCatId, setSelectedCatId] = useState<number | undefined>(undefined);
  const { roles, loading, addRole, editRole } = useStandardRoles(selectedCatId);

  const [openModal, setOpenModal] = useState(false);
  const [editingRole, setEditingRole] = useState<StandardRole | null>(null);

  const [roleName, setRoleName] = useState("");
  const [catId, setCatId] = useState<number>(0);
  const [expLevel, setExpLevel] = useState<ExperienceLevel>("MID");
  const [isActiveInput, setIsActiveInput] = useState(true);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StandardRole | null>(null);
  const [isDeleting] = useState(false);

  // Inactive roles sort to the bottom (last)
  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => {
      const aActive = a.is_active !== false;
      const bActive = b.is_active !== false;
      if (aActive === bActive) return a.role_id - b.role_id;
      return aActive ? -1 : 1;
    });
  }, [roles]);

  const handleToggleActive = async (role: StandardRole) => {
    const updatedStatus = role.is_active === false;
    const ok = await editRole({
      role_id: role.role_id,
      is_active: updatedStatus,
    });
    if (ok) {
      toast.success(
        `Standard role marked as ${updatedStatus ? "Active" : "Inactive"}.`
      );
    }
  };
 

  const openCreateModal = () => {
    setEditingRole(null);
    setRoleName("");
    setCatId(categories[0]?.category_id ?? 0);
    setExpLevel("MID");
    setIsActiveInput(true);
    setFormError("");
    setOpenModal(true);
  };

  const openEditModal = (role: StandardRole) => {
    setEditingRole(role);
    setRoleName(role.role_name);
    setCatId(role.category_id);
    setExpLevel(role.experience_level || "MID");
    setIsActiveInput(role.is_active !== false);
    setFormError("");
    setOpenModal(true);
  };

  const handleSave = async () => {
    const valid = validateRoleInput(roleName, catId);
    if (!valid.valid) {
      setFormError(valid.error || "Invalid input");
      return;
    }

    setSubmitting(true);
    setFormError("");

    let ok = false;
    if (editingRole) {
      ok = await editRole({
        role_id: editingRole.role_id,
        role_name: roleName.trim(),
        category_id: catId,
        experience_level: expLevel,
        is_active: isActiveInput,
      });
    } else {
      ok = await addRole({
        role_name: roleName.trim(),
        category_id: catId,
        experience_level: expLevel,
        is_active: isActiveInput,
      });
    }

    setSubmitting(false);
    if (ok) {
      setOpenModal(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-600" />
            Standard Job Roles
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Manage official canonical titles and experience level expectations.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCatId ?? ""}
            onChange={(e) => setSelectedCatId(e.target.value ? Number(e.target.value) : undefined)}
            className="h-9 text-xs rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 font-medium"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
            ))}
          </select>
          <Button onClick={openCreateModal} className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-2 border-0">
            <Plus className="h-4 w-4" />
            Add Standard Role
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 uppercase tracking-wider text-zinc-500 font-bold">
            <tr>
              <th className="p-4">Role ID</th>
              <th className="p-4">Standard Role Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Experience Level</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading standard roles…
                </td>
              </tr>
            ) : sortedRoles.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-400">
                  No standard roles found.
                </td>
              </tr>
            ) : (
              sortedRoles.map((r) => (
                <tr
                  key={r.role_id}
                  className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ${r.is_active === false ? "opacity-60 bg-zinc-50/50 dark:bg-zinc-900/40" : ""
                    }`}
                >
                  <td className="p-4 font-mono text-zinc-400">#{r.role_id}</td>
                  <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    {r.role_name}
                    {r.is_active === false && (
                      <span className="text-[10px] uppercase font-bold text-zinc-400 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.2 rounded-md">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">{r.category_name || r.category_id}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {r.experience_level}
                    </span>
                  </td>
                  <td className="p-4">
                    {r.is_active !== false ? (
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
                        onClick={() => handleToggleActive(r)}
                        title={r.is_active !== false ? "Deactivate (Mark Inactive)" : "Activate (Mark Active)"}
                        className={`h-7 px-2 text-[11px] font-semibold gap-1 rounded-lg ${r.is_active !== false
                            ? "text-zinc-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          }`}
                      >
                        <Power className="h-3 w-3" />
                        {r.is_active !== false ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(r)}
                        className="h-7 w-7 p-0 text-zinc-500 hover:text-blue-600"
                      >
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
              Are you sure you want to permanently delete standard role{" "}
              <strong className="text-foreground">
                &quot;{deleteTarget?.role_name}&quot;
              </strong>{" "}
              (#{deleteTarget?.role_id})?
            </p>
            <p className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 text-amber-800 dark:text-amber-300 text-[11px]">
              <strong>Data Safeguard:</strong> This operation deletes the row from the database. If this role has mapped skills, search keywords, or active job postings, deletion will be blocked by system safeguards.
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

          </div>
        </DialogContent>
      </Dialog>

      {/* Modal */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingRole ? `Edit Standard Role #${editingRole.role_id}` : "Add Standard Job Role"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            {formError && <p className="text-rose-600 text-xs font-semibold">{formError}</p>}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Standard Role Name</label>
              <Input placeholder="e.g. Frontend Developer" value={roleName} onChange={(e) => setRoleName(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Job Category</label>
              <select
                value={catId}
                onChange={(e) => setCatId(Number(e.target.value))}
                className="w-full h-9 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 font-medium"
              >
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Experience Level</label>
              <select
                value={expLevel}
                onChange={(e) => setExpLevel(e.target.value as ExperienceLevel)}
                className="w-full h-9 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 font-medium"
              >
                {LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>

            {/* Status Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/40">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold">Role Status</div>
                <div className="text-[11px] text-muted-foreground">
                  {isActiveInput ? "Active — Eligible for matching algorithm" : "Inactive — Excluded from matching calculations"}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsActiveInput(!isActiveInput)}
                className={`h-8 text-xs font-semibold gap-1.5 ${isActiveInput
                    ? "text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800"
                    : "text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800"
                  }`}
              >
                <Power className="h-3.5 w-3.5" />
                {isActiveInput ? "Active" : "Inactive"}
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" size="sm" onClick={() => setOpenModal(false)} className="h-9 text-xs">Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={submitting} className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editingRole ? "Update Role" : "Save Role"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
