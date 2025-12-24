import api from './axios';

export interface FacultyProfile {
  id: number;
  userId: number;
  expertise?: string;
  availability?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FacultyUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  facultyProfile?: FacultyProfile;
}

export interface FacultyResponse {
  status: string;
  data: {
    users?: FacultyUser[];
    faculty?: FacultyUser[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface CreateFacultyRequest {
  userId: number;
  expertise?: string;
  availability?: string;
  documents?: any;
  softwareProficiency?: string;
}

export interface CreateFacultyResponse {
  status: string;
  message: string;
  data: {
    facultyProfile?: {
      id: number;
      userId: number;
      expertise?: string;
      availability?: string;
      user: FacultyUser;
      createdAt: string;
      updatedAt: string;
    };
    user?: FacultyUser;
  };
}

export const facultyAPI = {
  getAllFaculty: async (limit: number = 1000): Promise<FacultyResponse> => {
    const response = await api.get<FacultyResponse>('/users', {
      params: { role: 'faculty', limit, isActive: 'true' },
    });
    return response.data;
  },

  createFacultyProfile: async (data: CreateFacultyRequest): Promise<CreateFacultyResponse> => {
    const response = await api.post<CreateFacultyResponse>('/faculty', data);
    return response.data;
  },
  updateFacultyProfile: async (userId: number, data: { expertise?: string; availability?: string; documents?: any; softwareProficiency?: string; dateOfBirth?: string }): Promise<CreateFacultyResponse> => {
    const response = await api.put<CreateFacultyResponse>(`/users/${userId}/faculty-profile`, data);
    return response.data;
  },
};

