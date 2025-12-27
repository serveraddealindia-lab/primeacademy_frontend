import api from './axios';

export interface StudentProfile {
  id: number;
  userId: number;
  serialNo?: string;
  dob?: string;
  address?: string;
  documents?: Record<string, any>;
  photoUrl?: string;
  softwareList?: string[];
  enrollmentDate?: string;
  status?: string;
  finishedBatches?: string[];
  currentBatches?: string[];
  pendingBatches?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: 'superadmin' | 'admin' | 'faculty' | 'student' | 'employee';
  isActive: boolean;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  studentProfile?: StudentProfile;
  facultyProfile?: any;
  employeeProfile?: any;
  enrollments?: Array<{
    id: number;
    status: string;
    enrollmentDate?: string;
    batch?: {
      id: number;
      title: string;
      software?: string | null;
      mode?: string | null;
      status?: string | null;
      schedule?: Record<string, unknown> | null;
    } | null;
  }>;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  phone?: string;
  role: 'superadmin' | 'admin' | 'faculty' | 'student' | 'employee';
  password: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  phone?: string;
  role?: 'superadmin' | 'admin' | 'faculty' | 'student' | 'employee';
  isActive?: boolean;
  avatarUrl?: string;
}

export interface UpdateStudentProfileRequest {
  dob?: string;
  address?: string;
  photoUrl?: string;
  softwareList?: string[];
  enrollmentDate?: string;
  status?: string;
  documents?: Record<string, any>;
}

export interface UsersResponse {
  status: string;
  data: {
    users: User[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface UserResponse {
  status: string;
  data: {
    user: User;
  };
}

export interface LoginAsUserResponse {
  status: string;
  data: {
    token: string;
    user: User;
  };
}

export interface ResetPasswordResponse {
  status: string;
  message: string;
  data: {
    newPassword: string;
    userId: number;
    email: string;
  };
}

export const userAPI = {
  getAllUsers: async (params?: { role?: string; isActive?: boolean }): Promise<UsersResponse> => {
    const response = await api.get<UsersResponse>('/users', { params });
    return response.data;
  },
  getUser: async (id: number): Promise<UserResponse> => {
    const response = await api.get<UserResponse>(`/users/${id}`);
    return response.data;
  },
  createUser: async (data: CreateUserRequest): Promise<UserResponse> => {
    const response = await api.post<UserResponse>('/auth/register', data);
    return response.data;
  },
  updateUser: async (id: number, data: UpdateUserRequest): Promise<UserResponse> => {
    const response = await api.put<UserResponse>(`/users/${id}`, data);
    return response.data;
  },
  deleteUser: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
  loginAsUser: async (id: number): Promise<LoginAsUserResponse> => {
    const response = await api.post<LoginAsUserResponse>(`/users/${id}/login-as`);
    return response.data;
  },
  updateStudentProfile: async (userId: number, data: UpdateStudentProfileRequest): Promise<UserResponse> => {
    const response = await api.put<UserResponse>(`/users/${userId}/student-profile`, data);
    return response.data;
  },
  resetPassword: async (userId: number, newPassword?: string): Promise<ResetPasswordResponse> => {
    const response = await api.post<ResetPasswordResponse>(`/users/${userId}/reset-password`, { newPassword });
    return response.data;
  },
};

