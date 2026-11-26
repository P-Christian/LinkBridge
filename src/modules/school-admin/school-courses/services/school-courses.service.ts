import { 
  fetchSchoolCoursesRepo, 
  createSchoolCourseRepo, 
  updateSchoolCourseRepo, 
} from './school-courses.repo';
import { createCourseSchema, updateCourseSchema } from '../types/school-courses.schema';
import { CreateCourseDTO, UpdateCourseDTO } from '../types/school-courses.types';
import { VsSchoolCourse, CourseStatus, SchoolStatus } from '@/modules/school-admin/types/school-admin.types';

export async function executeFetchSchoolCourses(): Promise<VsSchoolCourse[]> {
  return await fetchSchoolCoursesRepo();
}

export async function executeCreateSchoolCourse(data: CreateCourseDTO): Promise<VsSchoolCourse> {
  const parsed = createCourseSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || 'Validation error';
    throw new Error(errorMsg);
  }

  return await createSchoolCourseRepo({
    course_name: data.course_name.trim(),
    course_code: data.course_code ? data.course_code.trim() : null,
    course_category: data.course_category ?? null,
    degree: data.degree,
    course_status: 'Active'
  });
}

export async function executeUpdateSchoolCourse(courseId: number, data: UpdateCourseDTO): Promise<VsSchoolCourse> {
  const parsed = updateCourseSchema.partial().safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || 'Validation error';
    throw new Error(errorMsg);
  }

  return await updateSchoolCourseRepo(courseId, {
    ...(data.course_name !== undefined ? { course_name: data.course_name.trim() } : {}),
    ...(data.course_code !== undefined ? { course_code: data.course_code ? data.course_code.trim() : null } : {}),
    ...(data.course_category !== undefined ? { course_category: data.course_category } : {}),
    ...(data.degree !== undefined ? { degree: data.degree } : {}),
    ...(data.course_status !== undefined ? { course_status: data.course_status } : {}),
  });
}

export async function executeToggleCourseStatus(courseId: number, currentStatus: CourseStatus | SchoolStatus | string): Promise<VsSchoolCourse> {
  const newStatus: CourseStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
  return await updateSchoolCourseRepo(courseId, { course_status: newStatus });
}
