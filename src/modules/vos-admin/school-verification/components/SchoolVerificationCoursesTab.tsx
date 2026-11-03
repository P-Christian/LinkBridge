// src/modules/vos-admin/school-verification/components/SchoolVerificationCoursesTab.tsx
"use client";

import React, { useState, useMemo } from "react";
import { SchoolCourse } from "../types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  GraduationCap,
  Search,
  BookOpen,
  Building,
  CheckCircle2,
  FileText,
  Clock,
} from "lucide-react";

interface SchoolVerificationCoursesTabProps {
  courses?: SchoolCourse[];
  schoolName: string;
}

export const SchoolVerificationCoursesTab: React.FC<SchoolVerificationCoursesTabProps> = ({
  courses = [],
  schoolName,
}) => {
  const [search, setSearch] = useState("");

  const filteredCourses = useMemo(() => {
    if (!search.trim()) return courses;
    const q = search.toLowerCase();
    return courses.filter(
      (c) =>
        c.course_name.toLowerCase().includes(q) ||
        (c.course_code && c.course_code.toLowerCase().includes(q)) ||
        (c.department && c.department.toLowerCase().includes(q)) ||
        (c.degree_level && c.degree_level.toLowerCase().includes(q))
    );
  }, [courses, search]);

  const activeCount = useMemo(
    () => courses.filter((c) => c.course_status?.toLowerCase() === "active").length,
    [courses]
  );

  return (
    <div className="space-y-4">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card/60">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Offered Academic Programs & Courses
            </h4>
            <p className="text-xs text-muted-foreground">
              Registered academic offerings submitted by {schoolName}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-2.5 py-1">
            Active: <span className="font-bold ml-1">{activeCount}</span>
          </Badge>
        </div>
      </div>

      {/* Search Bar */}
      {courses.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search courses by code, name, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-background rounded-lg border-border"
          />
        </div>
      )}

      {/* Courses List / Table */}
      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 rounded-xl border border-dashed border-border text-center space-y-3 bg-muted/10">
          <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No Courses Registered</p>
            <p className="text-xs text-muted-foreground max-w-sm mt-0.5">
              This institution has not listed any specific courses or academic programs yet.
            </p>
          </div>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground">
          No courses matching &quot;{search}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredCourses.map((course) => {
            const isActive = course.course_status?.toLowerCase() === "active";
            return (
              <div
                key={course.school_course_id}
                className="p-4 rounded-xl border border-border bg-card hover:border-border/80 transition-colors space-y-2.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {course.course_code ? (
                        <Badge variant="secondary" className="font-mono text-[11px] font-semibold px-2 py-0.5">
                          {course.course_code}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Program
                        </Badge>
                      )}
                      {course.degree_level && (
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {course.degree_level}
                        </span>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-2 py-0.5 flex items-center gap-1 ${
                        isActive
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {isActive ? (
                        <CheckCircle2 className="h-2.5 w-2.5" />
                      ) : (
                        <Clock className="h-2.5 w-2.5" />
                      )}
                      {course.course_status || "Active"}
                    </Badge>
                  </div>

                  <h5 className="text-xs font-bold text-foreground mt-2 leading-snug">
                    {course.course_name}
                  </h5>

                  {course.department && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Building className="h-3 w-3 shrink-0 text-primary/70" />
                      <span>{course.department}</span>
                    </p>
                  )}

                  {course.description && (
                    <p className="text-[11px] text-muted-foreground/90 mt-2 line-clamp-2 leading-relaxed">
                      {course.description}
                    </p>
                  )}
                </div>

                {course.created_at && (
                  <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground flex items-center gap-1">
                    <FileText className="h-2.5 w-2.5" />
                    <span>Added: {new Date(course.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
