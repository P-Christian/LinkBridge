// src/app/(vos-sync)/vos-sync/suspended/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut, ExternalLink, Clock } from "lucide-react";

export default function SuspendedPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      } else {
        alert("Logout failed. Please clear your cookies manually.");
      }
    } catch (error) {
      console.error("Failed to sign out:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-900/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-900/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-lg bg-zinc-900 border border-zinc-800 shadow-2xl relative z-10 text-zinc-100 overflow-hidden">
        <CardHeader className="text-center pt-8">
          <div className="mx-auto h-16 w-16 bg-red-950/40 text-red-500 border border-red-900/50 flex items-center justify-center rounded-full mb-4 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-red-500">
            Account Suspended
          </CardTitle>
          <CardDescription className="text-zinc-400 mt-2 text-sm">
            Your LinkBridge account has been placed under administrative containment.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 py-4">
          <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-lg text-sm space-y-3">
            <div>
              <span className="font-semibold text-zinc-300 block text-xs uppercase tracking-wider">Access Level</span>
              <p className="text-red-400 font-medium mt-0.5">CONTAINMENT / BLOCKED</p>
            </div>
            <div>
              <span className="font-semibold text-zinc-300 block text-xs uppercase tracking-wider">Reason</span>
              <p className="text-zinc-400 mt-0.5">
                Your account is currently restricted from logging in due to a safety review or policy violation.
              </p>
            </div>
            <div>
              <span className="font-semibold text-zinc-300 block text-xs uppercase tracking-wider">Duration</span>
              <p className="text-zinc-400 mt-0.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                Temporary or Indefinite containment pending investigation.
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed text-center">
            If you believe this is a mistake, please reach out to your system administrator or submit an appeal through the standard channels.
          </p>
        </CardContent>

        <CardFooter className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6 border-t border-zinc-800 w-full">
          <Button
            type="button"
            variant="outline"
            disabled={loggingOut}
            onClick={handleLogout}
            className="w-full border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 flex items-center justify-center gap-2 h-10"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Signing out..." : "Sign Out"}
          </Button>
          <Button
            type="button"
            onClick={() => { window.location.href = "mailto:support@vos-sync.com?subject=Account%20Suspended%20Appeal"; }}
            className="w-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 h-10 shadow-lg shadow-red-950/50"
          >
            Contact Support <ExternalLink className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
