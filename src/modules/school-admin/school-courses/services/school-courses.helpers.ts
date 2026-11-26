import { VsSchoolCourse, CourseDegree, CourseStatus, SchoolStatus } from '../../types/school-admin.types';
import { UNCATEGORIZED_COURSE_CATEGORY } from '../catalog/course-catalog';

export function formatCourseCode(code: string | null | undefined): string {
  if (!code) return 'N/A';
  return code.trim().toUpperCase();
}

export function getCourseStatusBadgeVariant(status: CourseStatus | SchoolStatus | string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'Active':
      return 'default';
    case 'Inactive':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function getDegreeBadgeVariant(degree?: CourseDegree | null): 'outline' | 'secondary' | 'default' {
  switch (degree) {
    case 'Doctorate':
    case 'Master':
      return 'default';
    case 'Bachelor':
      return 'secondary';
    case 'Associate':
      return 'outline';
    default:
      return 'outline';
  }
}

export function filterCourses(
  courses: VsSchoolCourse[],
  searchQuery: string,
  statusFilter: string,
  degreeFilter?: string,
  categoryFilter?: string
): VsSchoolCourse[] {
  return courses.filter((course) => {
    const matchesSearch =
      !searchQuery ||
      course.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course.course_code && course.course_code.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      !statusFilter || statusFilter === 'all' || course.course_status === statusFilter;

    const matchesDegree =
      !degreeFilter || degreeFilter === 'all' || course.degree === degreeFilter;

    const category = course.course_category?.trim() ?? '';
    const matchesCategory =
      !categoryFilter ||
      categoryFilter === 'all' ||
      (categoryFilter === UNCATEGORIZED_COURSE_CATEGORY
        ? category === ''
        : category === categoryFilter);

    return matchesSearch && matchesStatus && matchesDegree && matchesCategory;
  });
}

