import api from './axios';
import { StudentProfile } from './user.api';

export interface Student {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface StudentsResponse {
  status: string;
  data: {
    students: Student[];
    totalCount: number;
  };
}

export interface StudentDetails extends Student {
  phone?: string;
  avatarUrl?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  studentProfile?: StudentProfile | null;
  enrollments?: Array<{
    id: number;
    status: string;
    enrollmentDate?: string;
    batch: {
      id: number;
      title: string;
      software?: string | null;
      mode?: string | null;
      status?: string | null;
      schedule?: Record<string, unknown> | null;
    } | null;
  }>;
}

export interface StudentDetailsResponse {
  status: string;
  data: {
    student: StudentDetails;
  };
}

export interface Enrollment {
  id: number;
  studentId: number;
  batchId: number;
  enrollmentDate: string;
  status: string;
  student?: Student;
  batch?: {
    id: number;
    title: string;
    software?: string;
  };
}

export interface CreateEnrollmentRequest {
  studentId: number;
  batchId: number;
  enrollmentDate?: string;
  status?: string;
}

export interface EnrollmentResponse {
  status: string;
  message: string;
  data: {
    enrollment: Enrollment;
  };
}

export interface CompleteEnrollmentRequest {
  // Basic Information
  studentName: string;
  email?: string;
  phone: string;
  whatsappNumber?: string;
  dateOfAdmission?: string;
  
  // Address
  localAddress?: string;
  permanentAddress?: string;
  
  // Emergency Contact
  emergencyContactNumber?: string;
  emergencyName?: string;
  emergencyRelation?: string;
  
  // Course Details
  courseName?: string;
  batchId?: number;
  softwaresIncluded?: string;
  
  // Financial Details
  totalDeal?: number;
  bookingAmount?: number;
  balanceAmount?: number;
  emiPlan?: boolean;
  emiPlanDate?: string;
  
  // Additional Information
  complimentarySoftware?: string;
  complimentaryGift?: string;
  hasReference?: boolean;
  referenceDetails?: string;
  counselorName?: string;
  leadSource?: string;
  walkinDate?: string;
  masterFaculty?: string;
}

export interface CompleteEnrollmentResponse {
  status: string;
  message: string;
  data: {
    user: {
      id: number;
      name: string;
      email: string;
    };
    enrollment?: Enrollment;
  };
}

export const studentAPI = {
  getAllStudents: async (): Promise<StudentsResponse> => {
    const response = await api.get<StudentsResponse>('/attendance-reports/all-students');
    return response.data;
  },

  getStudentDetails: async (studentId: number): Promise<StudentDetailsResponse> => {
    const response = await api.get<StudentDetailsResponse>(`/attendance-reports/students/${studentId}/details`);
    return response.data;
  },

  createEnrollment: async (data: CreateEnrollmentRequest): Promise<EnrollmentResponse> => {
    const response = await api.post<EnrollmentResponse>('/enrollments', data);
    return response.data;
  },

  completeEnrollment: async (data: CompleteEnrollmentRequest): Promise<CompleteEnrollmentResponse> => {
    // This will create a student user, student profile, and enrollment in one call
    // The backend endpoint should be POST /api/students/enroll
    const response = await api.post<CompleteEnrollmentResponse>('/students/enroll', data);
    return response.data;
  },

  bulkEnrollStudents: async (file: File): Promise<{ status: string; message: string; data: { success: number; failed: number; errors: any[] } }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/students/bulk-enroll', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  downloadEnrollmentTemplate: async (): Promise<Blob> => {
    const response = await api.get('/students/template', {
      responseType: 'blob',
    });
    return response.data;
  },

  createThreeDummyStudents: async (): Promise<{ status: string; message: string; data: any }> => {
    const response = await api.post('/students/create-three-dummy');
    return response.data;
  },

  getAllSoftware: async (): Promise<{ status: string; data: { software: string[]; count: number } }> => {
    const response = await api.get('/students/all-software');
    return response.data;
  },
};

