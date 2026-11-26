import { useState, useCallback } from 'react';
import { SchoolWithStats, VsSchoolCourse, VsSchool } from '../types/school-admin.types';
import { readJsonResponse, responseErrorMessage } from '@/lib/read-json-response';
import { toast } from 'sonner';

export function useSchoolAdmin() {
  const [school, setSchool] = useState<SchoolWithStats | null>(null);
  const [courses, setCourses] = useState<VsSchoolCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMySchool = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/school-admin/me');
      const json = await readJsonResponse(res);
      if (!res.ok) throw new Error(responseErrorMessage(json, `Failed to fetch school details (${res.status}).`));
      const schoolData = json.school as SchoolWithStats | undefined;
      if (!schoolData) throw new Error('School details response was malformed.');
      setSchool(schoolData);
      return schoolData;
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'An error occurred while fetching school.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/school-admin/school/courses');
      const json = await readJsonResponse(res);
      if (!res.ok) throw new Error(responseErrorMessage(json, `Failed to fetch courses (${res.status}).`));
      setCourses((json.courses as VsSchoolCourse[] | undefined) || []);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'An error occurred while fetching courses.');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSchool = async (data: Partial<VsSchool>) => {
    try {
      const res = await fetch('/api/school-admin/school', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await readJsonResponse(res);
      if (!res.ok) throw new Error(responseErrorMessage(json, `Failed to update school (${res.status}).`));
      setSchool(prev => prev ? { ...prev, ...(json.school as Partial<SchoolWithStats>) } : null);
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to update school.');
      toast.error(error.message || 'Failed to update school.');
      return false;
    }
  };

  const addCourse = async (data: Partial<VsSchoolCourse>): Promise<VsSchoolCourse | null> => {
    try {
      const res = await fetch('/api/school-admin/school/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, course_status: 'Active' }),
      });
      const json = await readJsonResponse(res);
      if (!res.ok) throw new Error(responseErrorMessage(json, `Failed to create course (${res.status}).`));
      const created = json.course as VsSchoolCourse | undefined;
      if (!created) throw new Error('Course creation response was malformed.');
      setCourses(prev => [created, ...prev]);
      return created;
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to create course.');
      toast.error(error.message || 'Failed to create course.');
      return null;
    }
  };

  const toggleCourseStatus = async (courseId: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
      const res = await fetch(`/api/school-admin/school/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_status: newStatus }),
      });
      const json = await readJsonResponse(res);
      if (!res.ok) throw new Error(responseErrorMessage(json, `Failed to update course status (${res.status}).`));
      const updated = json.course as Partial<VsSchoolCourse> | undefined;
      if (!updated) throw new Error('Course status response was malformed.');
      setCourses(prev => prev.map(c => c.school_course_id === courseId ? { ...c, ...updated } : c));
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to update course status.');
      toast.error(error.message || 'Failed to update course status.');
      return false;
    }
  };

  return {
    school,
    courses,
    loading,
    error,
    fetchMySchool,
    fetchMyCourses,
    updateSchool,
    addCourse,
    toggleCourseStatus
  };
}
