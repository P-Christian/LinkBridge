// src/modules/school-admin/components/dashboard/CourseDistributionChart.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { AlertCircle } from 'lucide-react';
import { CoursePlacementStat } from '../../success-metrics/types/success-metrics.types';

interface CourseDistributionChartProps {
  courseStats?: CoursePlacementStat[];
}

const BAR_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

export function CourseDistributionChart({ courseStats = [] }: CourseDistributionChartProps) {
  // Separate actual degree courses from unassigned student bucket
  const actualCourses = courseStats.filter(
    (c) => c.courseId !== 0 && c.courseName !== 'General / Unassigned'
  );
  const unassignedStat = courseStats.find(
    (c) => c.courseId === 0 || c.courseName === 'General / Unassigned'
  );
  const unassignedStudentsCount = unassignedStat?.totalStudents || 0;

  const chartData = actualCourses.map((c, idx) => ({
    name: c.courseCode || c.courseName.slice(0, 16),
    fullName: c.courseName,
    students: c.totalStudents || 0,
    hired: c.hiredCount || 0,
    fill: BAR_COLORS[idx % BAR_COLORS.length],
  }));

  const totalCourseOfferings = actualCourses.length;

  return (
    <Card className="group h-full rounded-2xl border border-border/80 border-t-[3.5px] border-t-indigo-500 shadow-xs flex flex-col justify-between transition-all duration-200 hover:border-indigo-400/60 dark:hover:border-indigo-500/40 hover:shadow-md hover:-translate-y-0.5">
      <CardHeader className="min-h-[72px] pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Academic Program Roster
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Real student distribution across active courses
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {unassignedStudentsCount > 0 && (
              <span
                title={`${unassignedStudentsCount} students waiting for program assignment`}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
              >
                <AlertCircle className="h-3 w-3 shrink-0" />
                {unassignedStudentsCount} Pending
              </span>
            )}
            <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              {totalCourseOfferings} {totalCourseOfferings === 1 ? 'Program' : 'Programs'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between pt-0">
        {chartData.length === 0 ? (
          <div className="flex h-[210px] flex-col items-center justify-center text-center text-xs text-muted-foreground">
            <p>No academic courses registered yet.</p>
          </div>
        ) : (
          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip
                  wrapperStyle={{ zIndex: 50, outline: 'none' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-border bg-popover text-popover-foreground p-3 text-xs shadow-lg">
                          <p className="font-semibold">{data.fullName}</p>
                          <div className="mt-1 space-y-0.5">
                            <p className="text-blue-600 dark:text-blue-400 font-medium">
                              Enrolled Students: <span className="font-bold">{data.students}</span>
                            </p>
                            <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Employed / Hired: <span className="font-bold">{data.hired}</span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="students" radius={[6, 6, 0, 0]} barSize={36}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          <span>Active degree curriculum</span>
          <span className="font-medium text-foreground">{totalCourseOfferings} registered degrees</span>
        </div>
      </CardContent>
    </Card>
  );
}
