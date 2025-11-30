import api from './axios';

export interface StudentsWithoutBatchReport {
  students: Array<{
    id: number;
    name: string;
    email: string;
    phone?: string;
    createdAt: string;
    enrollments: any[];
  }>;
  totalCount: number;
}

export interface BatchAttendanceReport {
  batch: {
    id: number;
    title: string;
    startDate: string;
    endDate: string;
  };
  dateRange?: {
    from: string;
    to: string;
  };
  sessions: Array<{
    session: {
      id: number;
      date: string;
      startTime: string;
      endTime: string;
      topic?: string;
      status: string;
    };
    attendances: Array<{
      id: number;
      studentId: number;
      studentName: string;
      studentEmail: string;
      status: string;
      isManual: boolean;
      markedBy?: {
        id: number;
        name: string;
      };
      markedAt: string;
    }>;
  }>;
  studentStatistics: Array<{
    studentId: number;
    present: number;
    absent: number;
    manualPresent: number;
    total: number;
    attendanceRate: string;
  }>;
  totalSessions: number;
  totalAttendances: number;
}

export interface PendingPaymentsReport {
  payments: Array<{
    id: number;
    student: {
      id: number;
      name: string;
      email: string;
      phone?: string;
    };
    amount: number;
    dueDate: string;
    status: string;
    isOverdue: boolean;
    createdAt: string;
  }>;
  summary: {
    totalPending: number;
    totalPendingAmount: string;
    overdue: {
      count: number;
      amount: string;
    };
    upcoming: {
      count: number;
      amount: string;
    };
  };
}

export interface PortfolioStatusReport {
  portfolios: Array<{
    id: number;
    student: {
      id: number;
      name: string;
      email: string;
    };
    batch: {
      id: number;
      title: string;
      status: string;
    };
    status: string;
    files: Record<string, string>;
    approvedBy?: number;
    approvedAt?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  byStatus: {
    pending: Array<{
      id: number;
      studentName: string;
      batchTitle: string;
      createdAt: string;
    }>;
    approved: Array<{
      id: number;
      studentName: string;
      batchTitle: string;
      approvedAt: string;
    }>;
    rejected: Array<{
      id: number;
      studentName: string;
      batchTitle: string;
      updatedAt: string;
    }>;
  };
}

export interface AllAnalysisReport {
  summary: {
    students: {
      total: number;
      withBatch: number;
      withoutBatch: number;
    };
    batches: {
      total: number;
      active: number;
      ended: number;
    };
    sessions: {
      total: number;
    };
    payments: {
      total: number;
      pending: number;
      totalAmount: number;
      paidAmount: number;
      pendingAmount: number;
    };
    portfolios: {
      total: number;
      pending: number;
    };
  };
  generatedAt: string;
}

export interface StudentsEnrolledBatchNotStarted {
  students: Array<{
    id: number;
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    enrollmentId: number;
    enrollmentDate: string;
    batch: {
      id: number;
      title: string;
      software?: string | null;
      mode: string;
      startDate: string;
      endDate: string;
      status?: string | null;
      schedule?: Record<string, unknown> | null;
    };
  }>;
  totalCount: number;
}

export interface StudentsMultipleCoursesConflict {
  students: Array<{
    id: number;
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    batches: Array<{
      id: number;
      title: string;
      software?: string | null;
      mode: string;
      startDate: string;
      endDate: string;
      status?: string | null;
      schedule?: Record<string, unknown> | null;
      enrollmentId: number;
      enrollmentDate: string;
    }>;
    runningBatches: number;
    futureBatches: number;
    hasTimeConflict: boolean;
    totalEnrollments: number;
  }>;
  totalCount: number;
}

export interface StudentsOnLeavePendingBatches {
  students: Array<{
    id: number;
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    leaves: Array<{
      id: number;
      batchId: number;
      batchTitle: string;
      startDate: string;
      endDate: string;
      reason?: string | null;
      status: string;
    }>;
    pendingBatches: Array<{
      id: number;
      title: string;
      software?: string | null;
      mode: string;
      startDate: string;
      endDate: string;
      status?: string | null;
      schedule?: Record<string, unknown> | null;
      enrollmentId: number;
      enrollmentDate: string;
      isRunning: boolean;
    }>;
    totalLeaves: number;
    totalPendingBatches: number;
  }>;
  totalCount: number;
}

export const reportAPI = {
  getStudentsWithoutBatch: async (): Promise<{ status: string; data: StudentsWithoutBatchReport }> => {
    const response = await api.get('/attendance-reports/students-without-batch');
    return response.data;
  },
  getBatchAttendance: async (batchId: number, params?: { from?: string; to?: string }): Promise<{ status: string; data: BatchAttendanceReport }> => {
    const response = await api.get(`/reports/batch-attendance`, { params: { batchId, ...params } });
    return response.data;
  },
  getPendingPayments: async (): Promise<{ status: string; data: PendingPaymentsReport }> => {
    const response = await api.get('/reports/pending-payments');
    return response.data;
  },
  getPortfolioStatus: async (): Promise<{ status: string; data: PortfolioStatusReport }> => {
    const response = await api.get('/reports/portfolio-status');
    return response.data;
  },
  getAllAnalysisReports: async (): Promise<{ status: string; data: AllAnalysisReport }> => {
    const response = await api.get('/reports/all-analysis');
    return response.data;
  },
  getStudentsEnrolledBatchNotStarted: async (): Promise<{ status: string; data: StudentsEnrolledBatchNotStarted }> => {
    const response = await api.get('/attendance-reports/students-enrolled-batch-not-started');
    return response.data;
  },
  getStudentsMultipleCoursesConflict: async (): Promise<{ status: string; data: StudentsMultipleCoursesConflict }> => {
    const response = await api.get('/attendance-reports/students-multiple-courses-conflict');
    return response.data;
  },
  getStudentsOnLeavePendingBatches: async (): Promise<{ status: string; data: StudentsOnLeavePendingBatches }> => {
    const response = await api.get('/attendance-reports/students-on-leave-pending-batches');
    return response.data;
  },
};

