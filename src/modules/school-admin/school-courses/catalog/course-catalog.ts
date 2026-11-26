import type { CourseDegree } from "@/modules/school-admin/types/school-admin.types";

import {
  COURSE_CATALOG,
  COURSE_CATALOG_VERSION,
  type CatalogCategory,
  type CatalogProgram,
} from "./course-catalog.data";

export {
  COURSE_CATALOG,
  COURSE_CATALOG_VERSION,
  type CatalogCategory,
  type CatalogProgram,
};

export interface ExistingCourse {
  readonly course_name: string;
  readonly degree: string | null;
}

const CODE_STOPWORDS = new Set(["of", "in", "and", "the", "for", "with", "a", "an", "major"]);

export function normalizeProgramTitle(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

export function catalogCategoryNames(): readonly string[] {
  return COURSE_CATALOG.map((category) => category.name);
}

export function isKnownCategory(name: string | null): boolean {
  if (name === null) return false;
  return COURSE_CATALOG.some((category) => category.name === name);
}

export function programsFor(
  degree: CourseDegree | "",
  category: string | null
): readonly CatalogProgram[] {
  if (degree === "" || category === null) return [];
  const match = COURSE_CATALOG.find((entry) => entry.name === category);
  if (match === undefined) return [];
  return match.programs.filter((program) => program.degree === degree);
}

export function isProgramAdded(
  program: CatalogProgram,
  existing: readonly ExistingCourse[]
): boolean {
  const title = normalizeProgramTitle(program.title);
  return existing.some(
    (course) =>
      normalizeProgramTitle(course.course_name) === title &&
      (course.degree ?? "") === program.degree
  );
}

export function searchAvailablePrograms(
  degree: CourseDegree | "",
  category: string | null,
  query: string,
  existing: readonly ExistingCourse[]
): readonly CatalogProgram[] {
  const needle = normalizeProgramTitle(query);
  return programsFor(degree, category).filter((program) => {
    if (isProgramAdded(program, existing)) return false;
    if (needle.length === 0) return true;
    return normalizeProgramTitle(program.title).includes(needle);
  });
}

export function suggestedCodeFromTitle(title: string): string {
  const words = title
    .split(/\s+/u)
    .map((word) => word.replace(/[^A-Za-z]/gu, ""))
    .filter((word) => word.length > 0);
  const significant = words.filter((word) => !CODE_STOPWORDS.has(word.toLowerCase()));
  const source = significant.length > 0 ? significant : words;
  const code = source
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 6);
  return code;
}

export interface CourseSelection {
  readonly degree: CourseDegree | "";
  readonly category: string | null;
  readonly programTitle: string;
  readonly courseCode: string;
  readonly isOther: boolean;
}

export interface CourseInput {
  readonly course_name: string;
  readonly degree: CourseDegree;
  readonly course_code: string | null;
  readonly course_category: string | null;
}

export const UNCATEGORIZED_COURSE_CATEGORY = '__uncategorized__';

export const EMPTY_COURSE_SELECTION: CourseSelection = {
  degree: "",
  category: null,
  programTitle: "",
  courseCode: "",
  isOther: false,
};

export function programByTitle(
  degree: CourseDegree | "",
  category: string | null,
  title: string
): CatalogProgram | undefined {
  if (title.length === 0) return undefined;
  return programsFor(degree, category).find(
    (program) => normalizeProgramTitle(program.title) === normalizeProgramTitle(title)
  );
}

export function programOptions(
  degree: CourseDegree | "",
  category: string | null,
  existing: readonly ExistingCourse[]
): readonly { readonly value: string; readonly label: string }[] {
  return searchAvailablePrograms(degree, category, "", existing).map((program) => ({
    value: program.title,
    label: `${program.title} · ${program.code}`,
  }));
}

export function selectionToCourseInput(selection: CourseSelection): CourseInput | null {
  if (selection.degree === "") return null;
  const courseName = selection.programTitle.trim().replace(/\s+/gu, " ");
  if (courseName.length < 2) return null;
  const courseCode = selection.courseCode.trim();
  const category = selection.category?.trim() ?? "";
  return {
    course_name: courseName,
    degree: selection.degree,
    course_code: courseCode.length > 0 ? courseCode : null,
    course_category: category.length > 0 ? category : null,
  };
}

export function isCourseDegree(value: string | null | undefined): value is CourseDegree {
  return (
    value === "Associate" ||
    value === "Bachelor" ||
    value === "Master" ||
    value === "Doctorate"
  );
}

export function findCatalogProgramByTitle(
  degree: CourseDegree | "",
  title: string
): { readonly category: string; readonly program: CatalogProgram } | undefined {
  const needle = normalizeProgramTitle(title);
  if (needle.length === 0) return undefined;
  for (const category of COURSE_CATALOG) {
    for (const program of category.programs) {
      if (normalizeProgramTitle(program.title) !== needle) continue;
      if (degree !== "" && program.degree !== degree) continue;
      return { category: category.name, program };
    }
  }
  return undefined;
}

export function selectionFromExistingCourse(course: {
  readonly course_name: string;
  readonly degree: string | null;
  readonly course_code?: string | null;
  readonly course_category?: string | null;
}): CourseSelection {
  const storedDegree = isCourseDegree(course.degree) ? course.degree : "";
  const storedCategory = course.course_category?.trim() ?? "";
  const category = storedCategory.length > 0 ? storedCategory : null;
  const match = findCatalogProgramByTitle(storedDegree, course.course_name);
  if (match !== undefined) {
    return {
      degree: storedDegree === "" ? match.program.degree : storedDegree,
      category: category ?? match.category,
      programTitle: match.program.title,
      courseCode: course.course_code ?? match.program.code,
      isOther: false,
    };
  }
  return {
    degree: storedDegree,
    category,
    programTitle: course.course_name,
    courseCode: course.course_code ?? "",
    isOther: true,
  };
}
