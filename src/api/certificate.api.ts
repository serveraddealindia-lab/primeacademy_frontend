import api from './axios';

export interface Certificate {
  id: number;
  studentId: number;
  courseName: string;
  softwareCovered: string[];
  grade: string;
  monthOfCompletion: string;
  certificateNumber: string;
  pdfUrl?: string;
  issuedBy?: number;
  issuedAt?: string;
  studentDeclarationAccepted?: boolean;
  studentDeclarationDate?: string;
  createdAt?: string;
  updatedAt?: string;
  student?: {
    id: number;
    name: string;
    email: string;
  };
  issuer?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CreateCertificateRequest {
  studentId: number;
  courseName: string;
  softwareCovered: string[];
  grade: string;
  monthOfCompletion: string;
  certificateNumber?: string;
  studentDeclarationAccepted?: boolean; // Optional declaration acceptance
}

export interface CertificatesResponse {
  status: string;
  data: {
    certificates: Certificate[];
  };
}

export interface CertificateResponse {
  status: string;
  data: {
    certificate: Certificate;
    pdfUrl?: string;
  };
}

export const certificateAPI = {
  getAllCertificates: async (): Promise<CertificatesResponse> => {
    const response = await api.get<CertificatesResponse>('/certificates');
    return response.data;
  },

  getCertificateById: async (id: number): Promise<CertificateResponse> => {
    const response = await api.get<CertificateResponse>(`/certificates/${id}`);
    return response.data;
  },

  createCertificate: async (data: CreateCertificateRequest): Promise<CertificateResponse> => {
    const response = await api.post<CertificateResponse>('/certificates', data);
    return response.data;
  },

  downloadCertificate: async (id: number): Promise<Blob> => {
    const response = await api.get(`/certificates/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
};



