// src/modules/school-admin/job-referrals/components/StudentCandidatePicker.tsx
"use client";

import React, { useState, useMemo } from 'react';
import { VerifiedStudentCandidate, VsJobPosting } from '../types/job-referrals.types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search,
  CheckCheck,
  XSquare,
  GraduationCap,
  Sparkles,
  Award,
} from 'lucide-react';
import { stripHtmlTags } from '../utils/formatting';

interface StudentCandidatePickerProps {
  job: VsJobPosting;
  students: VerifiedStudentCandidate[];
  selectedStudentIds: number[];
  onToggleSelection: (studentId: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export function StudentCandidatePicker({
  job,
  students,
  selectedStudentIds,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
}: StudentCandidatePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');

  // Extract unique courses
  const courses = useMemo(() => {
    const list = Array.from(new Set(students.map((s) => s.course_name).filter(Boolean))) as string[];
    return list;
  }, [students]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.student_number && s.student_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.skills.some((sk) => sk.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCourse = courseFilter === 'all' || s.course_name === courseFilter;

      return matchesSearch && matchesCourse;
    });
  }, [students, searchQuery, courseFilter]);

  // Highlight matching skills with job requirements
  const checkSkillMatch = (skill: string) => {
    const plainJobText = (job.job_title + ' ' + stripHtmlTags(job.job_description) + ' ' + stripHtmlTags(job.job_qualifications)).toLowerCase();
    return plainJobText.includes(skill.toLowerCase());
  };

  return (
    <div className="space-y-4">
      {/* Top Controls & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, skill, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {courses.length > 0 && (
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="text-xs bg-background border border-input rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              className="text-xs h-8 gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Select All
            </Button>
            {selectedStudentIds.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="text-xs h-8 text-muted-foreground hover:text-foreground gap-1.5"
              >
                <XSquare className="w-3.5 h-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Selected Indicator Banner */}
      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            {selectedStudentIds.length} of {students.length} students selected
          </span>
          {selectedStudentIds.length === 1 && (
            <Badge variant="secondary" className="text-[11px] bg-primary/10 text-primary border-none">
              🎯 Mode: Tailored Recommendation
            </Badge>
          )}
          {selectedStudentIds.length > 1 && (
            <Badge variant="secondary" className="text-[11px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-none">
              👥 Mode: Unified Cohort Endorsement
            </Badge>
          )}
        </div>
        <span className="text-muted-foreground text-xs hidden sm:inline">
          Filtered: {filteredStudents.length} candidates
        </span>
      </div>

      {/* Student List Grid */}
      <div className="max-h-[460px] overflow-y-auto pr-1">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">No verified student candidates found.</p>
            <p className="text-xs text-muted-foreground/70">
              Only students with verified registered freelancer accounts appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredStudents.map((student) => {
              const isAlreadyApplied = Boolean(student.applied_job_ids?.includes(job.job_id));
              const isSelected = selectedStudentIds.includes(student.student_id);
              const initials = `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`.toUpperCase();

              return (
                <div
                  key={student.student_id}
                  onClick={() => {
                    if (!isAlreadyApplied) {
                      onToggleSelection(student.student_id);
                    }
                  }}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                    isAlreadyApplied
                      ? 'opacity-60 cursor-not-allowed bg-muted/20 border-border/40'
                      : isSelected
                      ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40 cursor-pointer'
                      : 'border-border/70 hover:border-border hover:bg-muted/30 bg-card cursor-pointer'
                  }`}
                >
                  <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      disabled={isAlreadyApplied}
                      onCheckedChange={() => {
                        if (!isAlreadyApplied) {
                          onToggleSelection(student.student_id);
                        }
                      }}
                      aria-label={`Select ${student.first_name} ${student.last_name}`}
                    />
                  </div>

                  <Avatar className="w-10 h-10 border shrink-0">
                    {student.profile_image_url ? (
                      <AvatarImage src={student.profile_image_url} alt={student.first_name} />
                    ) : null}
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-foreground line-clamp-1">
                          {student.first_name} {student.last_name}
                        </span>
                        {isAlreadyApplied && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground bg-muted font-normal">
                            Already Applied
                          </Badge>
                        )}
                      </div>
                      {student.gpa !== null && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300/50">
                          <Award className="w-3 h-3" />
                          GPA {student.gpa}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                      <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                      <span className="line-clamp-1">{student.course_name || 'Student'} ({student.school_year})</span>
                    </div>

                    {student.profile_headline && (
                      <p className="text-xs text-foreground/80 font-medium line-clamp-1">
                        {student.profile_headline}
                      </p>
                    )}

                    {/* Skills badges */}
                    {student.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {student.skills.slice(0, 4).map((skill) => {
                          const isMatch = checkSkillMatch(skill);
                          return (
                            <Badge
                              key={skill}
                              variant={isMatch ? 'default' : 'secondary'}
                              className={`text-[10px] px-1.5 py-0 ${
                                isMatch
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {isMatch && <Sparkles className="w-2.5 h-2.5 mr-1 inline" />}
                              {skill}
                            </Badge>
                          );
                        })}
                        {student.skills.length > 4 && (
                          <span className="text-[10px] text-muted-foreground self-center">
                            +{student.skills.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
