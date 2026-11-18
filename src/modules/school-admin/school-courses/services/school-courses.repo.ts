import { VsSchoolCourse } from '@/modules/school-admin/types/school-admin.types';
import { readJsonResponse, responseErrorMessage } from '@/lib/read-json-response';

export async function fetchSchoolCoursesRepo(): Promise<VsSchoolCourse[]> {
  const res = await fetch('/api/school-admin/school/courses', { cache: 'no-store' });
  const json = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(responseErrorMessage(json, `Failed to fetch courses (${res.status})`));
  }
  return (json.courses || json.data || []) as VsSchoolCourse[];
}

export async function createSchoolCourseRepo(payload: Partial<VsSchoolCourse>): Promise<VsSchoolCourse> {
  const res = await fetch('/api/school-admin/school/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(responseErrorMessage(json, `Failed to add course (${res.status})`));
  }
  return (json.course || json.data) as VsSchoolCourse;
}

export async function updateSchoolCourseRepo(courseId: number, payload: Partial<VsSchoolCourse>): Promise<VsSchoolCourse> {
  const res = await fetch(`/api/school-admin/school/courses/${courseId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(responseErrorMessage(json, `Failed to update course (${res.status})`));
  }
  return (json.course || json.data) as VsSchoolCourse;
}
