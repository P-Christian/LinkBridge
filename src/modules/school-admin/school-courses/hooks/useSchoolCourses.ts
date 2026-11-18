import { useState } from 'react';
import { VsSchoolCourse, CourseStatus, SchoolStatus } from '@/modules/school-admin/types/school-admin.types';
import { CreateCourseDTO, UpdateCourseDTO } from '../types/school-courses.types';
import { 
  executeCreateSchoolCourse, 
  executeUpdateSchoolCourse, 
  executeToggleCourseStatus, 
} from '../services/school-courses.service';
import { toast } from 'sonner';

export function useSchoolCourses(
  initialCourses: VsSchoolCourse[] = [],
  onAddCourseProp?: (data: Partial<VsSchoolCourse>) => Promise<VsSchoolCourse | null>,
  onToggleStatusProp?: (courseId: number, status: string) => Promise<boolean>
) {
  const [courses, setCourses] = useState<VsSchoolCourse[]>(initialCourses);
  const [saving, setSaving] = useState(false);
  const [editingCourse, setEditingCourse] = useState<VsSchoolCourse | null>(null);

  const addCourse = async (data: CreateCourseDTO): Promise<boolean> => {
    setSaving(true);
    try {
      if (onAddCourseProp) {
        const created = await onAddCourseProp(data);
        if (created) {
          setCourses(prev => [created, ...prev]);
          toast.success('Course added successfully.');
          return true;
        }
        return false;
      }

      const created = await executeCreateSchoolCourse(data);
      setCourses(prev => [created, ...prev]);
      toast.success('Course added successfully.');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add course.';
      toast.error(msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateCourse = async (courseId: number, data: UpdateCourseDTO): Promise<boolean> => {
    setSaving(true);
    try {
      const updated = await executeUpdateSchoolCourse(courseId, data);
      setCourses(prev => prev.map(c => c.school_course_id === courseId ? updated : c));
      toast.success('Course updated successfully.');
      setEditingCourse(null);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update course.';
      toast.error(msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (courseId: number, currentStatus: CourseStatus | SchoolStatus | string): Promise<boolean> => {

    try {
      if (onToggleStatusProp) {
        const success = await onToggleStatusProp(courseId, currentStatus);
        if (success) {
          setCourses(prev => prev.map(c => {
            if (c.school_course_id === courseId) {
              return { ...c, course_status: currentStatus === 'Active' ? 'Inactive' : 'Active' };
            }
            return c;
          }));
          toast.success('Course status updated.');
        }
        return success;
      }

      const updated = await executeToggleCourseStatus(courseId, currentStatus);
      setCourses(prev => prev.map(c => c.school_course_id === courseId ? updated : c));
      toast.success('Course status updated.');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status.';
      toast.error(msg);
      return false;
    }
  };

  return {
    courses,
    setCourses,
    saving,
    editingCourse,
    setEditingCourse,
    addCourse,
    updateCourse,
    toggleStatus,
  };
}
