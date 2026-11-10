"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  FileCheck,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { CompanyVerificationRecord } from "../types";
import { VerificationStatusBadge } from "./VerificationStatusBadge";
import { formatDate, getCompanyStatusBucket } from "../utils/companyVerification.utils";
import { motion, AnimatePresence } from "framer-motion";

interface CompanyVerificationTableProps {
  records: CompanyVerificationRecord[];
  loading: boolean;
  onSelectCompany: (company: CompanyVerificationRecord) => void;
}

export const CompanyVerificationTable: React.FC<CompanyVerificationTableProps> = ({
  records,
  loading,
  onSelectCompany,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-16 text-center text-muted-foreground shadow-xs"
      >
        <div className="inline-block animate-spin rounded-full h-9 w-9 border-3 border-primary/30 border-t-primary mb-4" />
        <p className="text-sm font-semibold text-foreground">Synchronizing verification queue...</p>
        <p className="text-xs text-muted-foreground mt-1">Fetching latest company records & documents</p>
      </motion.div>
    );
  }

  if (records.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="rounded-xl border border-border bg-card p-16 text-center text-muted-foreground shadow-xs"
      >
        <div className="mx-auto h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4 text-muted-foreground/60">
          <Building2 className="h-7 w-7" />
        </div>
        <h4 className="text-base font-bold text-foreground">No verification records found</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
          There are currently no company submissions matching your filter criteria. Try adjusting your search query or status filter.
        </p>
      </motion.div>
    );
  }

  // Pagination calculation
  const totalPages = Math.ceil(records.length / pageSize) || 1;
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, records.length);
  const currentRecords = records.slice(startIndex, endIndex);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="rounded-xl border border-border bg-card shadow-xs transition-all w-full overflow-hidden flex flex-col"
    >
      <div className="max-h-[560px] overflow-auto w-full relative">
        <Table className="min-w-[1100px] w-full border-collapse">
          <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md shadow-xs">
            <TableRow className="bg-muted/80 hover:bg-muted/80 border-b border-border">
              <TableHead className="py-3.5 pl-6 pr-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[240px]">
                Company Details
              </TableHead>
              <TableHead className="py-3.5 px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[180px]">
                Tax & Legal ID
              </TableHead>
              <TableHead className="py-3.5 px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[140px]">
                Submitted Evidence
              </TableHead>
              <TableHead className="py-3.5 px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[150px]">
                Submission Date
              </TableHead>
              <TableHead className="py-3.5 px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[120px]">
                Completion
              </TableHead>
              <TableHead className="py-3.5 px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[180px]">
                Verification Status
              </TableHead>
              <TableHead className="py-3.5 pr-6 pl-4 text-right text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[130px]">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {currentRecords.map((company) => {
                const docCount = company.documents?.length || 0;
                const completionPercent = Number(company.profile_completion_percent || 0);
                const bucket = getCompanyStatusBucket(company);
                const needsReview = bucket === "PENDING_VERIFICATION" || bucket === "NEEDS_REVISION";

                // The legal name is only shown when it differs from the display name
                const legalName = (company.company_legal_name || "").trim();
                const showLegalName =
                  Boolean(legalName) && legalName.toLowerCase() !== company.company_name.trim().toLowerCase();

                // Get company initials for fallback avatar
                const initials = company.company_name
                  ?.split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "CO";

                // Color variant for completion bar
                const completionColor =
                  completionPercent >= 90
                    ? "bg-emerald-500"
                    : completionPercent >= 50
                    ? "bg-amber-500"
                    : "bg-rose-500";

                return (
                  <motion.tr
                    key={company.company_id}
                    layout="position"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="hover:bg-accent/40 transition-colors group border-b border-border/60 last:border-0"
                  >
                    {/* Company Details Column */}
                    <TableCell className="py-4 pl-6 pr-4 font-medium">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs group-hover:scale-105 transition-transform overflow-hidden relative">
                          {company.company_logo ? (
                            <Image
                              src={company.company_logo}
                              alt={company.company_name}
                              width={40}
                              height={40}
                              unoptimized
                              className="h-full w-full object-cover rounded-xl"
                            />
                          ) : (
                            initials
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="font-bold text-foreground text-sm flex items-center gap-2">
                            <span className="truncate max-w-[160px] sm:max-w-[220px]" title={company.company_name}>
                              {company.company_name}
                            </span>
                            {company.is_public === 1 && (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-1.5 py-0">
                                Public
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {showLegalName && (
                              <>
                                <span className="truncate max-w-[160px]" title={legalName}>
                                  {legalName}
                                </span>
                                <span className="text-muted-foreground/40">•</span>
                              </>
                            )}
                            <span className="font-mono text-[11px] text-muted-foreground/80 bg-muted/60 px-1.5 py-0.5 rounded">
                              {company.company_code}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Tax & Legal ID */}
                    <TableCell className="py-4 px-4">
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CreditCard className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                          <span className="font-medium text-foreground">TIN:</span>
                          <span className="font-mono text-muted-foreground">{company.company_tin || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <FileText className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                          <span className="font-medium text-foreground">Reg No:</span>
                          <span className="font-mono text-muted-foreground">{company.registration_no || "N/A"}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Documents */}
                    <TableCell className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs px-2.5 py-1 flex items-center gap-1.5 font-medium ${
                            docCount > 0
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          <FileCheck className="h-3.5 w-3.5" />
                          <span>{docCount} File(s)</span>
                        </Badge>
                      </div>
                    </TableCell>

                    {/* Submission Date */}
                    <TableCell className="py-4 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                        <span>{formatDate(company.submitted_at || company.created_at)}</span>
                      </div>
                    </TableCell>

                    {/* Completion % */}
                    <TableCell className="py-4 px-4">
                      <div className="space-y-1 w-24">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-semibold text-foreground">{completionPercent}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, completionPercent)}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className={`h-full rounded-full ${completionColor}`}
                          />
                        </div>
                      </div>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell className="py-4 px-4">
                      <VerificationStatusBadge
                        status={company.verification_status}
                        workflowStatus={company.latest_verification?.status}
                      />
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-4 pr-6 pl-4 text-right">
                      <Button
                        variant={needsReview ? "default" : "outline"}
                        size="sm"
                        onClick={() => onSelectCompany(company)}
                        title={
                          needsReview
                            ? undefined
                            : bucket === "VERIFIED"
                            ? "This company is already verified."
                            : bucket === "REJECTED"
                            ? "This submission was already rejected or suspended."
                            : "This profile has not been submitted for verification yet."
                        }
                        className="h-8 px-3 gap-1.5 text-xs font-semibold shadow-xs transition-all hover:scale-102 active:scale-98"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {needsReview ? "Review & Verify" : "View Profile"}
                      </Button>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* Table Footer with Counter & Pagination Controls */}
      <div className="px-6 py-3 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span>
            Showing <strong>{startIndex + 1}</strong> - <strong>{endIndex}</strong> of <strong>{records.length}</strong> company records
          </span>
        </div>

        {/* Pagination Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium mr-2">
            Page {validPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={validPage <= 1}
            className="h-7 w-7 p-0 rounded-lg"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={validPage >= totalPages}
            className="h-7 w-7 p-0 rounded-lg"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
