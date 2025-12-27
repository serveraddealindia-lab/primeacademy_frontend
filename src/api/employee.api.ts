import api from './axios';

export interface EmployeeProfile {
  id: number;
  userId: number;
  employeeId: string;
  gender?: string;
  dateOfBirth?: string;
  nationality?: string;
  maritalStatus?: string;
  address?: string;
  department?: string;
  designation?: string;
  dateOfJoining?: string;
  employmentType?: string;
  reportingManager?: string;
  workLocation?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
  panNumber?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  documents?: Record<string, any> | string | null;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    role: string;
  };
}

export interface Employee {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  avatarUrl?: string;
  createdAt: string;
  employeeProfile?: EmployeeProfile;
}

export interface EmployeesResponse {
  status: string;
  data: {
    users: Employee[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface EmployeeProfileResponse {
  status: string;
  data: {
    employeeProfile: EmployeeProfile;
  };
}

export interface CreateEmployeeProfileRequest {
  userId: number;
  employeeId: string;
  gender?: string;
  dateOfBirth?: string;
  nationality?: string;
  maritalStatus?: string;
  address?: string;
  department?: string;
  designation?: string;
  dateOfJoining?: string;
  employmentType?: string;
  reportingManager?: string;
  workLocation?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
  panNumber?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  documents?: Record<string, any> | string | null;
}

export const employeeAPI = {
  getAllEmployees: async (): Promise<EmployeesResponse> => {
    const response = await api.get<EmployeesResponse>('/users', {
      params: {
        role: 'employee',
        isActive: true,
      },
    });
    return response.data;
  },
  getEmployeeProfile: async (userId: number): Promise<EmployeeProfileResponse> => {
    const response = await api.get<EmployeeProfileResponse>(`/employees/${userId}`);
    return response.data;
  },
  createEmployeeProfile: async (data: CreateEmployeeProfileRequest): Promise<EmployeeProfileResponse> => {
    const response = await api.post<EmployeeProfileResponse>('/employees', data);
    return response.data;
  },
  updateEmployeeProfile: async (userId: number, data: Partial<CreateEmployeeProfileRequest & { documents?: Record<string, any> | string | null }>): Promise<EmployeeProfileResponse> => {
    const response = await api.put<EmployeeProfileResponse>(`/users/${userId}/employee-profile`, data);
    return response.data;
  },
};

