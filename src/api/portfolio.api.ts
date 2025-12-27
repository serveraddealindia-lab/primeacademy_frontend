import api from './axios';

export interface Portfolio {
  id: number;
  studentId: number;
  batchId: number;
  files: Record<string, string> | string[] | null;
  pdfUrl?: string | null;
  youtubeUrl?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: number;
  approvedAt?: string;
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

export interface CreatePortfolioRequest {
  batchId: number;
  files?: string[] | Record<string, string>;
  pdfUrl?: string;
  youtubeUrl?: string;
}

export interface ApprovePortfolioRequest {
  approve: boolean;
}

export interface PortfoliosResponse {
  status: string;
  data: {
    portfolios: Portfolio[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface PortfolioResponse {
  status: string;
  data: {
    portfolio: Portfolio;
  };
}

export const portfolioAPI = {
  getAllPortfolios: async (params?: { studentId?: number; batchId?: number; status?: string }): Promise<PortfoliosResponse> => {
    const response = await api.get<PortfoliosResponse>('/portfolios', { params });
    return response.data;
  },
  getStudentPortfolio: async (studentId: number): Promise<PortfolioResponse> => {
    const response = await api.get<PortfolioResponse>(`/students/${studentId}/portfolio`);
    return response.data;
  },
  createPortfolio: async (studentId: number, data: CreatePortfolioRequest): Promise<PortfolioResponse> => {
    const response = await api.post<PortfolioResponse>(`/students/${studentId}/portfolio`, data);
    return response.data;
  },
  approvePortfolio: async (id: number, data: ApprovePortfolioRequest): Promise<PortfolioResponse> => {
    const response = await api.post<PortfolioResponse>(`/portfolio/${id}/approve`, data);
    return response.data;
  },
};

