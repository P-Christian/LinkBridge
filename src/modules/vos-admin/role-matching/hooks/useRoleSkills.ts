"use client";

// src/modules/vos-admin/role-matching/hooks/useRoleSkills.ts

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { RoleSkillMapping, MasterSkill } from "../types";
import { fetchRoleSkills, createRoleSkill, updateRoleSkill, deleteRoleSkill, fetchMasterSkills } from "../services/roleMatchingService";

/** One toast per panel: a bulk add that fails item by item must not stack up. */
const TOAST_ID = "role-skill-mappings";

export function useRoleSkills(roleId?: number) {
  const [roleSkills, setRoleSkills] = useState<RoleSkillMapping[]>([]);
  const [masterSkills, setMasterSkills] = useState<MasterSkill[]>([]);
  const [loading, setLoading] = useState(false);

  const abortRead = useRequestAbort();

  const loadSkills = useCallback(async (rId?: number) => {
    setLoading(true);
    // Clicking another role in the tree starts a new read; this one must then
    // stay out of state, or mappings from the previous role render under the new
    // selection and editRoleSkill/removeRoleSkill act on the wrong mapping id.
    const signal = abortRead();
    try {
      const [skillsData, mastersData] = await Promise.all([
        fetchRoleSkills(rId ?? roleId),
        fetchMasterSkills().then((m) => ({ ok: true, skills: m })).catch(() => ({ ok: false, skills: [] as MasterSkill[] })),
      ]);
      if (signal.aborted) return;
      setRoleSkills(skillsData.skills);
      setMasterSkills(mastersData.skills);
      if (!mastersData.ok) {
        toast.warning("The master skill list could not be read, so the skill picker is empty.", { id: TOAST_ID });
      }
      // The GET seeds default mappings when the table is empty; a partially
      // seeded list looks complete otherwise.
      if (skillsData.warnings.length > 0) {
        toast.warning(skillsData.warnings.join(" "), { id: TOAST_ID });
      }
    } catch (err: unknown) {
      if (signal.aborted) return;
      toast.error((err as Error).message || "Failed to load role skills.", { id: TOAST_ID });
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [roleId, abortRead]);

  const addRoleSkill = useCallback(
    async (payload: Partial<RoleSkillMapping>) => {
      try {
        const created = await createRoleSkill(payload);
        const resolvedSkillName =
          created.skill_name ||
          payload.skill_name ||
          masterSkills.find((m) => m.id === (created.skill_id ?? payload.skill_id))?.skill_name;

        const hydrated: RoleSkillMapping = {
          ...created,
          skill_name: resolvedSkillName || created.skill_name || `Skill #${created.skill_id}`,
        };

        setRoleSkills((prev) => {
          const exists = prev.some((s) => s.id === hydrated.id);
          if (exists) {
            return prev.map((s) => (s.id === hydrated.id ? { ...s, ...hydrated } : s));
          }
          return [...prev, hydrated];
        });
        return true;
      } catch (err: unknown) {
        toast.error((err as Error).message || "Failed to add role skill.", { id: TOAST_ID });
        return false;
      }
    },
    [masterSkills]
  );


  const editRoleSkill = useCallback(async (payload: Partial<RoleSkillMapping>) => {
    try {
      const updated = await updateRoleSkill(payload);
      setRoleSkills((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      return true;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update role skill.", { id: TOAST_ID });
      return false;
    }
  }, []);

  const removeRoleSkill = useCallback(async (id: number) => {
    try {
      await deleteRoleSkill(id);
      setRoleSkills((prev) => prev.filter((s) => s.id !== id));
      return true;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete role skill.", { id: TOAST_ID });
      return false;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSkills(roleId);
  }, [loadSkills, roleId]);

  return { roleSkills, masterSkills, loading, loadSkills, addRoleSkill, editRoleSkill, removeRoleSkill };
}
