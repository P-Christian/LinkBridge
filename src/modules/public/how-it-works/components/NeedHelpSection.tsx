// src/modules/public/how-it-works/components/NeedHelpSection.tsx
import Link from "next/link";
import { HelpCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAGE_COPY, ROUTES } from "../config";

export function NeedHelpSection() {
  return (
    <section className="bg-muted/40 border-t py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">{PAGE_COPY.help.title}</h3>
            <p className="text-sm text-muted-foreground">{PAGE_COPY.help.subtitle}</p>
          </div>
        </div>

        <Button asChild variant="outline" size="sm" className="font-bold gap-1.5 h-11 md:h-9 shrink-0">
          <Link href={ROUTES.contact}>
            <Mail className="h-3.5 w-3.5" />
            {PAGE_COPY.help.action}
          </Link>
        </Button>
      </div>
    </section>
  );
}