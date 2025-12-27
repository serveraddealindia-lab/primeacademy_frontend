import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { roleAPI, Role, CreateRoleRequest, UpdateRoleRequest, RolePermission } from '../api/role.api';
import { permissionAPI, Module, ModulesResponse } from '../api/permission.api';
import { PREDEFINED_ROLE_PERMISSIONS } from '../utils/rolePermissions';

const PREDEFINED_ROLES = ['superadmin', 'admin', 'faculty', 'student', 'employee'];

export const RoleManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPredefinedRole, setSelectedPredefinedRole] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [availableModules, setAvailableModules] = useState<Array<{ value: string; label: string }>>([
    { value: 'batches', label: 'Batches' },
    { value: 'students', label: 'Students' },
    { value: 'faculty', label: 'Faculty' },
    { value: 'employees', label: 'Employees' },
    { value: 'sessions', label: 'Sessions' },
    { value: 'attendance', label: 'Attendance' },
    { value: 'payments', label: 'Payments' },
    { value: 'portfolios', label: 'Portfolios' },
    { value: 'reports', label: 'Reports' },
    { value: 'approvals', label: 'Approvals' },
    { value: 'users', label: 'Users' },
    { value: 'software_completions', label: 'Software Completions' },
    { value: 'student_leaves', label: 'Student Leaves' },
    { value: 'batch_extensions', label: 'Batch Extensions' },
    { value: 'employee_leaves', label: 'Employee Leaves' },
    { value: 'faculty_leaves', label: 'Faculty Leaves' },
  ]);

  // Fetch roles
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleAPI.getAllRoles(),
    enabled: currentUser?.role === 'superadmin',
  });

  // Hardcoded modules as fallback
  const FALLBACK_MODULES = [
    { value: 'batches', label: 'Batches' },
    { value: 'students', label: 'Students' },
    { value: 'faculty', label: 'Faculty' },
    { value: 'employees', label: 'Employees' },
    { value: 'sessions', label: 'Sessions' },
    { value: 'attendance', label: 'Attendance' },
    { value: 'payments', label: 'Payments' },
    { value: 'portfolios', label: 'Portfolios' },
    { value: 'reports', label: 'Reports' },
    { value: 'approvals', label: 'Approvals' },
    { value: 'users', label: 'Users' },
    { value: 'software_completions', label: 'Software Completions' },
    { value: 'student_leaves', label: 'Student Leaves' },
    { value: 'batch_extensions', label: 'Batch Extensions' },
    { value: 'employee_leaves', label: 'Employee Leaves' },
    { value: 'faculty_leaves', label: 'Faculty Leaves' },
  ];

  // Fetch available modules - always enabled for superadmin
  const {
    data: modulesData,
    isLoading: modulesLoading,
    error: modulesError,
  } = useQuery<ModulesResponse, Error>({
    queryKey: ['modules'],
    queryFn: () => permissionAPI.getModules(),
    enabled: currentUser?.role === 'superadmin',
    retry: 1,
  });

  useEffect(() => {
    if (modulesData?.data.modules && modulesData.data.modules.length > 0) {
      setAvailableModules(modulesData.data.modules);
    } else if (!modulesLoading && modulesError) {
      setAvailableModules(FALLBACK_MODULES);
    }
  }, [modulesData, modulesLoading, modulesError]);

  // Initialize permissions when create modal opens
  useEffect(() => {
    if (isCreateModalOpen && availableModules.length > 0) {
      // Always reinitialize permissions when modal opens with fresh modules
      const initialPermissions = availableModules.map((module) => ({
        id: 0,
        roleId: 0,
        module: module.value as Module,
        canView: false,
        canAdd: false,
        canEdit: false,
        canDelete: false,
      }));
      setRolePermissions(initialPermissions);
    }
  }, [isCreateModalOpen, availableModules.length]);

  // Initialize permissions when edit/permission modal opens
  useEffect(() => {
    if ((isEditModalOpen || isPermissionModalOpen) && availableModules.length > 0 && selectedRole) {
      const loadedPermissions = selectedRole?.rolePermissions || [];
      
      const mergedPermissions = availableModules.map((module) => {
        const existingPerm = loadedPermissions.find((p) => p.module === module.value);
        return {
          id: existingPerm?.id || 0,
          roleId: selectedRole.id,
          module: module.value as Module,
          canView: existingPerm?.canView || false,
          canAdd: existingPerm?.canAdd || false,
          canEdit: existingPerm?.canEdit || false,
          canDelete: existingPerm?.canDelete || false,
        };
      });
      
      setRolePermissions(mergedPermissions);
    }
  }, [isEditModalOpen, isPermissionModalOpen, availableModules, selectedRole]);

  const createRoleMutation = useMutation({
    mutationFn: (data: CreateRoleRequest) => roleAPI.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsCreateModalOpen(false);
      setRolePermissions([]);
      alert('Role created successfully!');
      // Reset form by clearing permissions state
      setTimeout(() => {
        if (availableModules.length > 0) {
          const initialPermissions = availableModules.map((module) => ({
            id: 0,
            roleId: 0,
            module: module.value as Module,
            canView: false,
            canAdd: false,
            canEdit: false,
            canDelete: false,
          }));
          setRolePermissions(initialPermissions);
        }
      }, 100);
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to create role');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateRoleRequest }) => roleAPI.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsEditModalOpen(false);
      setIsPermissionModalOpen(false);
      setSelectedRole(null);
      setRolePermissions([]);
      alert('Role updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update role');
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: number) => roleAPI.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsDeleteModalOpen(false);
      setSelectedRole(null);
      alert('Role deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete role');
    },
  });

  const handleCreateRole = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const permissions = rolePermissions.map((perm) => ({
      module: perm.module,
      canView: perm.canView,
      canAdd: perm.canAdd,
      canEdit: perm.canEdit,
      canDelete: perm.canDelete,
    }));
    const data: CreateRoleRequest = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      permissions,
    };
    createRoleMutation.mutate(data);
  };

  const handleUpdateRole = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRole) return;
    const formData = new FormData(e.currentTarget);
    const permissions = rolePermissions.map((perm) => ({
      module: perm.module,
      canView: perm.canView,
      canAdd: perm.canAdd,
      canEdit: perm.canEdit,
      canDelete: perm.canDelete,
    }));
    const data: UpdateRoleRequest = {
      name: formData.get('name') as string || undefined,
      description: formData.get('description') as string || undefined,
      isActive: formData.get('isActive') === 'true',
      permissions,
    };
    updateRoleMutation.mutate({ id: selectedRole.id, data });
  };

  const handlePermissionChange = (module: Module, field: 'canView' | 'canAdd' | 'canEdit' | 'canDelete', value: boolean) => {
    setRolePermissions((prev) =>
      prev.map((perm) =>
        perm.module === module ? { ...perm, [field]: value } : perm
      )
    );
  };

  const handleEdit = (role: Role) => {
    setSelectedRole(role);
    setIsEditModalOpen(true);
  };

  const handleManagePermissions = (role: Role) => {
    setSelectedRole(role);
    setIsPermissionModalOpen(true);
  };

  const handleDelete = (role: Role) => {
    setSelectedRole(role);
    setIsDeleteModalOpen(true);
  };

  const handleSavePermissions = () => {
    if (!selectedRole) return;
    const permissions = rolePermissions.map((perm) => ({
      module: perm.module,
      canView: perm.canView,
      canAdd: perm.canAdd,
      canEdit: perm.canEdit,
      canDelete: perm.canDelete,
    }));
    updateRoleMutation.mutate({ id: selectedRole.id, data: { permissions } });
  };

  if (currentUser?.role !== 'superadmin') {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600">Access denied. Only superadmin can manage roles.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        </div>
      </Layout>
    );
  }

  const roles = rolesData?.data.roles || [];

  // Get permissions for a predefined role - only show modules where role has at least one permission
  const getFilteredPermissions = (roleName: string) => {
    const permissions = PREDEFINED_ROLE_PERMISSIONS[roleName] || {};
    // If availableModules is not loaded yet, return empty array
    if (availableModules.length === 0) return [];
    
    return availableModules
      .map((module) => {
        const perm = permissions[module.value];
        if (!perm) return null;
        
        // Only include modules where at least one permission is true
        if (!perm.canView && !perm.canAdd && !perm.canEdit && !perm.canDelete) {
          return null;
        }
        
        return {
          id: 0,
          roleId: 0,
          module: module.value as Module,
          canView: perm.canView,
          canAdd: perm.canAdd,
          canEdit: perm.canEdit,
          canDelete: perm.canDelete,
        };
      })
      .filter((p): p is RolePermission => p !== null);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Role Management</h1>
                <p className="mt-2 text-purple-100">View all roles and their permissions</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
              >
                + Create Custom Role
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Predefined Roles Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Predefined Roles & Permissions</h2>
              
              {availableModules.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading modules...</p>
                </div>
              ) : (
                /* All Roles Display in Table Format */
                <div className="overflow-x-auto border border-gray-300 rounded-md bg-white">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Permissions Count
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {PREDEFINED_ROLES.map((roleName) => {
                        const rolePermissions = getFilteredPermissions(roleName);
                        const activePermissionsCount = rolePermissions.filter(
                          (p) => p.canView || p.canAdd || p.canEdit || p.canDelete
                        ).length;
                        return (
                          <tr key={roleName} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {roleName.charAt(0).toUpperCase() + roleName.slice(1)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                                System
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                                Active
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {activePermissionsCount} / {rolePermissions.length} modules
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const perms = getFilteredPermissions(roleName);
                                    setRolePermissions(perms);
                                    setSelectedPredefinedRole(roleName);
                                    setIsPermissionModalOpen(true);
                                  }}
                                  className="text-purple-600 hover:text-purple-900"
                                  title="View Permissions"
                                >
                                  🔐 Permissions
                                </button>
                                <button
                                  onClick={() => {
                                    const perms = getFilteredPermissions(roleName);
                                    setRolePermissions(perms);
                                    setSelectedPredefinedRole(roleName);
                                    setIsEditModalOpen(true);
                                  }}
                                  className="text-orange-600 hover:text-orange-900"
                                  title="Edit Permissions"
                                >
                                  ✏️ Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Custom Roles Section */}
            <div className="border-t pt-6">
              <h2 className="text-2xl font-bold mb-4">Custom Roles</h2>
              {roles.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">No custom roles found</p>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {roles.map((role) => (
                      <tr key={role.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{role.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">{role.description || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            role.isSystem ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {role.isSystem ? 'System' : 'Custom'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            role.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {role.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(role)}
                              disabled={role.isSystem}
                              className="text-orange-600 hover:text-orange-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Edit Role"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleManagePermissions(role)}
                              className="text-purple-600 hover:text-purple-900"
                              title="Manage Permissions"
                            >
                              🔐 Permissions
                            </button>
                            <button
                              onClick={() => handleDelete(role)}
                              disabled={role.isSystem}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete Role"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Role Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Permissions</h2>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setRolePermissions([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateRole}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                {rolePermissions.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 border border-gray-300 rounded-md">
                    <p>Loading permissions...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-300 rounded-md max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">View</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Add</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Edit</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {rolePermissions.map((perm) => (
                          <tr key={perm.module} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{availableModules.find(m => m.value === perm.module)?.label || perm.module}</td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={perm.canView}
                                onChange={(e) => handlePermissionChange(perm.module, 'canView', e.target.checked)}
                                className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={perm.canAdd}
                                onChange={(e) => handlePermissionChange(perm.module, 'canAdd', e.target.checked)}
                                className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={perm.canEdit}
                                onChange={(e) => handlePermissionChange(perm.module, 'canEdit', e.target.checked)}
                                className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={perm.canDelete}
                                onChange={(e) => handlePermissionChange(perm.module, 'canDelete', e.target.checked)}
                                className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createRoleMutation.isPending || rolePermissions.length === 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createRoleMutation.isPending ? 'Creating...' : 'Create Role'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setRolePermissions([]);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal - Similar structure to create, but with existing data */}
      {isEditModalOpen && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Edit Role</h2>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedRole(null);
                  setRolePermissions([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpdateRole}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={selectedRole.name}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={selectedRole.description || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select
                  name="isActive"
                  defaultValue={selectedRole.isActive ? 'true' : 'false'}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="overflow-x-auto border border-gray-300 rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Module</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">View</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Add</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Edit</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rolePermissions.map((perm) => (
                        <tr key={perm.module}>
                          <td className="px-4 py-2 text-sm">{availableModules.find(m => m.value === perm.module)?.label || perm.module}</td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={perm.canView}
                              onChange={(e) => handlePermissionChange(perm.module, 'canView', e.target.checked)}
                              className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={perm.canAdd}
                              onChange={(e) => handlePermissionChange(perm.module, 'canAdd', e.target.checked)}
                              className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={perm.canEdit}
                              onChange={(e) => handlePermissionChange(perm.module, 'canEdit', e.target.checked)}
                              className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={perm.canDelete}
                              onChange={(e) => handlePermissionChange(perm.module, 'canDelete', e.target.checked)}
                              className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={updateRoleMutation.isPending}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {updateRoleMutation.isPending ? 'Updating...' : 'Update Role'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedRole(null);
                    setRolePermissions([]);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission Management Modal for Predefined Roles (View Only) */}
      {isPermissionModalOpen && selectedPredefinedRole && !selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                View Permissions - {selectedPredefinedRole.charAt(0).toUpperCase() + selectedPredefinedRole.slice(1)}
              </h2>
              <button
                onClick={() => {
                  setIsPermissionModalOpen(false);
                  setSelectedPredefinedRole('');
                  setRolePermissions([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This is a predefined system role. Click "Edit" to modify permissions.
              </p>
            </div>
            <div className="overflow-x-auto border border-gray-300 rounded-md mb-4 max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Module
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      View
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Add
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Edit
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Delete
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rolePermissions.map((perm) => (
                    <tr key={perm.module} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {availableModules.find((m) => m.value === perm.module)?.label || perm.module}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {perm.canView ? (
                          <span className="text-green-600 font-semibold">✓</span>
                        ) : (
                          <span className="text-gray-400">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {perm.canAdd ? (
                          <span className="text-green-600 font-semibold">✓</span>
                        ) : (
                          <span className="text-gray-400">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {perm.canEdit ? (
                          <span className="text-green-600 font-semibold">✓</span>
                        ) : (
                          <span className="text-gray-400">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {perm.canDelete ? (
                          <span className="text-green-600 font-semibold">✓</span>
                        ) : (
                          <span className="text-gray-400">✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsPermissionModalOpen(false);
                  setSelectedPredefinedRole('');
                  setRolePermissions([]);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal for Predefined Roles */}
      {isEditModalOpen && selectedPredefinedRole && !selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                Edit Permissions - {selectedPredefinedRole.charAt(0).toUpperCase() + selectedPredefinedRole.slice(1)}
              </h2>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedPredefinedRole('');
                  setRolePermissions([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Warning:</strong> Modifying predefined role permissions will affect all users with this role. Changes are saved to the system configuration.
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
              <div className="overflow-x-auto border border-gray-300 rounded-md max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Module
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        View
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Add
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Edit
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Delete
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rolePermissions.map((perm) => (
                      <tr key={perm.module} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {availableModules.find((m) => m.value === perm.module)?.label || perm.module}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={perm.canView}
                            onChange={(e) => handlePermissionChange(perm.module, 'canView', e.target.checked)}
                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={perm.canAdd}
                            onChange={(e) => handlePermissionChange(perm.module, 'canAdd', e.target.checked)}
                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={perm.canEdit}
                            onChange={(e) => handlePermissionChange(perm.module, 'canEdit', e.target.checked)}
                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={perm.canDelete}
                            onChange={(e) => handlePermissionChange(perm.module, 'canDelete', e.target.checked)}
                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Note: For predefined roles, we would need a backend endpoint to update them
                  // For now, this is just a UI placeholder - you may want to implement backend support
                  alert('Predefined role permissions update functionality needs to be implemented in the backend.');
                  setIsEditModalOpen(false);
                  setSelectedPredefinedRole('');
                  setRolePermissions([]);
                }}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
              >
                Save Permissions
              </button>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedPredefinedRole('');
                  setRolePermissions([]);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Management Modal - Similar to edit but focused on permissions only */}
      {isPermissionModalOpen && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Manage Permissions - {selectedRole.name}</h2>
              <button
                onClick={() => {
                  setIsPermissionModalOpen(false);
                  setSelectedRole(null);
                  setRolePermissions([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-x-auto border border-gray-300 rounded-md mb-4 max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Module</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">View</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Add</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Edit</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Delete</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rolePermissions.map((perm) => (
                    <tr key={perm.module}>
                      <td className="px-4 py-3 text-sm font-medium">{availableModules.find(m => m.value === perm.module)?.label || perm.module}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.canView}
                          onChange={(e) => handlePermissionChange(perm.module, 'canView', e.target.checked)}
                          className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.canAdd}
                          onChange={(e) => handlePermissionChange(perm.module, 'canAdd', e.target.checked)}
                          className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.canEdit}
                          onChange={(e) => handlePermissionChange(perm.module, 'canEdit', e.target.checked)}
                          className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.canDelete}
                          onChange={(e) => handlePermissionChange(perm.module, 'canDelete', e.target.checked)}
                          className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSavePermissions}
                disabled={updateRoleMutation.isPending}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {updateRoleMutation.isPending ? 'Saving...' : 'Save Permissions'}
              </button>
              <button
                onClick={() => {
                  setIsPermissionModalOpen(false);
                  setSelectedRole(null);
                  setRolePermissions([]);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Role</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete <strong>{selectedRole.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (selectedRole) {
                    deleteRoleMutation.mutate(selectedRole.id);
                  }
                }}
                disabled={deleteRoleMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteRoleMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedRole(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

