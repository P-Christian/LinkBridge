import { z } from 'zod';

import { catalogCategoryNames } from '../catalog/course-catalog';

const COURSE_CATEGORIES = new Set(catalogCategoryNames());

const courseCategorySchema = z
  .string()
  .trim()
  .max(100, 'Field category is too long')
  .nullable()
  .optional()
  .refine(
    (value) =>
      value === null || value === undefined || value === '' || COURSE_CATEGORIES.has(value),
    { message: 'Unknown field category' },
  );

export const createCourseSchema = z.object({
  course_name: z.string().min(2, 'Course name must be at least 2 characters'),
  course_code: z.string().nullable().or(z.literal('')).optional(),
  course_category: courseCategorySchema,
  degree: z.enum(['Associate', 'Bachelor', 'Master', 'Doctorate'], {
    message: 'Degree level is required',
  }),
});


export const updateCourseSchema = z.object({
  course_name: z.string().min(2, 'Course name must be at least 2 characters').optional(),
  course_code: z.string().nullable().or(z.literal('')).optional(),
  course_category: courseCategorySchema,
  degree: z.enum(['Associate', 'Bachelor', 'Master', 'Doctorate']).optional(),
  course_status: z.enum(['Active', 'Inactive']).optional(),
});

export type CreateCourseSchemaType = z.infer<typeof createCourseSchema>;
export type UpdateCourseSchemaType = z.infer<typeof updateCourseSchema>;

