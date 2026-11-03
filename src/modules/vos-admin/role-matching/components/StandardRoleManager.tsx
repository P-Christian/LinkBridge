// src/modules/vos-admin/role-matching/components/StandardRoleManager.tsx

"use client";

import React, { useState } from "react";
import { Briefcase, Plus, Loader2, Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStandardRoles } from "../hooks/useStandardRoles";
import { useJobCategories } from "../hooks/useJobCategories";
import { validateRoleInput } from "../validators";
import { ExperienceLevel, StandardRole } from "../types";

const LEVELS: ExperienceLevel[] = ["ENTRY", "JUNIOR", "MID", "SENIOR", "LEAD", "EXECUTIVE"];

export function StandardRoleManager() {
  const { categories } = useJobCategories();
  const [selectedCatId, setSelectedCatId] = useState<number | undefined>(undefined);
  const { roles, loading, addRole, editRole, removeRole } = useStandardRoles(selectedCatId);

  const [openModal, setOpenModal] = useState(false);
  const [editingRole, setEditingRole] = useState<StandardRole | null>(null);

  const [roleName, setRoleName] = useState("");
  const [catId, setCatId] = useState<number>(0);
  const [expLevel, setExpLevel] = useState<ExperienceLevel>("MID");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openCreateModal = () => {
    setEditingRole(null);
    setRoleName("");
    setCatId(categories[0]?.category_id ?? 0);
    setExpLevel("MID");
    setFormError("");
    setOpenModal(true);
  };

  const openEditModal = (role: StandardRole) => {
    setEditingRole(role);
    setRoleName(role.role_name);
    setCatId(role.category_id);
    setExpLevel(role.experience_level || "MID");
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
      });
    } else {
      ok = await addRole({
        role_name: roleName.trim(),
        category_id: catId,
        experience_level: expLevel,
        is_active: true,
      });
    }

    setSubmitting(false);
    if (ok) {
      setOpenModal(false);
    }
  };

  const handleDelete = async (roleId: number) => {
    if (confirm("Are you sure you want to delete this standard role?")) {
      await removeRole(roleId);
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
            ) : roles.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-400">
                  No standard roles found.
                </td>
              </tr>
            ) : (
              roles.map((r) => (
                <tr key={r.role_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="p-4 font-mono text-zinc-400">#{r.role_id}</td>
                  <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{r.role_name}</td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">{r.category_name || r.category_id}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {r.experience_level}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                      <Check className="h-3 w-3" /> Active
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(r)} className="h-7 w-7 p-0 text-zinc-500 hover:text-blue-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(r.role_id)} className="h-7 w-7 p-0 text-zinc-500 hover:text-rose-600">
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
