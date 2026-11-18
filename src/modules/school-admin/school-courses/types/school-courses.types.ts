import { CourseDegree, CourseStatus } from '../../types/school-admin.types';

export interface CreateCourseDTO {
  course_name: string;
  course_code?: string | null;
  course_category?: string | null;
  degree: CourseDegree;
}

export interface UpdateCourseDTO {
  course_name?: string;
  course_code?: string | null;
  course_category?: string | null;
  degree?: CourseDegree;
  course_status?: CourseStatus;
}

export interface CourseFilters {
  search?: string;
  status?: string;
  degree?: string;
}

