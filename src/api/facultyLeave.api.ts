import api from './axios';
import { LeaveStatus } from './studentLeave.api';

export interface FacultyLeave {
  id: number;
  facultyId: number;
  startDate: string;
  endDate: string;
  reason?: string;
  status: LeaveStatus;
  approvedBy?: number;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
  faculty?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  };
  approver?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CreateFacultyLeaveRequest {
  facultyId: number;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface ApproveLeaveRequest {
  approve: boolean;
  rejectionReason?: string;
}

export interface FacultyLeavesResponse {
  status: string;
  data: {
    leaves: FacultyLeave[];
    count: number;
  };
}

export interface FacultyLeaveResponse {
  status: string;
  message: string;
  data: {
    leave: FacultyLeave;
  };
}

export interface FacultyLeavesQueryParams {
  facultyId?: number;
  status?: LeaveStatus;
}

export const facultyLeaveAPI = {
  createLeave: async (data: CreateFacultyLeaveRequest): Promise<FacultyLeaveResponse> => {
    const response = await api.post<FacultyLeaveResponse>('/faculty-leaves', data);
    return response.data;
  },

  getLeaves: async (params?: FacultyLeavesQueryParams): Promise<FacultyLeavesResponse> => {
    const response = await api.get<FacultyLeavesResponse>('/faculty-leaves', { params });
    return response.data;
  },

  approveLeave: async (id: number, data: ApproveLeaveRequest): Promise<FacultyLeaveResponse> => {
    const response = await api.post<FacultyLeaveResponse>(`/faculty-leaves/${id}/approve`, data);
    return response.data;
  },
};










