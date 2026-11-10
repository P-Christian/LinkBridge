// src/modules/public/how-it-works/components/RoleSwitcherCards.tsx
"use client";

import { PAGE_COPY } from "../config";
import { ROLE_KEYS, type RoleKey } from "../types";
import { RoleCard } from "./RoleCard";

interface Props {
  activeRole: RoleKey;
  onSelectRole: (role: RoleKey) => void;
}

/** Shows only the roles you are NOT viewing, reusing the same cards as the overview. */
export function RoleSwitcherCards({ activeRole, onSelectRole }: Props) {
  const others = ROLE_KEYS.filter((role) => role !== activeRole);

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t">
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-2xl font-extrabold text-foreground">{PAGE_COPY.switcher.title}</h2>
        <p className="text-sm text-muted-foreground">{PAGE_COPY.switcher.subtitle}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {others.map((role) => (
          <RoleCard key={role} role={role} active={false} onSelect={onSelectRole} />
        ))}
      </div>
    </section>
  );
}