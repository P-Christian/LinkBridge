'use client';

import React from 'react';
import { VsSchoolCourse } from '@/modules/school-admin/types/school-admin.types';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface RosterFiltersProps {
  selectedSchoolYear: string;
  onSchoolYearChange: (year: string) => void;
  selectedCourseId: string;
  onCourseChange: (courseId: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  courses: VsSchoolCourse[];
  availableSchoolYears: string[];
}

export const RosterFilters: React.FC<RosterFiltersProps> = ({
  selectedSchoolYear,
  onSchoolYearChange,
  selectedCourseId,
  onCourseChange,
  selectedStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  courses,
  availableSchoolYears,
}) => {
  const [localSearch, setLocalSearch] = React.useState(searchQuery);
  const [prevSearchQuery, setPrevSearchQuery] = React.useState(searchQuery);

  // Sync state if parent searchQuery changes externally (e.g. reset/cleared)
  if (prevSearchQuery !== searchQuery) {
    setPrevSearchQuery(searchQuery);
    setLocalSearch(searchQuery);
  }

  // Debounce dispatching to parent with 400ms delay & 3-character threshold
  React.useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = localSearch.trim();
      if (trimmed.length === 0) {
        if (searchQuery !== '') {
          onSearchChange('');
        }
      } else if (trimmed.length >= 3) {
        if (trimmed !== searchQuery) {
          onSearchChange(trimmed);
        }
      } else {
        // Under threshold (< 3 chars, e.g. after backspacing from >= 3)
        // Clear active query if one was previously set to prevent stale results
        if (searchQuery !== '') {
          onSearchChange('');
        }
      }
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [localSearch, searchQuery, onSearchChange]);

  return (
    <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
      {/* Search Input */}
      <div className="relative w-full md:w-80">
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search name, student #, email..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
        <svg
          className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Select Filters Group */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        {/* School Year Filter */}
        <select
          value={selectedSchoolYear}
          onChange={(e) => onSchoolYearChange(e.target.value)}
          className="px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All School Years</option>
          {availableSchoolYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
          {!availableSchoolYears.includes('2025-2026') && (
            <option value="2025-2026">2025-2026</option>
          )}
          {!availableSchoolYears.includes('2024-2025') && (
            <option value="2024-2025">2024-2025</option>
          )}
        </select>

        {/* Course Filter */}
        <div className="w-full sm:w-[220px]">
          <SearchableSelect
            options={[
              { value: 'all', label: 'All Courses' },
              ...courses.map((course) => ({
                value: String(course.school_course_id),
                label: `${course.course_name} (${course.course_code || 'N/A'})`,
              })),
            ]}
            value={selectedCourseId}
            onValueChange={onCourseChange}
            placeholder="All Courses"
            searchPlaceholder="Search courses..."
            triggerClassName="h-[38px] text-sm rounded-lg"
          />
        </div>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Statuses</option>
          <option value="Not Sent">Not Sent</option>
          <option value="Invited">Invited</option>
          <option value="Registered">Registered</option>
        </select>
      </div>
    </div>
  );
};
