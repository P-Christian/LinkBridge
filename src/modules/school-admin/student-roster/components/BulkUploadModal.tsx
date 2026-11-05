'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { CreateStudentInput, createStudentSchema } from '../types/student-roster.schema';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Download, Upload, X } from 'lucide-react';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: CreateStudentInput[]) => Promise<void>;
}

interface ParsedRow {
  rowNumber: number;
  data: CreateStudentInput;
  isValid: boolean;
  error?: string;
}

const TEMPLATE_HEADERS = [
  'student_number',
  'first_name',
  'middle_name',
  'last_name',
  'email',
  'course_code',
  'course_name',
  'school_year',
  'gpa',
];

const TEMPLATE_OPTIONS = [
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
];

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const downloadTemplate = (format: 'csv' | 'xlsx') => {
    if (format === 'csv') {
      const csvString = TEMPLATE_HEADERS.join(',') + '\n';
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student_roster_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Student Roster');
      XLSX.writeFile(wb, 'student_roster_template.xlsx');
    }
  };

  const processDataRows = (rawJson: Record<string, unknown>[]) => {
    if (rawJson.length === 0) {
      setUploadError('File appears to be empty or has no data rows.');
      return;
    }

    const rows: ParsedRow[] = [];

    rawJson.forEach((row, idx) => {
      const normalizedRow: Record<string, unknown> = {};
      Object.keys(row).forEach((k) => {
        normalizedRow[k.trim().toLowerCase().replace(/\s+/g, '_')] = row[k];
      });

      const firstName = String(
        normalizedRow['first_name'] || normalizedRow['firstname'] || normalizedRow['fname'] || ''
      ).trim();
      const middleName =
        normalizedRow['middle_name'] || normalizedRow['middlename'] || normalizedRow['mname']
          ? String(normalizedRow['middle_name'] || normalizedRow['middlename'] || normalizedRow['mname']).trim()
          : null;
      const lastName = String(
        normalizedRow['last_name'] || normalizedRow['lastname'] || normalizedRow['lname'] || ''
      ).trim();
      const email = String(normalizedRow['email'] || normalizedRow['email_address'] || '').trim();
      const studentNumber =
        normalizedRow['student_number'] ||
        normalizedRow['student_no'] ||
        normalizedRow['student_id'] ||
        normalizedRow['number']
          ? String(
              normalizedRow['student_number'] ||
                normalizedRow['student_no'] ||
                normalizedRow['student_id'] ||
                normalizedRow['number']
            ).trim()
          : null;
      const schoolYear =
        normalizedRow['school_year'] || normalizedRow['schoolyear'] || normalizedRow['sy'] || normalizedRow['year']
          ? String(
              normalizedRow['school_year'] ||
                normalizedRow['schoolyear'] ||
                normalizedRow['sy'] ||
                normalizedRow['year']
            ).trim()
          : '2025-2026';

      let gpa: number | null = null;
      if (
        normalizedRow['gpa'] !== undefined &&
        normalizedRow['gpa'] !== '' &&
        normalizedRow['gpa'] !== null
      ) {
        const parsedGpa = parseFloat(String(normalizedRow['gpa']));
        if (!isNaN(parsedGpa)) gpa = parsedGpa;
      }

      const courseCode = String(
        normalizedRow['course_code'] ||
          normalizedRow['coursecode'] ||
          normalizedRow['code'] ||
          ''
      ).trim();
      const courseName = String(
        normalizedRow['course_name'] ||
          normalizedRow['coursename'] ||
          normalizedRow['course'] ||
          ''
      ).trim();

      const rawRow: CreateStudentInput = {
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        email: email,
        student_number: studentNumber,
        course_code: courseCode || null,
        course_name: courseName || null,
        school_year: schoolYear,
        gpa: gpa,
        school_course_id: null,
      };

      if (!courseCode && !courseName) {
        rows.push({
          rowNumber: idx + 1,
          data: rawRow,
          isValid: false,
          error: 'Course information (course_code or course_name) is required',
        });
        return;
      }

      const val = createStudentSchema.safeParse(rawRow);
      if (val.success) {
        rows.push({ rowNumber: idx + 1, data: val.data, isValid: true });
      } else {
        const firstErr = val.error.issues[0]?.message || 'Invalid row data';
        rows.push({ rowNumber: idx + 1, data: rawRow, isValid: false, error: firstErr });
      }
    });

    setParsedRows(rows);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setUploadError(null);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          setUploadError('Unable to read sheets in uploaded file.');
          return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
        processDataRows(rawJson);
      } catch {
        setUploadError('Failed to parse file. Please ensure it is a valid CSV or Excel (.xlsx/.xls) file.');
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleUploadSubmit = async () => {
    const validRows = parsedRows.filter((r) => r.isValid).map((r) => r.data);
    if (validRows.length === 0) {
      setUploadError('No valid rows available to import.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSuccess(validRows);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      setUploadError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card text-card-foreground w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden border border-border animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Bulk Upload Student Roster</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-lg p-1 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {uploadError && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
              {uploadError}
            </div>
          )}

          {/* Download Template Card */}
          <div className="p-3.5 bg-muted/30 border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                Download Formatted Template
              </div>
              <p className="text-xs text-muted-foreground">
                Headers: student_number, first_name, middle_name, last_name, email, course_code, course_name, school_year, gpa
              </p>
            </div>
            <div className="w-full sm:w-[190px]">
              <SearchableSelect
                options={TEMPLATE_OPTIONS}
                value=""
                onValueChange={(val) => {
                  if (val === 'csv' || val === 'xlsx') {
                    downloadTemplate(val);
                  }
                }}
                placeholder="Download Template..."
                searchPlaceholder="Search format..."
                triggerClassName="h-8 text-xs bg-background border-border"
              />
            </div>
          </div>

          {/* File Picker */}
          <div className="border-2 border-dashed border-border hover:border-primary rounded-xl p-6 text-center transition-colors bg-muted/10 hover:bg-muted/20">
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload-input"
            />
            <label htmlFor="csv-upload-input" className="cursor-pointer space-y-2 block">
              <div className="text-primary font-semibold text-sm">
                {file ? file.name : 'Click to select CSV or Excel file'}
              </div>
              <p className="text-xs text-muted-foreground">
                Supported file types: .csv, .xlsx, .xls
              </p>
            </label>
          </div>

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Import Preview ({parsedRows.length} total rows)</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{validCount} valid rows ready</span>
              </div>

              <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto text-xs bg-background">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-2">Row</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">Course</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r) => (
                      <tr key={r.rowNumber} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="p-2 font-mono text-muted-foreground">#{r.rowNumber}</td>
                        <td className="p-2 font-medium text-foreground">
                          {r.data.first_name} {r.data.last_name}
                        </td>
                        <td className="p-2 text-muted-foreground">{r.data.email}</td>
                        <td className="p-2 text-muted-foreground">
                          {r.data.course_code || r.data.course_name || '—'}
                        </td>
                        <td className="p-2">
                          {r.isValid ? (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full font-medium">
                              Valid
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-full font-medium" title={r.error}>
                              Error: {r.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={validCount === 0 || isSubmitting || isParsing}
            onClick={handleUploadSubmit}
          >
            {isSubmitting ? 'Importing...' : `Import ${validCount} Students`}
          </Button>
        </div>
      </div>
    </div>
  );
};
