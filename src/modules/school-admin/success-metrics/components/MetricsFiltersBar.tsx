// src/modules/school-admin/success-metrics/components/MetricsFiltersBar.tsx
'use client';

import React from 'react';
import { useSuccessMetricsContext } from '../providers/SuccessMetricsProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { RefreshCw, Filter } from 'lucide-react';

export function MetricsFiltersBar() {
  const { data, filter, updateFilter, refresh, isLoading } = useSuccessMetricsContext();

  const schoolYears = data?.availableSchoolYears || [];
  const courses = data?.courseStats || [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Filters:</span>
        </div>

        {/* Academic Year Filter */}
        <div className="flex min-w-[160px] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Academic Year
          </span>
          <SearchableSelect
            options={[
              { value: 'ALL', label: 'All Academic Years' },
              ...schoolYears.map((year) => ({ value: year, label: `AY ${year}` })),
            ]}
            value={filter.school_year || 'ALL'}
            onValueChange={(val) => updateFilter({ school_year: val === 'ALL' ? undefined : val })}
            placeholder="All Academic Years"
            ariaLabel="Filter by academic year"
            className="h-9 min-w-[160px] text-xs"
          />
        </div>

        {/* Course Filter */}
        <div className="flex min-w-[180px] max-w-[240px] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Degree Program
          </span>
          <SearchableSelect
            options={[
              { value: 'ALL', label: 'All Degree Programs' },
              ...courses.map((course) => ({ value: String(course.courseId), label: course.courseName })),
            ]}
            value={filter.school_course_id ? String(filter.school_course_id) : 'ALL'}
            onValueChange={(val) => updateFilter({ school_course_id: val === 'ALL' ? undefined : Number(val) })}
            placeholder="All Degree Programs"
            ariaLabel="Filter by degree program"
            className="h-9 min-w-[180px] max-w-[240px] text-xs"
          />
        </div>

        {/* Alumni vs Current Student Filter */}
        <div className="flex min-w-[170px] flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Student Type
          </span>
          <Select
            value={filter.is_alumni !== undefined ? String(filter.is_alumni) : 'ALL'}
            onValueChange={(val) => updateFilter({ is_alumni: val === 'ALL' ? undefined : val === 'true' })}
          >
            <SelectTrigger aria-label="Filter by student type" className="h-9 min-w-[170px] text-xs">
              <SelectValue placeholder="All Students" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Students</SelectItem>
              <SelectItem value="false">Current Students</SelectItem>
              <SelectItem value="true">Graduates / Alumni</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isLoading}
          className="h-9 gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>
    </div>
  );
}
