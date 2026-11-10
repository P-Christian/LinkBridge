// src/modules/public/how-it-works/HowItWorksModule.tsx
"use client";

import { useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isRoleKey, type RoleKey } from "./types";
import { ROLE_GUIDES, SECTION_IDS } from "./config";
import {
  HeroSection,
  QuickOverview,
  StickyRoleTabs,
  RoadmapSection,
  FinalCTA,
  FAQSection,
  RoleSwitcherCards,
  NeedHelpSection,
  RoleNavigationProvider,
} from "./components";

const ROLE_GUIDE_PATHS = ["/client", "/freelancer", "/school-admin"];
const PUBLIC_PATHS = ["/how-it-works", "/how-it-works/"];

interface Props {
  defaultRole?: RoleKey;
  singleRoleMode?: boolean;
}

export default function HowItWorksModule({ defaultRole = "employee", singleRoleMode = false }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPage = PUBLIC_PATHS.includes(pathname ?? "");
  const showBackButton =
    singleRoleMode || (!isPublicPage && ROLE_GUIDE_PATHS.some((p) => pathname?.includes(p)));

  const rawRole = searchParams.get("role")?.toLowerCase();
  const queryRole: RoleKey = singleRoleMode ? defaultRole : isRoleKey(rawRole) ? rawRole : defaultRole;

  // Optimistic role: update the UI instantly, let the URL catch up.
  const [optimisticRole, setOptimisticRole] = useState<RoleKey | null>(null);
  const [lastQueryRole, setLastQueryRole] = useState(queryRole);
  if (queryRole !== lastQueryRole) {
    setLastQueryRole(queryRole);
    setOptimisticRole(null);
  }

  const activeRole = optimisticRole ?? queryRole;
  const guide = ROLE_GUIDES[activeRole];

  const handleRoleChange = (role: RoleKey) => {
    if (singleRoleMode) return;
    setOptimisticRole(role);
    const params = new URLSearchParams(searchParams.toString());
    params.set("role", role);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSwitchFromBottom = (role: RoleKey) => {
    handleRoleChange(role);
    document.getElementById(SECTION_IDS.overview)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <RoleNavigationProvider>
      <div className="min-h-screen text-foreground relative">
        {showBackButton && (
          <div className="absolute top-4 left-4 sm:top-6 sm:left-8 z-30">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="gap-2 text-xs font-semibold cursor-pointer bg-background/90 backdrop-blur-xs"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </Button>
          </div>
        )}

        <HeroSection />

        {!singleRoleMode && (
          <>
            <QuickOverview activeRole={activeRole} onSelectRole={handleRoleChange} />
            <StickyRoleTabs activeRole={activeRole} onSelectRole={handleRoleChange} />
          </>
        )}

        <RoadmapSection guide={guide} />

        {!singleRoleMode && <FinalCTA guide={guide} />}

        <FAQSection activeRole={activeRole} />

        {!singleRoleMode && <RoleSwitcherCards activeRole={activeRole} onSelectRole={handleSwitchFromBottom} />}

        <NeedHelpSection />
      </div>
    </RoleNavigationProvider>
  );
}