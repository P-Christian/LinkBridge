"use client";

// src/modules/vos-admin/role-matching/hooks/useMatchTester.ts

import { useState, useCallback } from "react";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { SimulationResult, CandidateSimulationProfile } from "../types";
import { runMatchSimulation } from "../services/roleMatchingService";

export function useMatchTester() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const abortRead = useRequestAbort();

  const runTest = useCallback(async (keyword: string, candidateId?: number, candidate?: CandidateSimulationProfile) => {
    if (!keyword.trim()) return;
    setLoading(true);
    setError("");
    // Running a second simulation, or clearing the panel, supersedes this one:
    // a late result must not be presented as the answer to the current keyword.
    const signal = abortRead();
    try {
      const res = await runMatchSimulation(keyword, candidateId, candidate);
      if (signal.aborted) return;
      setResult(res);
    } catch (err: unknown) {
      if (signal.aborted) return;
      setError((err as Error).message || "Simulation test failed.");
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [abortRead]);

  const clearResult = useCallback(() => {
    // Without this, a simulation still running repopulates the panel the admin
    // just cleared.
    abortRead();
    setResult(null);
    setError("");
  }, [abortRead]);

  return { result, loading, error, runTest, clearResult };
}
