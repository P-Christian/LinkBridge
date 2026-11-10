"use client";

import React from "react";
import Image from "next/image";
import { PlatformCompany } from "../types/platformCompany.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Building2,
  Star,
  MapPin,
  Mail,
  Phone,
  Globe,
  Edit3,
  Calendar,
  FileText,
  CheckCircle2,
  Archive,
} from "lucide-react";

import { formatAssetUrl } from "@/lib/utils";

interface PlatformCompanyCardProps {
  company: PlatformCompany;
  onEdit: (company: PlatformCompany) => void;
  onSetPrimary: (company: PlatformCompany) => void;
  onToggleActive: (company: PlatformCompany) => void;
  disabled?: boolean;
}

export function PlatformCompanyCard({
  company,
  onEdit,
  onSetPrimary,
  onToggleActive,
  disabled = false,
}: PlatformCompanyCardProps) {
  const [prevLogo, setPrevLogo] = React.useState(company.company_logo);
  const [imgError, setImgError] = React.useState(false);
  const logoUrl = formatAssetUrl(company.company_logo);

  if (company.company_logo !== prevLogo) {
    setPrevLogo(company.company_logo);
    setImgError(false);
  }

  const isPrimary = Number(company.is_primary) === 1 || company.is_primary === true;
  const isActive = Number(company.is_active) === 1 || company.is_active === true;

  // Format location string cleanly
  const locationParts = [
    company.company_brgy,
    company.company_city,
    company.company_province,
    company.company_country,
  ].filter(Boolean);
  const locationString = locationParts.join(", ") || "No address specified";

  return (
    <Card className="rounded-2xl border border-primary/15 bg-card/80 backdrop-blur-xl shadow-lg shadow-primary/5 transition-all duration-300 hover:border-primary/30 hover:shadow-primary/10 overflow-hidden flex flex-col justify-between">
      <div>
        {/* Card Header & Badges */}
        <CardHeader className="p-5 pb-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              {/* Logo / Initials */}
              <div className="relative h-12 w-12 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl && !imgError ? (
                  <Image
                    src={logoUrl}
                    alt={company.company_name}
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span className="text-base font-bold text-primary">
                    {company.company_code?.slice(0, 3) || <Building2 className="h-6 w-6" />}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-base text-foreground leading-tight">
                    {company.company_name}
                  </h3>
                  {isPrimary && (
                    <Badge className="bg-primary/15 text-primary border border-primary/30 font-medium text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Star className="h-3 w-3 fill-primary" /> Primary
                    </Badge>
                  )}
                  {isActive ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </Badge>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground border border-border font-medium text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Archive className="h-3 w-3" /> Archived
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {company.company_legal_name}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[11px] font-mono text-muted-foreground/80 bg-muted/60 px-2 py-1 rounded-md border border-border/40">
                Order: #{company.display_order}
              </span>
            </div>
          </div>

          {/* Tagline / Slug */}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono text-primary/80">/{company.slug}</span>
            {company.company_code && (
              <span className="font-medium text-muted-foreground">Code: {company.company_code}</span>
            )}
          </div>
          {company.company_tagline && (
            <p className="text-xs italic text-foreground/80 mt-1 line-clamp-1">
              &ldquo;{company.company_tagline}&rdquo;
            </p>
          )}
        </CardHeader>

        {/* Card Body Details */}
        <CardContent className="p-5 space-y-3.5 text-xs text-muted-foreground">
          {/* Short Description */}
          {company.company_short_description && (
            <p className="text-foreground/90 line-clamp-2 leading-relaxed">
              {company.company_short_description}
            </p>
          )}

          {/* Location */}
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <span className="line-clamp-1 text-foreground/85">
              {company.company_address ? `${company.company_address}, ` : ""}
              {locationString}
              {company.company_zipCode ? ` ${company.company_zipCode}` : ""}
            </span>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/40">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{company.company_email || "No email"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{company.company_contact || "No contact"}</span>
            </div>
            {company.support_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-info shrink-0" />
                <span className="truncate">Support: {company.support_email}</span>
              </div>
            )}
            {company.company_website && (
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{company.company_website}</span>
              </div>
            )}
          </div>

          {/* Legal Identifiers & Established */}
          <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-border/40 text-[11px]">
            {company.year_established && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                Est. {company.year_established}
              </span>
            )}
            {company.registration_no && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3 text-muted-foreground" />
                Reg: {company.registration_no}
              </span>
            )}
            {company.company_tin && (
              <span className="flex items-center gap-1 font-mono">
                TIN: {company.company_tin}
              </span>
            )}
          </div>
        </CardContent>
      </div>

      {/* Card Actions Footer */}
      <div className="p-4 bg-muted/10 border-t border-border/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isPrimary && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onSetPrimary(company)}
              className="rounded-full text-xs h-8 border-primary/25 hover:bg-primary/10 text-primary"
            >
              <Star className="h-3 w-3 mr-1" /> Set Primary
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onToggleActive(company)}
            className="rounded-full text-xs h-8 text-muted-foreground hover:text-foreground"
          >
            {isActive ? "Archive" : "Activate"}
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => onEdit(company)}
          className="rounded-full text-xs h-8 bg-gradient-to-r from-primary to-info text-primary-foreground shadow-md shadow-primary/20 hover:brightness-110"
        >
          <Edit3 className="h-3 w-3 mr-1" /> Edit Profile
        </Button>
      </div>
    </Card>
  );
}
