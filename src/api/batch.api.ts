import api from './axios';

export interface Batch {
  id: number;
  title: string;
  software?: string;
  mode: string;
  startDate: string;
  endDate: string;
  maxCapacity?: number;
  status?: string;
  courseId?: number | null;
  course?: {
    id: number;
    name: string;
    software: string[];
  } | null;
  schedule?: {
    [day: string]: {
      startTime: string;
      endTime: string;
    };
  };
  createdAt?: string;
  updatedAt?: string;
  admin?: {
    id: number;
    name: string;
    email: string;
  };
  enrollments?: Array<{
    id?: number;
    enrollmentDate?: string;
    enrollmentStatus?: string;
    student?: {
      id: number;
      name: string;
      email: string;
      phone?: string;
    };
    name?: string;
    email?: string;
    phone?: string;
  }>;
  sessions?: Array<{
    id: number;
    facultyId: number;
    date: string;
    status: string;
    faculty?: {
      id: number;
      name: string;
      email: string;
    };
  }>;
  assignedFaculty?: Array<{
    id: number;
    name: string;
    email: string;
    phone?: string;
  }>;
}

export interface BatchesResponse {
  status: string;
  data: Batch[];
}

export interface BatchResponse {
  status: string;
  message?: string;
  data: {
    batch: Batch;
  };
}

export interface CreateBatchRequest {
  title: string;
  software?: string;
  mode: string;
  startDate: string;
  endDate: string;
  maxCapacity?: number;
  schedule?: {
    [day: string]: {
      startTime: string;
      endTime: string;
    };
  };
  status?: string;
  facultyIds?: number[];
  studentIds?: number[];
  exceptionStudentIds?: number[];
  courseId?: number | null;
}

export interface UpdateBatchRequest {
  title?: string;
  software?: string;
  mode?: string;
  startDate?: string;
  endDate?: string;
  maxCapacity?: number;
  schedule?: {
    [day: string]: {
      startTime: string;
      endTime: string;
    };
  };
  status?: string;
  courseId?: number | null;
  facultyIds?: number[];
  studentIds?: number[];
  exceptionStudentIds?: number[];
}

export interface SuggestedCandidate {
  studentId: number;
  name: string;
  email: string;
  phone?: string;
  status: 'available' | 'busy' | 'fees_overdue' | 'pending_fees' | 'no_orientation';
  statusMessage: string;
  hasOverdueFees: boolean;
  hasPendingFees?: boolean;
  totalOverdueAmount?: number;
  totalPendingAmount?: number;
  conflictingBatches?: string[];
  conflictingSessions?: string[];
}

export interface SuggestCandidatesResponse {
  status: string;
  data: {
    batch: Batch;
    candidates: SuggestedCandidate[];
    totalCount: number;
    summary: {
      available: number;
      busy: number;
      pendingFees: number;
      feesOverdue: number;
    };
  };
}

export const batchAPI = {
  getAllBatches: async (): Promise<BatchesResponse> => {
    const response = await api.get<BatchesResponse>('/batches');
    return response.data;
  },
  getBatchById: async (id: number): Promise<BatchResponse> => {
    const response = await api.get<BatchResponse>(`/batches/${id}`);
    return response.data;
  },
  createBatch: async (data: CreateBatchRequest): Promise<BatchResponse> => {
    const response = await api.post<BatchResponse>('/batches', data);
    return response.data;
  },
  updateBatch: async (id: number, data: UpdateBatchRequest): Promise<BatchResponse> => {
    const response = await api.put<BatchResponse>(`/batches/${id}`, data);
    return response.data;
  },
  deleteBatch: async (id: number): Promise<{ status: string; message: string }> => {
    const response = await api.delete<{ status: string; message: string }>(`/batches/${id}`);
    return response.data;
  },
  suggestCandidates: async (batchId: number): Promise<SuggestCandidatesResponse> => {
    const response = await api.get<SuggestCandidatesResponse>(`/batches/${batchId}/candidates/suggest`);
    return response.data;
  },
  assignFaculty: async (batchId: number, facultyIds: number[]): Promise<{ status: string; message: string; data: any }> => {
    const response = await api.put(`/batches/${batchId}/faculty`, { facultyIds });
    return response.data;
  },
};

