"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Download, 
  AlertTriangle, 
  Loader2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  FileText, 
  LockKeyhole,
  ChevronDown,
  FileSpreadsheet,
} from "lucide-react";
import { jsPDF } from "jspdf";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import type {
  FreelancerProfile,
  VsWorkExperience,
  VsEducation,
  VsUserSkillMap,
  VsJobSeekerProfile,
} from "@/modules/freelancer/freelancer-profile/types/freelancer-profile.types";
import type { ApplicationItem } from "@/modules/freelancer/freelancer-applications/types";

interface DataRequestItem {
  request_id: number;
  user_id: number;
  request_type: string;
  status: string;
  policy_version?: string;
  requested_at: string;
  confirmed_at?: string;
  completed_at?: string;
  expires_at?: string;
}

interface ExportArtifactItem {
  artifact_id: number;
  request_id: number;
  user_id: number;
  storage_object_id: string;
  integrity_hash: string;
  status: string;
  generated_at: string;
  expires_at: string;
  downloaded_at?: string;
}

export default function PrivacyDataRequests() {
  const [requests, setRequests] = useState<DataRequestItem[]>([]);
  const [artifacts, setArtifacts] = useState<ExportArtifactItem[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [submittingExport, setSubmittingExport] = useState(false);
  const [submittingDeactivate, setSubmittingDeactivate] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [downloadingState, setDownloadingState] = useState<{ id: number; format: "csv" | "pdf" } | null>(null);

  // Deactivation confirmation input
  const [deactivateInput, setDeactivateInput] = useState("");

  const loadRequests = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/freelancer/settings/data-requests");
      if (!res.ok) throw new Error("Failed to load requests.");
      const json = await res.json();
      setRequests(json.requests || []);
      setArtifacts(json.artifacts || []);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRequests();
  }, [loadRequests]);

  const handleCreateExport = async () => {
    try {
      setSubmittingExport(true);
      const idempotencyKey = `export_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const res = await fetch("/api/freelancer/settings/data-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type: "export",
          policy_version: "1.0",
          idempotency_key: idempotencyKey,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to initiate data export.");
      }

      toast.success("Data export requested. Your file is ready for download.");
      loadRequests();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to trigger export.");
    } finally {
      setSubmittingExport(false);
    }
  };

  const handleDeactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deactivateInput !== "DEACTIVATE") {
      toast.error("Please type DEACTIVATE to confirm.");
      return;
    }

    try {
      setSubmittingDeactivate(true);
      const idempotencyKey = `deactivate_${Date.now()}`;
      const res = await fetch("/api/freelancer/settings/data-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type: "deactivation",
          policy_version: "1.0",
          idempotency_key: idempotencyKey,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to submit deactivation request.");
      }

      toast.success("Account deactivation request submitted successfully. Processing deactivation...");
      setDeactivateInput("");
      
      // Auto logout simulation or redirect
      setTimeout(() => {
        window.location.replace("/");
      }, 3000);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to request deactivation.");
    } finally {
      setSubmittingDeactivate(false);
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    try {
      setCancellingId(requestId);
      const res = await fetch("/api/freelancer/settings/data-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          status: "cancelled",
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to cancel request.");
      }

      toast.success("Request cancelled successfully.");
      loadRequests();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to cancel request.");
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50"><CheckCircle className="h-3 w-3" /> Completed</span>;
      case "initiated":
      case "pending_confirmation":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/50"><Clock className="h-3 w-3" /> Initiated</span>;
      case "processing":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200/50"><Loader2 className="h-3 w-3 animate-spin" /> Processing</span>;
      case "cancelled":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400 border"><XCircle className="h-3 w-3" /> Cancelled</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200/50"><XCircle className="h-3 w-3" /> Failed</span>;
    }
  };

  const fetchUserDataForExport = async (): Promise<{
    profile: FreelancerProfile | null;
    applications: ApplicationItem[];
  }> => {
    let profile: FreelancerProfile | null = null;
    let applications: ApplicationItem[] = [];
    try {
      const [profileRes, appsRes] = await Promise.all([
        fetch("/api/freelancer/profile"),
        fetch("/api/freelancer/applications"),
      ]);
      if (profileRes.ok) {
        const pJson = await profileRes.json();
        profile = (pJson.data || pJson) as FreelancerProfile;
      }
      if (appsRes.ok) {
        const aJson = await appsRes.json();
        applications = (aJson.applications || aJson.data || []) as ApplicationItem[];
      }
    } catch (e) {
      console.error("Error fetching export user data:", e);
    }
    return { profile, applications };
  };

  const handleDownloadCSV = async (artifact: ExportArtifactItem) => {
    setDownloadingState({ id: artifact.artifact_id, format: "csv" });
    const toastId = toast.loading("Preparing CSV export...");
    try {
      const { profile, applications } = await fetchUserDataForExport();
      const seekerProfile = (Array.isArray(profile?.job_seeker_profile)
        ? profile?.job_seeker_profile?.[0]
        : (profile?.job_seeker_profile as VsJobSeekerProfile | undefined)) || undefined;
      const fullName = [profile?.user_fname, profile?.user_lname].filter(Boolean).join(" ") || "Candidate";
      const email = profile?.user_email || "N/A";
      const contact = profile?.user_contact || "N/A";
      const location = [profile?.user_city, profile?.user_province].filter(Boolean).join(", ") || "N/A";
      const summary = seekerProfile?.professional_summary || "N/A";
      const skills = (profile?.skills || []).map((s: VsUserSkillMap & { skill_name?: string }) => s.skill?.skill_name || s.skill_name).filter(Boolean);

      const rows: string[][] = [
        ["SECTION", "FIELD", "VALUE"],
        ["Metadata", "Export ID", String(artifact.artifact_id)],
        ["Metadata", "User ID", String(artifact.user_id)],
        ["Metadata", "Generated At", artifact.generated_at],
        ["Metadata", "Integrity Hash", artifact.integrity_hash],
        ["Personal Details", "Full Name", fullName],
        ["Personal Details", "Email Address", email],
        ["Personal Details", "Contact Number", contact],
        ["Personal Details", "Location", location],
        ["Profile", "Professional Summary", summary],
        ["Profile", "Core Skills", skills.join("; ") || "None recorded"],
      ];

      if (profile?.work_experience && profile.work_experience.length > 0) {
        profile.work_experience.forEach((exp: VsWorkExperience, i: number) => {
          rows.push([
            "Work Experience",
            `Role #${i + 1}`,
            `${exp.job_title} at ${exp.company_name} (${exp.start_date || ""} - ${exp.end_date || (exp.is_current_role ? "Present" : "")})`,
          ]);
        });
      }

      if (profile?.education && profile.education.length > 0) {
        profile.education.forEach((edu: VsEducation, i: number) => {
          rows.push([
            "Education",
            `Institution #${i + 1}`,
            `${edu.course_name || "Course"} at ${edu.school_name} (${edu.start_date || ""} - ${edu.end_date || ""})`,
          ]);
        });
      }

      if (applications && applications.length > 0) {
        applications.forEach((app: ApplicationItem) => {
          const title = app.job_title || "Job Application";
          const company = app.company_name || "N/A";
          const status = app.current_stage?.stage_name || app.application_status || "Applied";
          const date = app.applied_at ? format(new Date(app.applied_at), "yyyy-MM-dd") : "N/A";
          rows.push([
            "Application History",
            `Application #${app.application_id}`,
            `Role: ${title} | Company: ${company} | Status: ${status} | Date: ${date}`,
          ]);
        });
      } else {
        rows.push(["Application History", "Applications", "No applications submitted yet."]);
      }

      const csvContent = rows
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\r\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vos_data_export_${artifact.artifact_id}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("CSV spreadsheet export downloaded.", { id: toastId });
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to generate CSV export.", { id: toastId });
    } finally {
      setDownloadingState(null);
    }
  };

  const handleDownloadPDF = async (artifact: ExportArtifactItem) => {
    setDownloadingState({ id: artifact.artifact_id, format: "pdf" });
    const toastId = toast.loading("Generating printable PDF document...");
    try {
      const { profile, applications } = await fetchUserDataForExport();
      const seekerProfile = (Array.isArray(profile?.job_seeker_profile)
        ? profile?.job_seeker_profile?.[0]
        : (profile?.job_seeker_profile as VsJobSeekerProfile | undefined)) || undefined;
      const fullName = [profile?.user_fname, profile?.user_lname].filter(Boolean).join(" ") || "Candidate Profile";
      const email = profile?.user_email || "N/A";
      const contact = profile?.user_contact || "N/A";
      const location = [profile?.user_city, profile?.user_province].filter(Boolean).join(", ") || "N/A";
      const summary = seekerProfile?.professional_summary || "No professional summary provided.";
      const skills = (profile?.skills || []).map((s: VsUserSkillMap & { skill_name?: string }) => s.skill?.skill_name || s.skill_name).filter(Boolean);

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;

      // Header Top Band
      doc.setFillColor(37, 99, 235);
      doc.rect(margin, 12, contentWidth, 3, "F");

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text("LINKBRIDGE - PERSONAL DATA EXPORT REPORT", margin, 22);

      // Subtitle
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text("OFFICIAL DATA PORTABILITY PRIVACY RECORD", margin, 27);
      const dateText = `Generated: ${artifact.generated_at ? format(new Date(artifact.generated_at), "yyyy-MM-dd HH:mm") : format(new Date(), "yyyy-MM-dd HH:mm")}`;
      doc.text(dateText, pageWidth - margin - doc.getTextWidth(dateText), 27);

      // Divider line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, 30, pageWidth - margin, 30);

      // Section 1: Candidate Personal Info Box
      let y = 35;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentWidth, 24, 2, 2, "F");
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, 24, 2, 2, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text("Candidate Information", margin + 4, y + 6);

      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text("Full Name:", margin + 4, y + 12);
      doc.setFont("helvetica", "normal");
      doc.text(fullName, margin + 28, y + 12);

      doc.setFont("helvetica", "bold");
      doc.text("Email:", margin + 4, y + 18);
      doc.setFont("helvetica", "normal");
      doc.text(email, margin + 28, y + 18);

      doc.setFont("helvetica", "bold");
      doc.text("Contact:", margin + 95, y + 12);
      doc.setFont("helvetica", "normal");
      doc.text(contact, margin + 115, y + 12);

      doc.setFont("helvetica", "bold");
      doc.text("Location:", margin + 95, y + 18);
      doc.setFont("helvetica", "normal");
      doc.text(location, margin + 115, y + 18);

      // Section 2: Professional Profile & Core Skills
      y += 28;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text("Professional Profile & Core Skills", margin, y);
      y += 4;

      // Prepare complete summary text and full skills list
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const splitSummary = doc.splitTextToSize(summary, contentWidth - 8);
      const summaryLineHeight = 3.8;
      const summaryBlockHeight = splitSummary.length * summaryLineHeight;

      const skillsText = skills.length > 0 ? skills.join(", ") : "None recorded";
      const splitSkills = doc.splitTextToSize(skillsText, contentWidth - 8);
      const skillsLineHeight = 3.8;
      const skillsBlockHeight = splitSkills.length * skillsLineHeight;

      // Card bounding box dynamically sized
      const cardInnerPadding = 16;
      const cardTotalHeight = summaryBlockHeight + skillsBlockHeight + cardInnerPadding;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, cardTotalHeight, 1.5, 1.5, "S");

      // Draw SUMMARY
      let innerY = y + 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("SUMMARY", margin + 4, innerY);

      innerY += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(splitSummary, margin + 4, innerY);

      // Draw CORE SKILLS
      innerY += summaryBlockHeight + 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`CORE SKILLS (${skills.length})`, margin + 4, innerY);

      innerY += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(splitSkills, margin + 4, innerY);

      y += cardTotalHeight + 8;

      // Helper for adding footer to current page
      const renderFooter = (pageDoc: typeof doc) => {
        const footerY = pageHeight - 16;
        pageDoc.setDrawColor(226, 232, 240);
        pageDoc.line(margin, footerY, pageWidth - margin, footerY);
        pageDoc.setFont("helvetica", "normal");
        pageDoc.setFontSize(7);
        pageDoc.setTextColor(148, 163, 184);
        pageDoc.text(`Export ID: ${artifact.artifact_id}  |  SHA-256: ${artifact.integrity_hash}`, margin, footerY + 4);
        pageDoc.text("CONFIDENTIAL - FOR PERSONAL USE ONLY", pageWidth - margin - pageDoc.getTextWidth("CONFIDENTIAL - FOR PERSONAL USE ONLY"), footerY + 4);
      };

      // Check if Application History needs a new page
      if (y > pageHeight - 65) {
        renderFooter(doc);
        doc.addPage();
        y = 22;
      }

      // Section 3: Applications History
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Application History (${applications.length})`, margin, y);
      y += 4;

      if (applications.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("No job applications submitted yet.", margin, y + 4);
        y += 10;
      } else {
        applications.forEach((app: ApplicationItem) => {
          if (y > pageHeight - 32) {
            renderFooter(doc);
            doc.addPage();
            y = 22;
          }

          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, "S");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(30, 41, 59);
          doc.text(String(app.job_title || "Application"), margin + 4, y + 5.5);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          const compText = String(app.company_name || "");
          const stageText = String(app.current_stage?.stage_name || app.application_status || "Applied");
          const dateApplied = app.applied_at ? format(new Date(app.applied_at), "yyyy-MM-dd") : "";
          doc.text(`${compText}  •  Status: ${stageText}  •  Applied: ${dateApplied}`, margin + 4, y + 9.5);

          y += 14;
        });
      }

      // Render footer on the final page
      renderFooter(doc);

            doc.save(`vos_data_export_${artifact.artifact_id}.pdf`);
      toast.success("PDF data export downloaded.", { id: toastId });
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to generate PDF document.", { id: toastId });
    } finally {
      setDownloadingState(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <span className="text-sm text-zinc-400">Loading data & privacy records...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Data Portability & Export */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between max-md:flex-col max-md:items-start max-md:gap-2">
          <div className="space-y-1">
            <CardTitle>Data Portability (Export Data)</CardTitle>
            <CardDescription>
              Request a portable archive containing your personal data, profile history, and applications in spreadsheet CSV or printable PDF document format.
            </CardDescription>
          </div>
          <Button 
            onClick={handleCreateExport} 
            disabled={submittingExport}
            className="rounded-xl bg-primary text-primary-foreground font-semibold max-md:min-h-11"
          >
            {submittingExport ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Requesting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" /> Request Export
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <h4 className="text-sm md:text-xs font-bold uppercase tracking-wider text-zinc-400">Request History</h4>
            {requests.length === 0 ? (
              <div className="text-center py-6 text-sm text-zinc-400 border border-dashed rounded-xl">
                No active or previous data requests.
              </div>
            ) : (
              <div className="divide-y rounded-xl border overflow-hidden bg-white dark:bg-zinc-950">
                {requests.map((req) => {
                  const linkedArtifact = artifacts.find(a => a.request_id === req.request_id);
                  return (
                    <div key={req.request_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500 mt-0.5">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold capitalize">{req.request_type} Request</span>
                            {getStatusBadge(req.status)}
                          </div>
                          <p className="text-sm md:text-xs text-zinc-400 mt-1">
                            Requested on: {format(new Date(req.requested_at), "yyyy-MM-dd hh:mm a")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {req.status === "initiated" && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleCancelRequest(req.request_id)}
                            disabled={cancellingId === req.request_id}
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg max-md:min-h-11"
                          >
                            {cancellingId === req.request_id ? "Cancelling..." : "Cancel"}
                          </Button>
                        )}
                        {req.status === "completed" && linkedArtifact && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg gap-1.5 max-md:min-h-11 font-medium"
                                disabled={downloadingState?.id === linkedArtifact.artifact_id}
                              >
                                {downloadingState?.id === linkedArtifact.artifact_id ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Downloading...
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-3.5 w-3.5" /> Download Export
                                    <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
                                  </>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem
                                onClick={() => handleDownloadCSV(linkedArtifact)}
                                className="cursor-pointer gap-2 py-2"
                              >
                                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                <div className="flex flex-col">
                                  <span className="font-semibold text-xs">Spreadsheet (.CSV)</span>
                                  <span className="text-[10px] text-muted-foreground">Tabular structured data</span>
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDownloadPDF(linkedArtifact)}
                                className="cursor-pointer gap-2 py-2"
                              >
                                <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                <div className="flex flex-col">
                                  <span className="font-semibold text-xs">Document (.PDF)</span>
                                  <span className="text-[10px] text-muted-foreground">Printable summary document</span>
                                </div>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Deactivate Account */}
      <Card className="border-rose-100 dark:border-rose-950/30">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="p-2 bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 rounded-xl">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-rose-700 dark:text-rose-400">Deactivate Account</CardTitle>
            <CardDescription>
              Temporarily disable your profile, applications, and referrals. You can reactivate your account later through standard recovery.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 text-rose-800 dark:text-rose-300 text-sm md:text-xs space-y-2">
            <h4 className="font-bold flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" /> Account Deactivation Consequences:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Your public freelancer profile will be hidden and removed from search listings.</li>
              <li>You will not receive any marketing alerts or routine system emails.</li>
              <li>Submitted job applications remain under review but cannot be altered while deactivated.</li>
              <li>Required audit records and compliance items will be preserved safely.</li>
            </ul>
          </div>

          <form onSubmit={handleDeactivate} className="space-y-4 max-w-md pt-2">
            <div className="space-y-2">
              <Label htmlFor="deactivate-confirm-input" className="text-sm md:text-xs font-semibold">
                To confirm, type <span className="font-bold text-rose-600">DEACTIVATE</span> in the input below:
              </Label>
              <Input
                id="deactivate-confirm-input"
                placeholder="Type DEACTIVATE"
                value={deactivateInput}
                onChange={(e) => setDeactivateInput(e.target.value)}
                className="h-11 md:h-10 text-base md:text-sm rounded-lg"
              />
            </div>
            <Button
              type="submit"
              disabled={submittingDeactivate || deactivateInput !== "DEACTIVATE"}
              variant="destructive"
              className="rounded-xl px-5 font-semibold max-md:min-h-11"
            >
              {submittingDeactivate ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Deactivating...
                </>
              ) : (
                "Deactivate My Account"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
