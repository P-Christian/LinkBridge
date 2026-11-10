'use client';

import { useState, useEffect, useCallback } from 'react';
import { VsSchoolStudent } from '../types/student-roster.types';
import { CreateStudentInput, UpdateRosterAcademicsInput } from '../types/student-roster.schema';
import { VsSchoolCourse } from '@/modules/school-admin/types/school-admin.types';
import { generateSchoolYearOptions } from '../utils/school-year.utils';
import { toast } from 'sonner';

interface UseStudentRosterOptions {
  isAlumni?: boolean;
}

export function useStudentRoster({ isAlumni = false }: UseStudentRosterOptions = {}) {
  const [students, setStudents] = useState<VsSchoolStudent[]>([]);
  const [courses, setCourses] = useState<VsSchoolCourse[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Maintain accumulated list of all available school years
  const [accumulatedYears, setAccumulatedYears] = useState<string[]>([]);

  // Fetch student roster
  const fetchStudents = useCallback(async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (selectedSchoolYear !== 'all') params.append('school_year', selectedSchoolYear);
      if (selectedCourseId !== 'all') params.append('school_course_id', selectedCourseId);
      if (selectedStatus !== 'all') params.append('invitation_status', selectedStatus);
      if (searchQuery.trim()) params.append('search_query', searchQuery.trim());
      params.append('is_alumni', isAlumni ? 'true' : 'false');

      const res = await fetch(`/api/school-admin/students?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch student roster');
      }

      const json = await res.json();
      const fetchedStudents: VsSchoolStudent[] = json.data || [];
      setStudents(fetchedStudents);
      setTotalCount(json.total || 0);

      if (fetchedStudents.length > 0) {
        const fetchedYears = fetchedStudents.flatMap((student) =>
          student.school_year ? [student.school_year] : []
        );
        setAccumulatedYears((prev) => Array.from(new Set([...prev, ...fetchedYears])));
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error loading roster'
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedSchoolYear, selectedCourseId, selectedStatus, searchQuery, isAlumni]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);

      try {
        const params = new URLSearchParams();
        if (selectedSchoolYear !== 'all') params.append('school_year', selectedSchoolYear);
        if (selectedCourseId !== 'all') params.append('school_course_id', selectedCourseId);
        if (selectedStatus !== 'all') params.append('invitation_status', selectedStatus);
        if (searchQuery.trim()) params.append('search_query', searchQuery.trim());
        params.append('is_alumni', isAlumni ? 'true' : 'false');

        const res = await fetch(`/api/school-admin/students?${params.toString()}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to fetch student roster');
        }

        const json = await res.json();
        if (isMounted) {
          const fetchedStudents: VsSchoolStudent[] = json.data || [];
          setStudents(fetchedStudents);
          setTotalCount(json.total || 0);

          if (fetchedStudents.length > 0) {
            const fetchedYears = fetchedStudents.flatMap((student) =>
              student.school_year ? [student.school_year] : []
            );
            setAccumulatedYears((prev) => Array.from(new Set([...prev, ...fetchedYears])));
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          toast.error(
            err instanceof Error ? err.message : 'Error loading roster'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [selectedSchoolYear, selectedCourseId, selectedStatus, searchQuery, isAlumni]);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/school-admin/school/courses');
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses || data || []);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch('/api/school-admin/school/courses');
        if (res.ok && isMounted) {
          const data = await res.json();
          setCourses(data.courses || data || []);
        }
      } catch {
        // Non-blocking
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Actions
  const addStudent = async (input: CreateStudentInput) => {
    const res = await fetch('/api/school-admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add student');
    }

    await fetchStudents();
  };

  const editStudent = async (studentId: number, input: UpdateRosterAcademicsInput) => {
    const res = await fetch(`/api/school-admin/students/${studentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update student');
    }

    await fetchStudents();
  };

  const bulkUploadStudents = async (inputList: CreateStudentInput[]) => {
    const res = await fetch('/api/school-admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputList),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to upload students');
    }

    await fetchStudents();
    await fetchCourses();
  };

  const deleteStudent = async (studentId: number) => {
    const res = await fetch(`/api/school-admin/students/${studentId}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete student');
    }

    await fetchStudents();
  };

  const defaultGeneratedYears = generateSchoolYearOptions();
  const availableSchoolYears = Array.from(
    new Set([...defaultGeneratedYears, ...accumulatedYears])
  ).sort().reverse();

  return {
    students,
    courses,
    totalCount,
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
    refreshRoster: fetchStudents,
    addStudent,
    editStudent,
    bulkUploadStudents,
    deleteStudent,
  };
}
