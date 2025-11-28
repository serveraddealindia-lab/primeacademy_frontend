import api from './axios';

export interface Session {
  id: number;
  batchId: number;
  facultyId: number;
  date: string;
  startTime: string;
  endTime: string;
  topic?: string;
  isBackup: boolean;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  actualStartAt?: string;
  actualEndAt?: string;
  createdAt?: string;
  updatedAt?: string;
  batch?: {
    id: number;
    title: string;
  };
  faculty?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CreateSessionRequest {
  batchId: number;
  facultyId: number;
  date: string;
  startTime: string;
  endTime: string;
  topic?: string;
  isBackup?: boolean;
}

export interface SessionsResponse {
  status: string;
  data: {
    sessions: Session[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface SessionResponse {
  status: string;
  data: {
    session: Session;
  };
}

export type BatchSchedule = Record<string, { startTime: string; endTime: string }>;

export interface FacultyBatch {
  batch: {
    id: number;
    title: string;
    startDate?: string;
    endDate?: string;
    schedule?: BatchSchedule;
    status?: string;
    mode?: string;
  };
  activeSession: SessionSummary | null;
}

export interface SessionSummary {
  id: number;
  batchId: number;
  facultyId: number | null;
  date: string;
  topic?: string | null;
  status: 'scheduled' | 'ongoing' | 'completed';
  actualStartAt?: string | null;
  actualEndAt?: string | null;
}

export type AttendanceOption = 'present' | 'absent' | 'late';

export interface StudentAttendanceEntry {
  studentId: number;
  name: string;
  email: string;
  status: AttendanceOption;
  present?: boolean;
}

export interface SessionAttendancePayload {
  attendance: Array<{ studentId: number; status?: AttendanceOption; present?: boolean }>;
}

export const sessionAPI = {
  getFacultyBatches: async (): Promise<FacultyBatch[]> => {
    const response = await api.get<{ status: string; data: FacultyBatch[] }>('/sessions/faculty/assigned');
    return response.data.data;
  },
  startSession: async (batchId: number, payload?: { topic?: string }) => {
    const response = await api.post<{ status: string; data: SessionSummary }>(`/sessions/${batchId}/start`, payload);
    return response.data.data;
  },
  endSession: async (sessionId: number) => {
    const response = await api.post<{ status: string; data: SessionSummary }>(`/sessions/${sessionId}/end`);
    return response.data.data;
  },
  submitAttendance: async (sessionId: number, payload: SessionAttendancePayload) => {
    const response = await api.post<{ status: string; data: Array<{ studentId: number; status: AttendanceOption }> }>(
      `/sessions/${sessionId}/attendance`,
      payload
    );
    return response.data.data;
  },
  getBatchStudents: async (batchId: number): Promise<StudentAttendanceEntry[]> => {
    const response = await api.get<{
      status: string;
      data: Array<{
        student: {
          id: number;
          name: string;
          email: string;
        };
      }>;
    }>(`/batches/${batchId}/enrollments`);

    return response.data.data.map((enrollment) => ({
      studentId: enrollment.student.id,
      name: enrollment.student.name,
      email: enrollment.student.email,
      status: 'present',
      present: true,
    }));
  },
  getBatchHistory: async (batchId: number): Promise<any[]> => {
    const response = await api.get<{ status: string; data: any[] }>(`/sessions/batch/${batchId}/history`);
    return response.data.data;
  },
  getAllSessions: async (params?: { batchId?: number; facultyId?: number; status?: string }): Promise<SessionsResponse> => {
    const response = await api.get<SessionsResponse>('/sessions', { params });
    return response.data;
  },
  getSession: async (id: number): Promise<SessionResponse> => {
    const response = await api.get<SessionResponse>(`/sessions/${id}`);
    return response.data;
  },
  createSession: async (data: CreateSessionRequest): Promise<SessionResponse> => {
    const response = await api.post<SessionResponse>('/sessions', data);
    return response.data;
  },
  checkInSession: async (id: number): Promise<SessionResponse> => {
    const response = await api.post<SessionResponse>(`/sessions/${id}/checkin`);
    return response.data;
  },
  checkOutSession: async (id: number): Promise<SessionResponse> => {
    const response = await api.post<SessionResponse>(`/sessions/${id}/checkout`);
    return response.data;
  },
};





