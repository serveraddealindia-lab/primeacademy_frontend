import api from './axios';
import { Module } from './permission.api';

export interface Role {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  rolePermissions?: RolePermission[];
}

export interface RolePermission {
  id: number;
  roleId: number;
  module: Module;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissions?: Array<{
    module: Module;
    canView: boolean;
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
  permissions?: Array<{
    module: Module;
    canView: boolean;
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>;
}

export interface AssignRoleRequest {
  roleId: number;
}

export interface RolesResponse {
  status: string;
  data: {
    roles: Role[];
    count: number;
  };
}

export interface RoleResponse {
  status: string;
  data: {
    role: Role;
  };
}

export interface UserRolesResponse {
  status: string;
  data: {
    roles: Role[];
  };
}

export const roleAPI = {
  getAllRoles: async (): Promise<RolesResponse> => {
    const response = await api.get<RolesResponse>('/roles');
    return response.data;
  },
  getRole: async (id: number): Promise<RoleResponse> => {
    const response = await api.get<RoleResponse>(`/roles/${id}`);
    return response.data;
  },
  createRole: async (data: CreateRoleRequest): Promise<RoleResponse> => {
    const response = await api.post<RoleResponse>('/roles', data);
    return response.data;
  },
  updateRole: async (id: number, data: UpdateRoleRequest): Promise<RoleResponse> => {
    const response = await api.put<RoleResponse>(`/roles/${id}`, data);
    return response.data;
  },
  deleteRole: async (id: number): Promise<void> => {
    await api.delete(`/roles/${id}`);
  },
  assignRoleToUser: async (userId: number, data: AssignRoleRequest): Promise<any> => {
    const response = await api.post(`/roles/users/${userId}/assign`, data);
    return response.data;
  },
  unassignRoleFromUser: async (userId: number, roleId: number): Promise<void> => {
    await api.delete(`/roles/users/${userId}/roles/${roleId}`);
  },
  getUserRoles: async (userId: number): Promise<UserRolesResponse> => {
    const response = await api.get<UserRolesResponse>(`/roles/users/${userId}/roles`);
    return response.data;
  },
};










