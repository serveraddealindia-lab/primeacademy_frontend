import api from './axios';

export interface PaymentTransaction {
  id: number;
  studentId: number;
  enrollmentId?: number | null;
  amount: number;
  paidAmount?: number;
  dueDate?: string;
  paidDate?: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  receiptUrl?: string | null;
  paymentMethod?: string | null;
  transactionId?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  student?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  };
  enrollment?: {
    id: number;
    batchId: number;
    batch?: {
      id: number;
      title: string;
    };
  };
}

export interface CreatePaymentRequest {
  studentId: number;
  enrollmentId?: number;
  amount: number;
  dueDate: string;
  notes?: string;
  paymentMethod?: string;
  transactionId?: string;
}

export interface UpdatePaymentRequest {
  status?: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  paidDate?: string;
  paymentMethod?: string;
  transactionId?: string;
  notes?: string;
  paidAmount?: number;
  receiptUrl?: string;
}

export interface PaymentsResponse {
  status: string;
  data: {
    payments: PaymentTransaction[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface PaymentResponse {
  status: string;
  data: {
    payment: PaymentTransaction;
  };
}

export const paymentAPI = {
  getAllPayments: async (params?: { studentId?: number; status?: string }): Promise<PaymentsResponse> => {
    const response = await api.get<PaymentsResponse>('/payments', { params });
    return response.data;
  },
  getPayment: async (id: number): Promise<PaymentResponse> => {
    const response = await api.get<PaymentResponse>(`/payments/${id}`);
    return response.data;
  },
  createPayment: async (data: CreatePaymentRequest): Promise<PaymentResponse> => {
    const response = await api.post<PaymentResponse>('/payments', data);
    return response.data;
  },
  updatePayment: async (id: number, data: UpdatePaymentRequest): Promise<PaymentResponse> => {
    const response = await api.put<PaymentResponse>(`/payments/${id}`, data);
    return response.data;
  },
  downloadReceipt: async (id: number): Promise<Blob> => {
    const response = await api.get(`/payments/${id}/receipt`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

