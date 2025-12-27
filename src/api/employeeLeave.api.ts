import api from './axios';
import { LeaveStatus } from './studentLeave.api';

export interface EmployeeLeave {
  id: number;
  employeeId: number;
  startDate: string;
  endDate: string;
  reason?: string;
  status: LeaveStatus;
  approvedBy?: number;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
  employee?: {
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

export interface CreateEmployeeLeaveRequest {
  employeeId: number;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface ApproveLeaveRequest {
  approve: boolean;
  rejectionReason?: string;
}

export interface EmployeeLeavesResponse {
  status: string;
  data: {
    leaves: EmployeeLeave[];
    count: number;
  };
}

export interface EmployeeLeaveResponse {
  status: string;
  message: string;
  data: {
    leave: EmployeeLeave;
  };
}

export interface EmployeeLeavesQueryParams {
  employeeId?: number;
  status?: LeaveStatus;
}

export const employeeLeaveAPI = {
  createLeave: async (data: CreateEmployeeLeaveRequest): Promise<EmployeeLeaveResponse> => {
    const response = await api.post<EmployeeLeaveResponse>('/employee-leaves', data);
    return response.data;
  },

  getLeaves: async (params?: EmployeeLeavesQueryParams): Promise<EmployeeLeavesResponse> => {
    const response = await api.get<EmployeeLeavesResponse>('/employee-leaves', { params });
    return response.data;
  },

  approveLeave: async (id: number, data: ApproveLeaveRequest): Promise<EmployeeLeaveResponse> => {
    const response = await api.post<EmployeeLeaveResponse>(`/employee-leaves/${id}/approve`, data);
    return response.data;
  },
};










