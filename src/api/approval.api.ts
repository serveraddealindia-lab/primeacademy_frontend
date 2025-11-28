import api from './axios';

export interface ChangeRequest {
  id: number;
  type: 'batch_change' | 'leave' | 'extension' | 'other';
  studentId: number;
  batchId?: number;
  requestedBy?: number;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  requestedData?: Record<string, any>;
  approvedBy?: number;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
  student?: {
    id: number;
    name: string;
    email: string;
  };
  batch?: {
    id: number;
    title: string;
  };
}

export interface ApproveRequestRequest {
  approve: boolean;
  rejectionReason?: string;
}

export interface ChangeRequestsResponse {
  status: string;
  data: {
    changeRequests: ChangeRequest[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface ChangeRequestResponse {
  status: string;
  data: {
    changeRequest: ChangeRequest;
  };
}

export const approvalAPI = {
  getAllChangeRequests: async (params?: { type?: string; status?: string; studentId?: number }): Promise<ChangeRequestsResponse> => {
    const response = await api.get<ChangeRequestsResponse>('/change-requests', { params });
    return response.data;
  },
  getChangeRequest: async (id: number): Promise<ChangeRequestResponse> => {
    const response = await api.get<ChangeRequestResponse>(`/change-requests/${id}`);
    return response.data;
  },
  approveChangeRequest: async (id: number, data: ApproveRequestRequest): Promise<ChangeRequestResponse> => {
    const response = await api.post<ChangeRequestResponse>(`/change-requests/${id}/approve`, data);
    return response.data;
  },
};







