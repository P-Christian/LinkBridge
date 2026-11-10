// src/modules/vos-admin/school-verification/components/SchoolVerificationTable.tsx
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
  GraduationCap,
  Calendar,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SchoolVerificationRecord } from "../types";
import { SchoolVerificationStatusBadge } from "./SchoolVerificationStatusBadge";
import { formatPHDate } from "../services/schoolVerification.helpers";
import { motion, AnimatePresence } from "framer-motion";

interface SchoolVerificationTableProps {
  records: SchoolVerificationRecord[];
  loading: boolean;
  onSelectSchool: (school: SchoolVerificationRecord) => void;
}

function getActionLabel(status: SchoolVerificationRecord["verification_status"]): string {
  switch (status) {
    case "DRAFT":
      return "View Profile";
    case "PENDING_VERIFICATION":
      return "Review & Verify";
    case "CORRECTION_REQUIRED":
      return "Review Resubmission";
    default:
      return "View Details";
  }
}

export const SchoolVerificationTable: React.FC<SchoolVerificationTableProps> = ({
  records,
  loading,
  onSelectSchool,
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
        <p className="text-sm font-semibold text-foreground">Synchronizing school verification queue...</p>
        <p className="text-xs text-muted-foreground mt-1">Fetching latest school records & accreditation documents</p>
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
          <GraduationCap className="h-7 w-7" />
        </div>
        <h4 className="text-base font-bold text-foreground">No school verification records found</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
          There are currently no school submissions matching your filter criteria. Try adjusting your search query or status filter.
        </p>
      </motion.div>
    );
  }

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
                School Details
              </TableHead>
              <TableHead className="py-3.5 px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[180px]">
                Location
              </TableHead>
              <TableHead className="py-3.5 px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[180px]">
                Administrator
              </TableHead>
              <TableHead className="py-3.5 px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[140px]">
                Documents
              </TableHead>
              <TableHead className="py-3.5 px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[140px]">
                Submitted
              </TableHead>
              <TableHead className="py-3.5 px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[160px]">
                Verification Status
              </TableHead>
              <TableHead className="py-3.5 pr-6 pl-4 text-right text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[130px]">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {currentRecords.map((school) => {
                const docCount = school.documents?.length || 0;
                const primaryAdmin = school.admins?.[0];
                const adminName = primaryAdmin
                  ? `${primaryAdmin.user_fname || ""} ${primaryAdmin.user_lname || ""}`.trim() || primaryAdmin.user_email || `User #${primaryAdmin.user_id}`
                  : "No Admin Assigned";

                const initials = school.school_name
                  ?.split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "SC";

                return (
                  <motion.tr
                    key={school.school_id}
                    layout="position"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="hover:bg-accent/40 transition-colors group border-b border-border/60 last:border-0"
                  >
                    {/* School Details Column */}
                    <TableCell className="py-4 pl-6 pr-4 font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs group-hover:scale-105 transition-transform overflow-hidden relative">
                          {school.school_logo_url ? (
                            <Image
                              src={school.school_logo_url}
                              alt={school.school_name}
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
                            <span className="truncate max-w-[160px] sm:max-w-[220px]" title={school.school_name}>
                              {school.school_name}
                            </span>
                            {Boolean(school.is_public) && (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-1.5 py-0">
                                Public
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate max-w-[160px]" title={school.school_type}>
                              {school.school_type}
                            </span>
                            {school.school_email && (
                              <>
                                <span className="text-muted-foreground/40">•</span>
                                <span className="truncate max-w-[160px] text-muted-foreground" title={school.school_email}>
                                  {school.school_email}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Location */}
                    <TableCell className="py-4 px-4">
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <MapPin className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                          <span>{school.city_municipality || "N/A"}</span>
                        </div>
                        <div className="pl-5 text-muted-foreground">
                          <span>{school.province || school.country || ""}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Administrator */}
                    <TableCell className="py-4 px-4">
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <User className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                          <span className="truncate max-w-[150px]" title={adminName}>
                            {adminName}
                          </span>
                        </div>
                        {primaryAdmin?.user_email && (
                          <div className="pl-5 text-muted-foreground truncate max-w-[150px]" title={primaryAdmin.user_email}>
                            <span>{primaryAdmin.user_email}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Documents */}
                    <TableCell className="py-4 px-4">
                      <Badge
                        variant="outline"
                        className={`text-xs px-2.5 py-1 flex items-center gap-1.5 font-medium w-fit ${
                          docCount > 0
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        <FileCheck className="h-3.5 w-3.5" />
                        <span>{docCount} File(s)</span>
                      </Badge>
                    </TableCell>

                    {/* Submission Date */}
                    <TableCell className="py-4 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                        <span>{formatPHDate(school.submitted_at || school.created_at)}</span>
                      </div>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell className="py-4 px-4">
                      <SchoolVerificationStatusBadge
                        status={school.verification_status}
                        workflowStatus={school.latest_verification?.status}
                      />
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-4 pr-6 pl-4 text-right">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onSelectSchool(school)}
                        className="h-8 px-3 gap-1.5 text-xs font-semibold shadow-xs transition-all hover:scale-102 active:scale-98"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {getActionLabel(school.verification_status)}
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
            Showing <strong>{startIndex + 1}</strong> - <strong>{endIndex}</strong> of <strong>{records.length}</strong> school records
          </span>
        </div>

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
