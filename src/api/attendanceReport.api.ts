import api from './axios';

export interface FacultyAttendanceFilters {
  facultyId?: number;
  batchId?: number;
  from?: string;
  to?: string;
}

export interface FacultyAttendanceRow {
  sessionId: number;
  date: string;
  batchTitle: string;
  facultyName: string;
  present: number;
  absent: number;
  total: number;
  attendanceRate: string;
}

export interface FacultyAttendanceSummary {
  sessions: number;
  totalPresent: number;
  totalAbsent: number;
  averageRate: string;
}

export interface StudentAttendanceFilters {
  batchId: number;
  studentId?: number;
  from?: string;
  to?: string;
}

export interface StudentAttendanceRow {
  studentId: number;
  studentName: string;
  studentEmail: string;
  present: number;
  absent: number;
  manualPresent: number;
  total: number;
  attendanceRate: string;
}

export interface PunchSummaryFilters {
  userId?: number;
  role?: string;
  from?: string;
  to?: string;
}

export interface PunchSummaryRow {
  date: string;
  userName: string;
  role: string;
  punchInAt?: string;
  punchOutAt?: string;
  hours: string;
}

const downloadCsv = async (url: string, params: Record<string, unknown> | undefined, filename: string) => {
  const response = await api.get(url, {
    params: { ...(params || {}), format: 'csv' },
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'text/csv' });
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};

export const attendanceReportAPI = {
  getFacultyAttendance: async (filters: FacultyAttendanceFilters) => {
    const response = await api.get<{
      status: string;
      data: {
        rows: FacultyAttendanceRow[];
        summary: FacultyAttendanceSummary;
      };
    }>('/attendance-reports/faculty', { params: filters });
    return response.data.data;
  },
  downloadFacultyAttendanceCsv: (filters: FacultyAttendanceFilters) =>
    downloadCsv('/attendance-reports/faculty', (filters as unknown) as Record<string, unknown>, 'faculty-attendance.csv'),
  getStudentAttendance: async (filters: StudentAttendanceFilters) => {
    const response = await api.get<{
      status: string;
      data: {
        batchId: number;
        rows: StudentAttendanceRow[];
        summary: {
          students: number;
          averageRate: string;
        };
      };
    }>('/attendance-reports/students', { params: filters });
    return response.data.data;
  },
  downloadStudentAttendanceCsv: (filters: StudentAttendanceFilters) =>
    downloadCsv('/attendance-reports/students', (filters as unknown) as Record<string, unknown>, 'student-attendance.csv'),
  getPunchSummary: async (filters: PunchSummaryFilters) => {
    const response = await api.get<{
      status: string;
      data: {
        rows: PunchSummaryRow[];
        summary: {
          punches: number;
          totalHours: string;
        };
      };
    }>('/attendance-reports/punches', { params: filters });
    return response.data.data;
  },
  downloadPunchSummaryCsv: (filters: PunchSummaryFilters) =>
    downloadCsv('/attendance-reports/punches', (filters as unknown) as Record<string, unknown>, 'punch-summary.csv'),
};



