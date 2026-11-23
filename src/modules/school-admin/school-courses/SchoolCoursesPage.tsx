"use client";

import { useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { VsSchoolCourse, CourseDegree, CourseStatus, SchoolStatus } from "@/modules/school-admin/types/school-admin.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Edit, Power, BookOpen } from "lucide-react";
import { useSchoolCourses } from "./hooks/useSchoolCourses";
import { CoursesDataTable } from "./components/CoursesDataTable";
import { AddCourseModal } from "./components/AddCourseModal";
import { EditCourseModal } from "./components/EditCourseModal";
import { 
  formatCourseCode, 
  getCourseStatusBadgeVariant, 
  getDegreeBadgeVariant, 
  filterCourses 
} from "./services/school-courses.helpers";
import { SchoolAdminModuleHeader } from "@/modules/school-admin/components/SchoolAdminModuleHeader";

interface SchoolCoursesPageProps {
  courses: VsSchoolCourse[];
  onAddCourse?: (data: Partial<VsSchoolCourse>) => Promise<VsSchoolCourse | null>;
  onToggleStatus?: (courseId: number, status: string) => Promise<boolean>;
}

export function SchoolCoursesPage({
  courses: initialCourses,
  onAddCourse,
  onToggleStatus,
}: SchoolCoursesPageProps) {
  const {
    courses,
    saving,
    editingCourse,
    setEditingCourse,
    addCourse,
    updateCourse,
    toggleStatus,
  } = useSchoolCourses(initialCourses, onAddCourse, onToggleStatus);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [degreeFilter, setDegreeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredData = useMemo(() => {
    return filterCourses(courses, searchQuery, statusFilter, degreeFilter, categoryFilter);
  }, [courses, searchQuery, statusFilter, degreeFilter, categoryFilter]);

  const existingForAdd = useMemo(
    () =>
      courses.map((course) => ({
        course_name: course.course_name,
        degree: course.degree ?? null,
      })),
    [courses]
  );

  const existingForEdit = useMemo(
    () =>
      courses
        .filter((course) => course.school_course_id !== editingCourse?.school_course_id)
        .map((course) => ({
          course_name: course.course_name,
          degree: course.degree ?? null,
        })),
    [courses, editingCourse]
  );

  const columns = useMemo<ColumnDef<VsSchoolCourse>[]>(
    () => [
      {
        accessorKey: "course_code",
        header: "Course Code",
        cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold">
            {formatCourseCode(row.original.course_code)}
          </span>
        ),
      },
      {
        accessorKey: "course_name",
        header: "Course Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.course_name}</span>
        ),
      },
      {
        accessorKey: "degree",
        header: "Degree Level",
        cell: ({ row }) => {
          const degree: CourseDegree | null | undefined = row.original.degree;
          if (!degree) return <span className="text-muted-foreground text-sm">N/A</span>;
          return (
            <Badge variant={getDegreeBadgeVariant(degree)}>
              {degree}
            </Badge>
          );
        },
      },
      {
        id: "course_category",
        header: "Field Category",
        cell: ({ row }) => {
          const category = row.original.course_category?.trim();
          if (!category) return <Badge variant="outline">Uncategorized</Badge>;
          return (
            <span className="block max-w-[180px] truncate text-sm" title={category}>
              {category}
            </span>
          );
        },
      },
      {
        accessorKey: "course_status",
        header: "Status",
        cell: ({ row }) => {
          const status: CourseStatus | SchoolStatus = row.original.course_status;
          return (
            <Badge variant={getCourseStatusBadgeVariant(status)}>
              {status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Date Created",
        cell: ({ row }) => {
          if (!row.original.created_at) return "N/A";
          return new Date(row.original.created_at).toLocaleDateString();
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const course = row.original;
          const isActive = course.course_status === "Active";

          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setEditingCourse(course)}>
                    <Edit className="mr-2 h-4 w-4 text-muted-foreground" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleStatus(course.school_course_id, course.course_status)}>
                    <Power className={`mr-2 h-4 w-4 ${isActive ? 'text-amber-500' : 'text-emerald-500'}`} />
                    {isActive ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses]
  );

  return (
    <div className="w-[90%] max-w-[2000px] mx-auto space-y-6">
      <SchoolAdminModuleHeader
        title="Course Management"
        description="Manage your institution's course directory, degree levels, status availability, and offerings."
        icon={BookOpen}
      />

      <CoursesDataTable
        columns={columns}
        data={filteredData}
        searchPlaceholder="Search course name or code..."
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        degreeFilter={degreeFilter}
        onDegreeFilterChange={setDegreeFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        toolbarActions={
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Course
          </Button>
        }
      />

      <AddCourseModal
        isOpen={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSubmit={async (data) => await addCourse(data)}
        saving={saving}
        existingCourses={existingForAdd}
      />

      <EditCourseModal
        course={editingCourse}
        isOpen={!!editingCourse}
        onOpenChange={(open) => {
          if (!open) setEditingCourse(null);
        }}
        onSubmit={async (id, data) => await updateCourse(id, data)}
        saving={saving}
        existingCourses={existingForEdit}
      />
    </div>
  );
}

