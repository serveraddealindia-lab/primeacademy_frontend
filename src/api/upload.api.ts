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
    
    const response = await api.post<UploadResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  uploadMultipleFiles: async (files: File[]): Promise<UploadResponse> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    
    const response = await api.post<UploadResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};







