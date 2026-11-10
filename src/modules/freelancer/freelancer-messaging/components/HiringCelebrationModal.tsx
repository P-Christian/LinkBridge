/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// src/modules/freelancer/freelancer-messaging/components/HiringCelebrationModal.tsx

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CelebrationEvent } from "../types";
import {
  Trophy,
 
  PartyPopper,
  CheckCircle2,
  Briefcase,
  ArrowRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface HiringCelebrationModalProps {
  celebration: CelebrationEvent | null;
  onDismiss: () => void;
}

// ─── 40 Unique Floating Confetti Particles ─────────────────────────────────────

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  targetY: number;
  targetX: number;
  rotate: number;
  scale: number;
  color: string;
  delay: number;
  duration: number;
  shape: "rect" | "circle" | "strip";
}

const CONFETTI_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#eab308", // yellow
];

export default function HiringCelebrationModal({
  celebration,
  onDismiss,
}: HiringCelebrationModalProps) {
  const [mounted, setMounted] = useState(false);
  const isOpen = Boolean(celebration && celebration.type === "HIRED");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate 45 deterministic particles on open
  const particles: ConfettiParticle[] = useMemo(() => {
    if (!isOpen) return [];
    return Array.from({ length: 45 }, (_, i) => {
      const angle = (i / 45) * 360;
      const distance = 250 + (i % 5) * 60;
      const rad = (angle * Math.PI) / 180;
      return {
        id: i,
        x: 0,
        y: 0,
        targetX: Math.cos(rad) * distance + (Math.sin(i) * 50),
        targetY: Math.sin(rad) * distance - 80,
        rotate: (i * 47) % 720 - 360,
        scale: 0.6 + ((i % 4) * 0.2),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: (i % 6) * 0.04,
        duration: 1.4 + ((i % 4) * 0.2),
        shape: i % 3 === 0 ? "circle" : i % 3 === 1 ? "rect" : "strip",
      };
    });
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onDismiss]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden">
          {/* ── Dark Backdrop Blur ────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={onDismiss}
          />

          {/* ── Bursting Confetti Particles ──────────────────────────────── */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 1,
                  scale: 0,
                  rotate: 0,
                }}
                animate={{
                  x: p.targetX,
                  y: p.targetY,
                  opacity: [0, 1, 1, 0],
                  scale: [0, p.scale, p.scale * 0.8, 0],
                  rotate: p.rotate,
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  backgroundColor: p.color,
                  width: p.shape === "strip" ? "12px" : p.shape === "rect" ? "8px" : "8px",
                  height: p.shape === "strip" ? "4px" : "8px",
                  borderRadius: p.shape === "circle" ? "9999px" : "2px",
                }}
                className="absolute shadow-sm"
              />
            ))}
          </div>

          {/* ── Modal Card ──────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.82, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 20 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-primary/20 bg-card/95 text-card-foreground p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={onDismiss}
              className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition max-md:size-11 max-md:grid max-md:place-items-center"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Glowing Trophy / Badge Icon */}
            <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.25, 1] }}
                transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
                className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 opacity-20 blur-xl animate-pulse"
              />
              <motion.div
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.2 }}
                className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-xl shadow-emerald-500/30"
              >
                <Trophy className="h-10 w-10 text-white" />
              </motion.div>
              {/* <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.45 }}
                className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-zinc-950 shadow-md"
              >
              </motion.div> */}
            </div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-2 mb-5"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60">
                <PartyPopper className="h-3.5 w-3.5" />
                OFFICIAL OFFER EXTENDED
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                Congratulations! You&apos;re Hired!
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                The employer has reviewed your application and interview, and has officially selected you for this position.
              </p>
            </motion.div>

            {/* Job Details Card */}
            {celebration?.job_title && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="mb-6 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Position
                    </span>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {celebration.job_title}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Hired</span>
                </div>
              </motion.div>
            )}

            {/* Action CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Button
                type="button"
                onClick={onDismiss}
                className="w-full h-12 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 gap-2 transition cursor-pointer"
              >
                <span>Awesome, Let&apos;s Work!</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
