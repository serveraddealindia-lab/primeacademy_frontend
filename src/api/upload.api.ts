import api from './axios';

export interface UploadedFile {
  originalName: string;
  filename: string;
  size: number;
  mimetype: string;
  url: string;
}

export interface UploadResponse {
  status: string;
  message: string;
  data: {
    files: UploadedFile[];
    urls: string[];
    count: number;
  };
}

export const uploadAPI = {
  uploadFile: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('files', file);
    
    // Don't set Content-Type - let browser set it automatically with boundary
    // The axios interceptor will handle removing Content-Type for FormData
    const response = await api.post<UploadResponse>('/upload', formData);
    return response.data;
  },
  
  uploadMultipleFiles: async (files: File[]): Promise<UploadResponse> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    
    // Don't set Content-Type - let browser set it automatically with boundary
    // The axios interceptor will handle removing Content-Type for FormData
    const response = await api.post<UploadResponse>('/upload', formData);
    return response.data;
  },
};










