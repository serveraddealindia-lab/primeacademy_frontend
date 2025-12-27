import api from './axios';

export interface Enrollment {
  id: number;
  studentId: number;
  batchId: number;
  enrollmentDate?: string;
  status?: string;
  paymentPlan?: Record<string, unknown>;
  student?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  };
  batch?: {
    id: number;
    title: string;
    software?: string;
  };
}

export interface EnrollmentsResponse {
  status: string;
  data: Enrollment[];
}

export interface EnrollmentResponse {
  status: string;
  data: {
    enrollment: Enrollment;
  };
}

export interface CreateEnrollmentRequest {
  studentId: number;
  batchId: number;
  enrollmentDate?: string;
  status?: string;
  paymentPlan?: Record<string, unknown>;
}

export const enrollmentAPI = {
  getAllEnrollments: async (params?: { studentId?: number; batchId?: number; status?: string }): Promise<EnrollmentsResponse> => {
    const response = await api.get<EnrollmentsResponse>('/enrollments', { params });
    return response.data;
  },
  getEnrollmentById: async (id: number): Promise<EnrollmentResponse> => {
    const response = await api.get<EnrollmentResponse>(`/enrollments/${id}`);
    return response.data;
  },
  createEnrollment: async (data: CreateEnrollmentRequest): Promise<EnrollmentResponse> => {
    const response = await api.post<EnrollmentResponse>('/enrollments', data);
    return response.data;
  },
  updateEnrollment: async (id: number, data: Partial<CreateEnrollmentRequest>): Promise<EnrollmentResponse> => {
    const response = await api.put<EnrollmentResponse>(`/enrollments/${id}`, data);
    return response.data;
  },
  deleteEnrollment: async (id: number): Promise<{ status: string; message: string }> => {
    const response = await api.delete<{ status: string; message: string }>(`/enrollments/${id}`);
    return response.data;
  },
};

