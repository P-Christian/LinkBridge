// src/modules/school-admin/job-referrals/components/ReferralWizardModal.tsx
"use client";

import React, { useState } from 'react';
import { useJobReferralsContext } from '../providers/JobReferralsProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StudentCandidatePicker } from './StudentCandidatePicker';
import { AIReferralStudio } from './AIReferralStudio';
import {
  ArrowRight,
  ArrowLeft,
  Send,
  Building2,
  Users,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export function ReferralWizardModal() {
  const {
    activeJob,
    isWizardOpen,
    closeReferralWizard,
    students,
    selectedStudentIds,
    toggleStudentSelection,
    selectAllStudents,
    clearStudentSelection,
    isGeneratingLetter,
    generatedLetter,
    letterTone,
    setLetterTone,
    setGeneratedLetter,
    generateAILetter,
    isSubmittingReferrals,
    submitReferrals,
    referredStudentIds,
    blockedStudents,
    clearBlockedStudents,
  } = useJobReferralsContext();

  const [step, setStep] = useState<1 | 2>(1);

  const handleClose = () => {
    setStep(1);
    clearBlockedStudents();
    closeReferralWizard();
  };

  if (!activeJob) return null;

  const selectedStudents = students.filter((s) => selectedStudentIds.includes(s.student_id));

  const handleNextToStudio = () => {
    if (selectedStudentIds.length === 0) {
      toast.error('Please select at least one verified student.');
      return;
    }
    setStep(2);
  };

  return (
    <Dialog open={isWizardOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent showCloseButton={false} className="w-[95vw] sm:max-w-4xl md:max-w-5xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
        {/* Header with Job Summary */}
        <DialogHeader className="p-6 border-b bg-muted/20 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {activeJob.company_name || 'VOS Partner Company'}
              </span>
              <Badge variant="outline" className="text-xs">
                {activeJob.work_arrangement}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {activeJob.job_type.replace('_', ' ')}
              </Badge>
            </div>

            {/* Stepper indicator */}
            <div className="flex items-center gap-2 text-xs font-medium">
              <span
                className={`px-2.5 py-1 rounded-full ${
                  step === 1 ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'
                }`}
              >
                1. Select Candidates ({selectedStudentIds.length})
              </span>
              <span className="text-muted-foreground">→</span>
              <span
                className={`px-2.5 py-1 rounded-full ${
                  step === 2 ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'
                }`}
              >
                2. AI Letter & Dispatch
              </span>
            </div>
          </div>

          <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
            Refer Students: {activeJob.job_title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Endorse your institution&apos;s verified student talent with custom AI recommendation letters.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 ? (
            <>
              {blockedStudents.length > 0 && (
                <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Some students could not be referred
                  </div>
                  <ul className="mt-1.5 list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                    {blockedStudents.map((student) => (
                      <li key={student.student_id}>
                        <span className="font-medium text-foreground">{student.name}</span>{' '}
                        {student.reason === 'ALREADY_REFERRED'
                          ? 'already referred to this job'
                          : 'already has an active application for this job'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <StudentCandidatePicker
                job={activeJob}
                students={students}
                selectedStudentIds={selectedStudentIds}
                referredStudentIds={referredStudentIds}
                onToggleSelection={toggleStudentSelection}
                onSelectAll={selectAllStudents}
                onClearSelection={clearStudentSelection}
              />
            </>
          ) : (
            <div className="space-y-4">
              {/* Selected Candidates Pill Summary */}
              <div className="p-3 rounded-lg border bg-muted/30 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    Endorsing {selectedStudents.length} candidate(s):
                  </span>
                  {selectedStudents.map((s) => (
                    <span
                      key={s.student_id}
                      className="px-2 py-0.5 rounded-md bg-background border text-[11px] font-medium"
                    >
                      {s.first_name} {s.last_name}
                    </span>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="text-xs h-auto p-0 text-primary"
                >
                  Edit Selection
                </Button>
              </div>

              {/* AI Recommendation Letter Studio */}
              <AIReferralStudio
                letter={generatedLetter}
                onChangeLetter={setGeneratedLetter}
                tone={letterTone}
                onChangeTone={setLetterTone}
                onGenerate={generateAILetter}
                isGenerating={isGeneratingLetter}
                studentCount={selectedStudentIds.length}
              />
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-between gap-3">
          {step === 1 ? (
            <>
              <Button type="button" variant="ghost" onClick={closeReferralWizard} className="text-xs">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleNextToStudio}
                disabled={selectedStudentIds.length === 0}
                className="text-xs gap-1.5 font-semibold"
              >
                Continue to AI Endorsement
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="text-xs gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Students
              </Button>
              <Button
                type="button"
                onClick={submitReferrals}
                disabled={isSubmittingReferrals || selectedStudentIds.length === 0}
                className="text-xs gap-2 font-semibold bg-gradient-to-r from-primary to-primary/90 shadow-md"
              >
                {isSubmittingReferrals ? (
                  <>Sending Referrals...</>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Submit & Generate Referral Links
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
