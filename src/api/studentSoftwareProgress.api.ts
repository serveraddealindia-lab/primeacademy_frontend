import api from './axios';

export interface StudentSoftwareProgress {
  id: number;
  studentId: number;
  softwareName: string;
  softwareCode?: string | null;
  status: 'XX' | 'IP' | 'NO' | 'Finished';
  enrollmentDate?: string | null;
  courseName?: string | null;
  courseType?: string | null;
  studentStatus?: string | null;
  batchTiming?: string | null;
  schedule?: string | null;
  facultyName?: string | null;
  batchStartDate?: string | null;
  batchEndDate?: string | null;
  batchId?: number | null;
  notes?: string | null;
  student?: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  batch?: {
    id: number;
    title: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface GetStudentSoftwareProgressParams {
  studentId?: number;
  softwareName?: string;
  status?: string;
  courseName?: string;
  page?: number;
  limit?: number;
}

export interface CreateStudentSoftwareProgressRequest {
  studentId: number;
  softwareName: string;
  softwareCode?: string;
  status?: 'XX' | 'IP' | 'NO' | 'Finished';
  enrollmentDate?: string;
  courseName?: string;
  courseType?: string;
  studentStatus?: string;
  batchTiming?: string;
  schedule?: string;
  facultyName?: string;
  batchStartDate?: string;
  batchEndDate?: string;
  batchId?: number;
  notes?: string;
}

export interface UpdateStudentSoftwareProgressRequest {
  softwareName?: string;
  softwareCode?: string;
  status?: 'XX' | 'IP' | 'NO' | 'Finished';
  enrollmentDate?: string;
  courseName?: string;
  courseType?: string;
  studentStatus?: string;
  batchTiming?: string;
  schedule?: string;
  facultyName?: string;
  batchStartDate?: string;
  batchEndDate?: string;
  batchId?: number;
  notes?: string;
}

export interface ImportExcelResponse {
  status: string;
  data: {
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  };
}

export const studentSoftwareProgressAPI = {
  // Get all records
  getAll: async (params?: GetStudentSoftwareProgressParams) => {
    const queryParams = new URLSearchParams();
    if (params?.studentId) queryParams.append('studentId', params.studentId.toString());
    if (params?.softwareName) queryParams.append('softwareName', params.softwareName);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.courseName) queryParams.append('courseName', params.courseName);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await api.get(`/student-software-progress?${queryParams.toString()}`);
    return response.data;
  },

  // Get single record
  getById: async (id: number) => {
    const response = await api.get(`/student-software-progress/${id}`);
    return response.data;
  },

  // Create record
  create: async (data: CreateStudentSoftwareProgressRequest) => {
    const response = await api.post('/student-software-progress', data);
    return response.data;
  },

  // Update record
  update: async (id: number, data: UpdateStudentSoftwareProgressRequest) => {
    const response = await api.put(`/student-software-progress/${id}`, data);
    return response.data;
  },

  // Delete record
  delete: async (id: number) => {
    const response = await api.delete(`/student-software-progress/${id}`);
    return response.data;
  },

  // Delete all records
  deleteAll: async () => {
    const response = await api.delete('/student-software-progress');
    return response.data;
  },

  // Import Excel
  importExcel: async (file: File): Promise<ImportExcelResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/student-software-progress/import-excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Download Excel import template
  downloadTemplate: async () => {
    try {
      const response = await api.get('/student-software-progress/download-template', {
        responseType: 'blob',
      });

      // Check if the blob is actually a JSON error response
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.message || 'Failed to download template');
      }

      // Verify it's an Excel file
      if (!contentType.includes('spreadsheetml') && !contentType.includes('excel')) {
        // Might be an error, try to parse as JSON
        try {
          const text = await response.data.text();
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || 'Failed to download template');
        } catch {
          // Not JSON, proceed with download
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'studentwise_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      
      // Clean up after a short delay
      setTimeout(() => {
        link.remove();
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error: any) {
      // Handle blob errors
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || errorData.error || 'Failed to download template');
        } catch (parseError) {
          throw new Error('Failed to download template. Please check backend logs.');
        }
      }
      
      // Handle axios errors
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      if (error.message) {
        throw error;
      }
      
      throw new Error('Failed to download template. Please try again.');
    }
  },

  // Export Excel
  exportExcel: async (params?: { studentId?: number; courseName?: string; status?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.studentId) queryParams.append('studentId', params.studentId.toString());
    if (params?.courseName) queryParams.append('courseName', params.courseName);
    if (params?.status) queryParams.append('status', params.status);

    try {
      const response = await api.get(`/student-software-progress/export-excel?${queryParams.toString()}`, {
        responseType: 'blob',
      });

      // Check if the blob is actually a JSON error response
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.message || 'Failed to export Excel');
      }

      // Verify it's an Excel file
      if (!contentType.includes('spreadsheetml') && !contentType.includes('excel')) {
        // Might be an error, try to parse as JSON
        try {
          const text = await response.data.text();
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || 'Failed to export Excel');
        } catch {
          // Not JSON, proceed with download
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `student-software-progress-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      
      // Clean up after a short delay
      setTimeout(() => {
        link.remove();
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error: any) {
      // Handle blob errors
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || errorData.error || 'Failed to export Excel');
        } catch (parseError) {
          throw new Error('Failed to export Excel. Please check backend logs.');
        }
      }
      
      // Handle axios errors
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      if (error.message) {
        throw error;
      }
      
      throw new Error('Failed to export Excel. Please try again.');
    }
  },
};
