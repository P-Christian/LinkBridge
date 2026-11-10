'use client';

import React, { useState } from 'react';
import { GraduationCap, Plus, Upload, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useStudentRoster } from './hooks/useStudentRoster';
import { RosterFilters } from './components/RosterFilters';
import { StudentRosterTable } from './components/StudentRosterTable';
import { StudentRosterLeaderboard } from './components/StudentRosterLeaderboard';
import { AddStudentModal } from './components/AddStudentModal';
import { EditStudentModal } from './components/EditStudentModal';
import { BulkUploadModal } from './components/BulkUploadModal';
import { InviteStudentModal } from './components/InviteStudentModal';
import { VsSchoolStudent } from './types/student-roster.types';
import { SchoolAdminModuleHeader } from '@/modules/school-admin/components/SchoolAdminModuleHeader';
import { toast } from 'sonner';

import { StudentRosterSkeleton } from '@/modules/school-admin/components/SchoolAdminSkeleton';

export const StudentRosterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('leaderboard');
  const isAlumni = activeTab === 'alumni';

  const {
    students,
    courses,
    isLoading,
    selectedSchoolYear,
    setSelectedSchoolYear,
    selectedCourseId,
    setSelectedCourseId,
    selectedStatus,
    setSelectedStatus,
    searchQuery,
    setSearchQuery,
    availableSchoolYears,
    addStudent,
    editStudent,
    bulkUploadStudents,
    deleteStudent,
    refreshRoster,
  } = useStudentRoster({ isAlumni });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<VsSchoolStudent | null>(null);
  const [invitedStudentData, setInvitedStudentData] = useState<{ student: VsSchoolStudent; url: string } | null>(null);

  const handleInviteStudent = async (student: VsSchoolStudent) => {
    try {
      const res = await fetch(`/api/school-admin/students/${student.student_id}/invite`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to issue invitation');
      }
      const data = await res.json();
      setInvitedStudentData({
        student: { ...student, invitation_status: 'Invited' },
        url: data.invitation_url,
      });
      toast.success('Invitation link generated successfully!');
      if (refreshRoster) refreshRoster();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error generating invitation';
      toast.error(msg);
    }
  };

  if (isLoading && students.length === 0) {
    return <StudentRosterSkeleton />;
  }

  return (
    <div className="w-[90%] max-w-[2000px] mx-auto space-y-6">
      {/* Header Section */}
      <SchoolAdminModuleHeader
        title="Student Roster Directory"
        description="Manage your school's student directory, filter by academic course or school year, and track registration status."
        icon={GraduationCap}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsBulkModalOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 hover:text-white shadow-sm"
            >
              <Upload className="mr-2 h-4 w-4" />
              Bulk Upload
            </Button>
            <Button
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </div>
        }
      />

      {/* Error Alert */}
      {/* Filters Bar */}
      <RosterFilters
        selectedSchoolYear={selectedSchoolYear}
        onSchoolYearChange={setSelectedSchoolYear}
        selectedCourseId={selectedCourseId}
        onCourseChange={setSelectedCourseId}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        courses={courses}
        availableSchoolYears={availableSchoolYears}
      />

      {/* View Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-xl h-11 border border-border">
          <TabsTrigger
            value="leaderboard"
            className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs flex items-center gap-2"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            Academic Leaderboard
          </TabsTrigger>
          <TabsTrigger
            value="directory"
            className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs flex items-center gap-2"
          >
            <Users className="w-3.5 h-3.5" />
            Student Masterlist
          </TabsTrigger>
          <TabsTrigger
            value="alumni"
            className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs flex items-center gap-2"
          >
            <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
            Alumni
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="mt-0 space-y-6 focus-visible:outline-none">
          <StudentRosterLeaderboard
            students={students}
            courses={courses}
            selectedCourseId={selectedCourseId}
            selectedSchoolYear={selectedSchoolYear}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="directory" className="mt-0 space-y-6 focus-visible:outline-none">
          <StudentRosterTable
            students={students}
            isLoading={isLoading}
            onEdit={(student) => setEditingStudent(student)}
            onDelete={deleteStudent}
            onInvite={handleInviteStudent}
          />
        </TabsContent>

        <TabsContent value="alumni" className="mt-0 space-y-6 focus-visible:outline-none">
          <StudentRosterTable
            students={students}
            isLoading={isLoading}
            onEdit={(student) => setEditingStudent(student)}
            onDelete={deleteStudent}
            onInvite={handleInviteStudent}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={addStudent}
        courses={courses}
      />

      <EditStudentModal
        isOpen={!!editingStudent}
        student={editingStudent}
        onClose={() => setEditingStudent(null)}
        onSuccess={editStudent}
        courses={courses}
      />

      <BulkUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={bulkUploadStudents}
      />

      <InviteStudentModal
        isOpen={!!invitedStudentData}
        onClose={() => setInvitedStudentData(null)}
        student={invitedStudentData?.student || null}
        invitationUrl={invitedStudentData?.url || ''}
      />
    </div>
  );
};
