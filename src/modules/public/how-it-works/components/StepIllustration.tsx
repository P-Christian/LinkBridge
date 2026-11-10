// src/modules/public/how-it-works/components/StepIllustration.tsx
"use client";

import Image from "next/image";
import { ROLE_THEME } from "../theme";
import type { RoleKey } from "../types";

interface Props {
  src: string;
  alt: string;
  roleKey: RoleKey;
}

export function StepIllustration({ src, alt, roleKey }: Props) {
  return (
    <div className={`relative w-full aspect-[4/3] max-h-80 overflow-hidden rounded-3xl border bg-gradient-to-br ${ROLE_THEME[roleKey].panel} p-6 group`}>
      <div className="relative w-full h-full">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-contain transition-transform duration-300 motion-safe:group-hover:scale-105"
        />
      </div>
    </div>
  );
}