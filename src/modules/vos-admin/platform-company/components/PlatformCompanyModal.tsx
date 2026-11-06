"use client";

import React, { useState } from "react";
import { PlatformCompany, PlatformCompanyFormData } from "../types/platformCompany.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Building2,
  MapPin,
  FileText,
  Share2,
  Settings,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface PlatformCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PlatformCompanyFormData) => Promise<void>;
  company: PlatformCompany | null;
  saving: boolean;
}

const DEFAULT_FORM_DATA: PlatformCompanyFormData = {
  slug: "",
  company_code: "",
  company_name: "",
  company_legal_name: "",
  company_tagline: "",
  year_established: null,
  organization_type_id: null,
  industry_id: null,
  company_size_id: null,
  company_address: "",
  company_brgy: "",
  company_city: "",
  company_province: "",
  company_country: "PH",
  company_zipCode: "",
  map_embed_url: "",
  registration_no: "",
  company_tin: "",
  company_contact: "",
  company_email: "",
  support_email: "",
  company_website: "",
  company_logo: "",
  company_cover: "",
  company_facebook: "",
  company_linkedin: "",
  company_instagram: "",
  company_x: "",
  company_youtube: "",
  company_short_description: "",
  company_description: "",
  company_mission: "",
  company_vision: "",
  company_culture: "",
  company_benefits: "",
  company_tags: "",
  metadata: null,
  is_primary: 0,
  is_active: 1,
  display_order: 0,
};

export function PlatformCompanyModal({
  isOpen,
  onClose,
  onSave,
  company,
  saving,
}: PlatformCompanyModalProps) {
  const [formData, setFormData] = useState<PlatformCompanyFormData>(DEFAULT_FORM_DATA);
  const [metadataJsonText, setMetadataJsonText] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("identity");

  const [prevCompany, setPrevCompany] = useState<PlatformCompany | null>(company);
  const [prevIsOpen, setPrevIsOpen] = useState<boolean>(isOpen);

  if (company !== prevCompany || isOpen !== prevIsOpen) {
    setPrevCompany(company);
    setPrevIsOpen(isOpen);
    if (company) {
      setFormData({
        slug: company.slug || "",
        company_code: company.company_code || "",
        company_name: company.company_name || "",
        company_legal_name: company.company_legal_name || "",
        company_tagline: company.company_tagline || "",
        year_established: company.year_established ?? null,
        organization_type_id: company.organization_type_id ?? null,
        industry_id: company.industry_id ?? null,
        company_size_id: company.company_size_id ?? null,
        company_address: company.company_address || "",
        company_brgy: company.company_brgy || "",
        company_city: company.company_city || "",
        company_province: company.company_province || "",
        company_country: company.company_country || "PH",
        company_zipCode: company.company_zipCode || "",
        map_embed_url: company.map_embed_url || "",
        registration_no: company.registration_no || "",
        company_tin: company.company_tin || "",
        company_contact: company.company_contact || "",
        company_email: company.company_email || "",
        support_email: company.support_email || "",
        company_website: company.company_website || "",
        company_logo: company.company_logo || "",
        company_cover: company.company_cover || "",
        company_facebook: company.company_facebook || "",
        company_linkedin: company.company_linkedin || "",
        company_instagram: company.company_instagram || "",
        company_x: company.company_x || "",
        company_youtube: company.company_youtube || "",
        company_short_description: company.company_short_description || "",
        company_description: company.company_description || "",
        company_mission: company.company_mission || "",
        company_vision: company.company_vision || "",
        company_culture: company.company_culture || "",
        company_benefits: company.company_benefits || "",
        company_tags: company.company_tags || "",
        metadata: company.metadata ?? null,
        is_primary: Number(company.is_primary) === 1 || company.is_primary === true ? 1 : 0,
        is_active: Number(company.is_active) === 1 || company.is_active === true ? 1 : 0,
        display_order: Number(company.display_order) || 0,
      });
      setMetadataJsonText(company.metadata ? JSON.stringify(company.metadata, null, 2) : "");
    } else {
      setFormData(DEFAULT_FORM_DATA);
      setMetadataJsonText("");
    }
    setValidationError(null);
    setActiveTab("identity");
  }

  const handleChange = (
    field: keyof PlatformCompanyFormData,
    value: unknown
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSlugify = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => ({
      ...prev,
      company_name: val,
      slug: prev.slug || handleSlugify(val),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validation
    if (!formData.company_name?.trim()) {
      setValidationError("Company Name is required.");
      setActiveTab("identity");
      return;
    }
    if (!formData.company_legal_name?.trim()) {
      setValidationError("Company Legal Name is required.");
      setActiveTab("identity");
      return;
    }
    if (!formData.company_code?.trim()) {
      setValidationError("Company Code is required.");
      setActiveTab("identity");
      return;
    }
    if (!formData.slug?.trim()) {
      setValidationError("URL Slug is required.");
      setActiveTab("identity");
      return;
    }
    if (!formData.company_email?.trim()) {
      setValidationError("General Contact Email is required.");
      setActiveTab("contact");
      return;
    }
    if (!formData.company_contact?.trim()) {
      setValidationError("Primary Contact Phone Number is required.");
      setActiveTab("contact");
      return;
    }

    // Parse metadata JSON if provided
    let parsedMetadata: Record<string, unknown> | null = null;
    if (metadataJsonText.trim()) {
      try {
        parsedMetadata = JSON.parse(metadataJsonText);
      } catch {
        setValidationError("Invalid JSON in Metadata field.");
        setActiveTab("settings");
        return;
      }
    }

    try {
      await onSave({
        ...formData,
        metadata: parsedMetadata,
      });
    } catch {
      // Error handled by parent hook
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden border border-primary/20 bg-background/95 backdrop-blur-2xl">
        <DialogHeader className="p-6 pb-3 border-b border-border/50 bg-muted/20">
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {company ? `Edit Platform Company: ${company.company_name}` : "New Platform Company Profile"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure internal company identity, contact information, landing page story, and media assets.
          </DialogDescription>
        </DialogHeader>

        {validationError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden px-6 pt-4"
          >
            <TabsList className="grid grid-cols-5 h-9 bg-muted/40 p-0.5 rounded-xl border border-border/40 shrink-0">
              <TabsTrigger value="identity" className="text-xs rounded-lg gap-1.5 py-1">
                <Building2 className="h-3.5 w-3.5" /> Identity
              </TabsTrigger>
              <TabsTrigger value="contact" className="text-xs rounded-lg gap-1.5 py-1">
                <MapPin className="h-3.5 w-3.5" /> Contact
              </TabsTrigger>
              <TabsTrigger value="story" className="text-xs rounded-lg gap-1.5 py-1">
                <FileText className="h-3.5 w-3.5" /> Story
              </TabsTrigger>
              <TabsTrigger value="media" className="text-xs rounded-lg gap-1.5 py-1">
                <Share2 className="h-3.5 w-3.5" /> Media
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs rounded-lg gap-1.5 py-1">
                <Settings className="h-3.5 w-3.5" /> Settings
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto py-4 pr-1 space-y-4">
              {/* TAB 1: IDENTITY */}
              <TabsContent value="identity" className="m-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Company Name *</Label>
                    <Input
                      value={formData.company_name}
                      onChange={handleNameChange}
                      placeholder="e.g. Vertex Technologies Corporation"
                      className="rounded-xl h-10 text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Legal Registered Name *</Label>
                    <Input
                      value={formData.company_legal_name}
                      onChange={(e) => handleChange("company_legal_name", e.target.value)}
                      placeholder="Full SEC / DTI legal name"
                      className="rounded-xl h-10 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Company Code *</Label>
                    <Input
                      value={formData.company_code}
                      onChange={(e) => handleChange("company_code", e.target.value)}
                      placeholder="e.g. VTC or MEN2-Dagupan"
                      className="rounded-xl h-10 text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">URL Slug *</Label>
                    <Input
                      value={formData.slug}
                      onChange={(e) => handleChange("slug", handleSlugify(e.target.value))}
                      placeholder="e.g. vertex-technologies"
                      className="rounded-xl h-10 text-xs font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Year Established</Label>
                    <Input
                      type="number"
                      value={formData.year_established ?? ""}
                      onChange={(e) =>
                        handleChange(
                          "year_established",
                          e.target.value ? parseInt(e.target.value, 10) : null
                        )
                      }
                      placeholder="e.g. 2024"
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Hero Tagline / Slogan</Label>
                  <Input
                    value={formData.company_tagline || ""}
                    onChange={(e) => handleChange("company_tagline", e.target.value)}
                    placeholder="Short catchy hero slogan (e.g. Connecting vision with opportunity)"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Short Introduction</Label>
                  <Textarea
                    value={formData.company_short_description || ""}
                    onChange={(e) => handleChange("company_short_description", e.target.value)}
                    placeholder="Brief 1-2 sentence overview for landing page cards and search previews..."
                    className="rounded-xl text-xs resize-none h-20"
                  />
                </div>
              </TabsContent>

              {/* TAB 2: CONTACT & LOCATION */}
              <TabsContent value="contact" className="m-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">General Email *</Label>
                    <Input
                      type="email"
                      value={formData.company_email}
                      onChange={(e) => handleChange("company_email", e.target.value)}
                      placeholder="e.g. contact@linkbridge.com"
                      className="rounded-xl h-10 text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Support Email</Label>
                    <Input
                      type="email"
                      value={formData.support_email || ""}
                      onChange={(e) => handleChange("support_email", e.target.value)}
                      placeholder="e.g. support@linkbridge.com"
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Primary Contact Phone *</Label>
                    <Input
                      value={formData.company_contact}
                      onChange={(e) => handleChange("company_contact", e.target.value)}
                      placeholder="e.g. 09123456789 or (075) 522-1234"
                      className="rounded-xl h-10 text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Official Website</Label>
                    <Input
                      value={formData.company_website || ""}
                      onChange={(e) => handleChange("company_website", e.target.value)}
                      placeholder="https://..."
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Street Address</Label>
                  <Input
                    value={formData.company_address || ""}
                    onChange={(e) => handleChange("company_address", e.target.value)}
                    placeholder="e.g. Gonzales Street, Building #4"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Barangay</Label>
                    <Input
                      value={formData.company_brgy || ""}
                      onChange={(e) => handleChange("company_brgy", e.target.value)}
                      placeholder="e.g. Bonuan Boquig"
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">City</Label>
                    <Input
                      value={formData.company_city || ""}
                      onChange={(e) => handleChange("company_city", e.target.value)}
                      placeholder="e.g. Dagupan"
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Province</Label>
                    <Input
                      value={formData.company_province || ""}
                      onChange={(e) => handleChange("company_province", e.target.value)}
                      placeholder="e.g. Pangasinan"
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">ZIP Code</Label>
                    <Input
                      value={formData.company_zipCode || ""}
                      onChange={(e) => handleChange("company_zipCode", e.target.value)}
                      placeholder="e.g. 2400"
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">SEC / DTI Registration No.</Label>
                    <Input
                      value={formData.registration_no || ""}
                      onChange={(e) => handleChange("registration_no", e.target.value)}
                      placeholder="Registration number"
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Company TIN</Label>
                    <Input
                      value={formData.company_tin || ""}
                      onChange={(e) => handleChange("company_tin", e.target.value)}
                      placeholder="000-000-000-000"
                      className="rounded-xl h-10 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Google Maps Embed URL</Label>
                  <Input
                    value={formData.map_embed_url || ""}
                    onChange={(e) => handleChange("map_embed_url", e.target.value)}
                    placeholder="https://maps.google.com/..."
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
              </TabsContent>

              {/* TAB 3: STORY & COPY */}
              <TabsContent value="story" className="m-0 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Full Company Description (About Us)</Label>
                  <Textarea
                    value={formData.company_description || ""}
                    onChange={(e) => handleChange("company_description", e.target.value)}
                    placeholder="Comprehensive narrative detailing the company background, journey, and ethos..."
                    className="rounded-xl text-xs min-h-[100px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Mission Statement</Label>
                    <Textarea
                      value={formData.company_mission || ""}
                      onChange={(e) => handleChange("company_mission", e.target.value)}
                      placeholder="Our mission statement..."
                      className="rounded-xl text-xs min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Vision Statement</Label>
                    <Textarea
                      value={formData.company_vision || ""}
                      onChange={(e) => handleChange("company_vision", e.target.value)}
                      placeholder="Our vision for the future..."
                      className="rounded-xl text-xs min-h-[80px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Company Culture</Label>
                    <Textarea
                      value={formData.company_culture || ""}
                      onChange={(e) => handleChange("company_culture", e.target.value)}
                      placeholder="Workplace culture, principles, and team atmosphere..."
                      className="rounded-xl text-xs min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Platform Benefits & Perks</Label>
                    <Textarea
                      value={formData.company_benefits || ""}
                      onChange={(e) => handleChange("company_benefits", e.target.value)}
                      placeholder="Key advantages and features..."
                      className="rounded-xl text-xs min-h-[80px]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tags & Keywords</Label>
                  <Input
                    value={formData.company_tags || ""}
                    onChange={(e) => handleChange("company_tags", e.target.value)}
                    placeholder="Comma-separated keywords (e.g. Technology, Innovation, Dagupan, Philippines)"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
              </TabsContent>

              {/* TAB 4: MEDIA & SOCIALS */}
              <TabsContent value="media" className="m-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Logo Asset / Directus File ID</Label>
                    <Input
                      value={formData.company_logo || ""}
                      onChange={(e) => handleChange("company_logo", e.target.value)}
                      placeholder="Directus file UUID or URL"
                      className="rounded-xl h-10 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Cover Banner Asset / URL</Label>
                    <Input
                      value={formData.company_cover || ""}
                      onChange={(e) => handleChange("company_cover", e.target.value)}
                      placeholder="Hero banner image URL or asset ID"
                      className="rounded-xl h-10 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-border/50">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Official Social Profiles
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Facebook Page URL</Label>
                      <Input
                        value={formData.company_facebook || ""}
                        onChange={(e) => handleChange("company_facebook", e.target.value)}
                        placeholder="https://facebook.com/..."
                        className="rounded-xl h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">LinkedIn Page URL</Label>
                      <Input
                        value={formData.company_linkedin || ""}
                        onChange={(e) => handleChange("company_linkedin", e.target.value)}
                        placeholder="https://linkedin.com/company/..."
                        className="rounded-xl h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Instagram URL</Label>
                      <Input
                        value={formData.company_instagram || ""}
                        onChange={(e) => handleChange("company_instagram", e.target.value)}
                        placeholder="https://instagram.com/..."
                        className="rounded-xl h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">X (Twitter) URL</Label>
                      <Input
                        value={formData.company_x || ""}
                        onChange={(e) => handleChange("company_x", e.target.value)}
                        placeholder="https://x.com/..."
                        className="rounded-xl h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-[11px] text-muted-foreground">YouTube Channel URL</Label>
                      <Input
                        value={formData.company_youtube || ""}
                        onChange={(e) => handleChange("company_youtube", e.target.value)}
                        placeholder="https://youtube.com/@..."
                        className="rounded-xl h-9 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 5: SETTINGS & METADATA */}
              <TabsContent value="settings" className="m-0 space-y-4">
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-foreground">
                        Primary Platform Entity
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Sets this profile as the default company displayed on primary landing pages (About Us, Footer).
                      </p>
                    </div>
                    <Switch
                      checked={Number(formData.is_primary) === 1}
                      onCheckedChange={(checked) => handleChange("is_primary", checked ? 1 : 0)}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-primary/10">
                    <div>
                      <Label className="text-xs font-semibold text-foreground">
                        Active & Publicly Visible
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Enable to make this company profile accessible to public landing page queries.
                      </p>
                    </div>
                    <Switch
                      checked={Number(formData.is_active) === 1}
                      onCheckedChange={(checked) => handleChange("is_active", checked ? 1 : 0)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Display Sort Order</Label>
                  <Input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) =>
                      handleChange("display_order", parseInt(e.target.value, 10) || 0)
                    }
                    placeholder="0"
                    className="rounded-xl h-10 text-xs w-32"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Lower numbers appear first when multiple platform companies are listed.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Extensible JSON Metadata</Label>
                  <Textarea
                    value={metadataJsonText}
                    onChange={(e) => setMetadataJsonText(e.target.value)}
                    placeholder='{\n  "achievements": ["ISO Certified", "Best Tech Platform 2025"],\n  "stats": { "employees": 50, "projects": 120 }\n}'
                    className="rounded-xl text-xs font-mono min-h-[120px]"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Optional structured JSON for dynamic statistics, awards, or custom landing page blocks.
                  </p>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="p-4 border-t border-border/50 bg-muted/20 flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={saving}
              className="rounded-full text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-full text-xs h-9 px-5 bg-gradient-to-r from-primary to-info text-primary-foreground shadow-md shadow-primary/20 hover:brightness-110"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving Changes...
                </>
              ) : company ? (
                "Save Changes"
              ) : (
                "Create Company"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
