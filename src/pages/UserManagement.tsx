import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { userAPI, User, UpdateUserRequest, CreateUserRequest } from '../api/user.api';
import { permissionAPI, Permission, Module, UpdatePermissionRequest } from '../api/permission.api';
import { roleAPI, Role } from '../api/role.api';
import { parseRoleFromForm } from '../types/user.types';

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [isRoleAssignmentModalOpen, setIsRoleAssignmentModalOpen] = useState(false);
  const [isRoleManagementModalOpen, setIsRoleManagementModalOpen] = useState(false);
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [isDeleteRoleModalOpen, setIsDeleteRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [availableModules, setAvailableModules] = useState<Array<{ value: string; label: string }>>([]);
  const [userRoles, setUserRoles] = useState<Role[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Array<{
    module: Module;
    canView: boolean;
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>>([]);

  // Fetch users
  const { data: usersData, isLoading, error: usersError } = useQuery({
    queryKey: ['users'],
    queryFn: () => userAPI.getAllUsers(),
    retry: 1,
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserRequest }) => userAPI.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsEditModalOpen(false);
      setSelectedUser(null);
      alert('User updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update user');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => userAPI.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      alert('User deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete user');
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: CreateUserRequest) => userAPI.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateModalOpen(false);
      alert('User created successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to create user');
    },
  });

  // Fetch user permissions when permission modal opens
  const { data: permissionsData } = useQuery({
    queryKey: ['user-permissions', selectedUser?.id],
    queryFn: () => permissionAPI.getUserPermissions(selectedUser!.id),
    enabled: !!selectedUser && isPermissionModalOpen,
  });

  // Fetch available modules
  const { data: modulesData } = useQuery({
    queryKey: ['modules'],
    queryFn: () => permissionAPI.getModules(),
    enabled: isPermissionModalOpen && currentUser?.role === 'superadmin',
  });

  // Fetch user roles
  const { data: userRolesData } = useQuery({
    queryKey: ['user-roles', selectedUser?.id],
    queryFn: () => roleAPI.getUserRoles(selectedUser!.id),
    enabled: !!selectedUser && isRoleAssignmentModalOpen,
  });

  // Fetch all available roles
  const { data: allRolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleAPI.getAllRoles(),
    enabled: (isRoleAssignmentModalOpen || isRoleManagementModalOpen) && (currentUser?.role === 'admin' || currentUser?.role === 'superadmin'),
  });

  // Fetch all roles for role management and user forms
  const { data: rolesData } = useQuery({
    queryKey: ['all-roles'],
    queryFn: () => roleAPI.getAllRoles(),
    enabled: (isRoleManagementModalOpen || isCreateModalOpen || isEditModalOpen) && (currentUser?.role === 'admin' || currentUser?.role === 'superadmin'),
  });

  // Fetch role details when editing
  const { data: roleDetailsData } = useQuery({
    queryKey: ['role', selectedRole?.id],
    queryFn: () => roleAPI.getRole(selectedRole!.id),
    enabled: !!selectedRole && isEditRoleModalOpen,
  });

  useEffect(() => {
    if (userRolesData?.data.roles) {
      setUserRoles(userRolesData.data.roles);
    }
  }, [userRolesData]);

  useEffect(() => {
    if (allRolesData?.data.roles) {
      setAvailableRoles(allRolesData.data.roles.filter(role => role.isActive));
    }
  }, [allRolesData]);

  useEffect(() => {
    if (rolesData?.data.roles) {
      setAllRoles(rolesData.data.roles);
    }
  }, [rolesData]);

  useEffect(() => {
    if (roleDetailsData?.data.role && isEditRoleModalOpen) {
      const role = roleDetailsData.data.role;
      setSelectedRole(role);
      // Initialize permissions from role's permissions
      if (role.rolePermissions && availableModules.length > 0) {
        const perms = availableModules.map((module) => {
          const existingPerm = role.rolePermissions?.find((p: any) => p.module === module.value);
          return {
            module: module.value as Module,
            canView: existingPerm?.canView || false,
            canAdd: existingPerm?.canAdd || false,
            canEdit: existingPerm?.canEdit || false,
            canDelete: existingPerm?.canDelete || false,
          };
        });
        setRolePermissions(perms);
      }
    }
  }, [roleDetailsData, isEditRoleModalOpen, availableModules]);

  useEffect(() => {
    if (modulesData?.data.modules) {
      setAvailableModules(modulesData.data.modules);
    }
  }, [modulesData]);

  // Merge permissions with available modules when both are loaded
  useEffect(() => {
    if (isPermissionModalOpen && availableModules.length > 0 && selectedUser) {
      const loadedPermissions = permissionsData?.data.permissions || [];
      
      // Create permissions for all modules, using loaded data where available
      const mergedPermissions = availableModules.map((module) => {
        const existingPerm = loadedPermissions.find((p) => p.module === module.value);
        return {
          id: existingPerm?.id || 0,
          userId: selectedUser.id,
          module: module.value as Module,
          canView: existingPerm?.canView || false,
          canAdd: existingPerm?.canAdd || false,
          canEdit: existingPerm?.canEdit || false,
          canDelete: existingPerm?.canDelete || false,
        };
      });
      
      setUserPermissions(mergedPermissions);
    }
  }, [isPermissionModalOpen, availableModules, permissionsData, selectedUser]);

  const updatePermissionsMutation = useMutation({
    mutationFn: ({ userId, permissions }: { userId: number; permissions: UpdatePermissionRequest[] }) =>
      permissionAPI.updateUserPermissions(userId, { permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', selectedUser?.id] });
      alert('Permissions updated successfully!');
      setIsPermissionModalOpen(false);
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update permissions');
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) =>
      roleAPI.assignRoleToUser(userId, { roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles', selectedUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      alert('Role assigned successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to assign role');
    },
  });

  const unassignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) =>
      roleAPI.unassignRoleFromUser(userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles', selectedUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      alert('Role unassigned successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to unassign role');
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: (data: any) => roleAPI.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['all-roles'] });
      setIsCreateRoleModalOpen(false);
      setRolePermissions([]);
      alert('Role created successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to create role');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => roleAPI.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['all-roles'] });
      queryClient.invalidateQueries({ queryKey: ['role', selectedRole?.id] });
      setIsEditRoleModalOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ['all-roles'] });
      setIsDeleteRoleModalOpen(false);
      setSelectedRole(null);
      alert('Role deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete role');
    },
  });

  const users = usersData?.data.users || [];

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleView = (user: User) => {
    setSelectedUser(user);
    setIsViewModalOpen(true);
  };

  const handleUpdateUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUser) return;

    const formData = new FormData(e.currentTarget);
    const data: UpdateUserRequest = {
      name: formData.get('name') as string || undefined,
      email: formData.get('email') as string || undefined,
      phone: formData.get('phone') as string || undefined,
      role: parseRoleFromForm(formData.get('role') as string),
      isActive: formData.get('isActive') === 'true',
    };
    updateUserMutation.mutate({ id: selectedUser.id, data });
  };

  const handleConfirmDelete = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  const handleCreateUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const roleValue = parseRoleFromForm(formData.get('role') as string);
    if (!roleValue) {
      alert('Please select a valid role');
      return;
    }
    const data: CreateUserRequest = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string || undefined,
      role: roleValue,
      password: formData.get('password') as string,
    };
    createUserMutation.mutate(data);
  };

  const handleManagePermissions = (user: User) => {
    setSelectedUser(user);
    setIsPermissionModalOpen(true);
  };

  const handleAssignRole = (user: User) => {
    setSelectedUser(user);
    setIsRoleAssignmentModalOpen(true);
  };

  const handleAssignRoleToUser = (roleId: number) => {
    if (!selectedUser) return;
    assignRoleMutation.mutate({ userId: selectedUser.id, roleId });
  };

  const handleUnassignRole = (roleId: number) => {
    if (!selectedUser) return;
    if (window.confirm('Are you sure you want to unassign this role?')) {
      unassignRoleMutation.mutate({ userId: selectedUser.id, roleId });
    }
  };

  const handlePermissionChange = (module: Module, field: 'canView' | 'canAdd' | 'canEdit' | 'canDelete', value: boolean) => {
    setUserPermissions((prev) =>
      prev.map((perm) =>
        perm.module === module ? { ...perm, [field]: value } : perm
      )
    );
  };

  const handleSavePermissions = () => {
    if (!selectedUser) return;
    const permissions: UpdatePermissionRequest[] = userPermissions.map((perm) => ({
      module: perm.module,
      canView: perm.canView,
      canAdd: perm.canAdd,
      canEdit: perm.canEdit,
      canDelete: perm.canDelete,
    }));
    updatePermissionsMutation.mutate({ userId: selectedUser.id, permissions });
  };

  const handleCreateRole = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      permissions: rolePermissions,
    };
    createRoleMutation.mutate(data);
  };

  const handleUpdateRole = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRole) return;
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      isActive: formData.get('isActive') === 'true',
      permissions: rolePermissions,
    };
    updateRoleMutation.mutate({ id: selectedRole.id, data });
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setIsEditRoleModalOpen(true);
  };

  const handleDeleteRole = (role: Role) => {
    setSelectedRole(role);
    setIsDeleteRoleModalOpen(true);
  };

  const handleConfirmDeleteRole = () => {
    if (selectedRole) {
      deleteRoleMutation.mutate(selectedRole.id);
    }
  };

  const handleRolePermissionChange = (module: Module, field: 'canView' | 'canAdd' | 'canEdit' | 'canDelete', value: boolean) => {
    setRolePermissions((prev) =>
      prev.map((perm) =>
        perm.module === module ? { ...perm, [field]: value } : perm
      )
    );
  };

  // Initialize role permissions when creating new role
  useEffect(() => {
    if (isCreateRoleModalOpen && availableModules.length > 0 && rolePermissions.length === 0) {
      const perms = availableModules.map((module) => ({
        module: module.value as Module,
        canView: false,
        canAdd: false,
        canEdit: false,
        canDelete: false,
      }));
      setRolePermissions(perms);
    }
  }, [isCreateRoleModalOpen, availableModules]);

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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">User Management</h1>
                <p className="mt-2 text-orange-100">Manage all users in the system</p>
              </div>
              {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                  >
                    + Create User
                  </button>
                  {currentUser?.role === 'superadmin' && (
                    <button
                      onClick={() => setIsRoleManagementModalOpen(true)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                    >
                      🎭 Manage Roles
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : usersError ? (
              <div className="text-center py-12">
                <p className="text-red-600 text-lg mb-4">Error loading users</p>
                <p className="text-gray-500 text-sm mb-4">
                  {(usersError as any)?.response?.data?.message || (usersError as any)?.message || 'Unknown error'}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Retry
                </button>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{user.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            user.role === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                            user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                            user.role === 'faculty' ? 'bg-green-100 text-green-800' :
                            user.role === 'student' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex flex-wrap gap-2 items-center">
                            <button
                              onClick={() => handleView(user)}
                              className="px-2 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                              title="View Profile"
                            >
                              👁️ View
                            </button>
                            {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                              <>
                                <button
                                  onClick={() => handleEdit(user)}
                                  className="px-2 py-1 text-orange-600 hover:text-orange-900 hover:bg-orange-50 rounded transition-colors"
                                  title="Edit User"
                                >
                                  ✏️ Edit
                                </button>
                                {currentUser?.role === 'superadmin' && (
                                  <>
                                    <button
                                      onClick={() => handleManagePermissions(user)}
                                      className="px-2 py-1 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded transition-colors"
                                      title="Manage Permissions"
                                    >
                                      🔐 Permissions
                                    </button>
                                    <button
                                      onClick={() => handleAssignRole(user)}
                                      className="px-2 py-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded transition-colors"
                                      title="Assign Role"
                                    >
                                      👤 Roles
                                    </button>
                                    {user.id !== currentUser.id && (
                                      <button
                                        onClick={() => handleDelete(user)}
                                        className="px-2 py-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                                        title="Delete User"
                                      >
                                        🗑️ Delete
                                      </button>
                                    )}
                                  </>
                                )}
                              </>
                            )}
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

      {/* View Profile Modal */}
      {isViewModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">User Profile</h2>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedUser(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedUser.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedUser.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <p className="mt-1 text-sm text-gray-900">{selectedUser.phone || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <p className="mt-1 text-sm text-gray-900">{selectedUser.role}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <p className="mt-1 text-sm text-gray-900">{selectedUser.isActive ? 'Active' : 'Inactive'}</p>
              </div>
              {selectedUser.createdAt && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Created At</label>
                  <p className="mt-1 text-sm text-gray-900">{new Date(selectedUser.createdAt).toLocaleString()}</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Edit User</h2>
            <form onSubmit={handleUpdateUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={selectedUser.name}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={selectedUser.email}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={selectedUser.phone || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  name="role"
                  defaultValue={selectedUser.role}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  {currentUser?.role === 'superadmin' && <option value="superadmin">Superadmin</option>}
                  {allRoles.filter(r => r.isActive && !r.isSystem).map((role) => (
                    <option key={role.id} value={role.name.toLowerCase()}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select
                  name="isActive"
                  defaultValue={selectedUser.isActive ? 'true' : 'false'}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {updateUserMutation.isPending ? 'Updating...' : 'Update'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedUser(null);
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

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete User</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete <strong>{selectedUser.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmDelete}
                disabled={deleteUserMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedUser(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Create New User</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  name="role"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  {currentUser?.role === 'superadmin' && <option value="superadmin">Superadmin</option>}
                  {allRoles.filter(r => r.isActive && !r.isSystem).map((role) => (
                    <option key={role.id} value={role.name.toLowerCase()}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission Management Modal */}
      {isPermissionModalOpen && selectedUser && currentUser?.role === 'superadmin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Manage Permissions - {selectedUser.name}</h2>
              <button
                onClick={() => {
                  setIsPermissionModalOpen(false);
                  setSelectedUser(null);
                  setUserPermissions([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Customize permissions for <strong>{selectedUser.name}</strong> ({selectedUser.role})
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">View</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Add</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Edit</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Delete</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {availableModules.map((module) => {
                    const permission = userPermissions.find((p) => p.module === module.value);
                    if (!permission) return null;
                    return (
                      <tr key={module.value} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{module.label}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <input
                            type="checkbox"
                            checked={permission.canView}
                            onChange={(e) => handlePermissionChange(permission.module, 'canView', e.target.checked)}
                            className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <input
                            type="checkbox"
                            checked={permission.canAdd}
                            onChange={(e) => handlePermissionChange(permission.module, 'canAdd', e.target.checked)}
                            className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <input
                            type="checkbox"
                            checked={permission.canEdit}
                            onChange={(e) => handlePermissionChange(permission.module, 'canEdit', e.target.checked)}
                            className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <input
                            type="checkbox"
                            checked={permission.canDelete}
                            onChange={(e) => handlePermissionChange(permission.module, 'canDelete', e.target.checked)}
                            className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSavePermissions}
                disabled={updatePermissionsMutation.isPending}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {updatePermissionsMutation.isPending ? 'Saving...' : 'Save Permissions'}
              </button>
              <button
                onClick={() => {
                  setIsPermissionModalOpen(false);
                  setSelectedUser(null);
                  setUserPermissions([]);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Assignment Modal */}
      {isRoleAssignmentModalOpen && selectedUser && (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Assign Roles - {selectedUser.name}</h2>
              <button
                onClick={() => {
                  setIsRoleAssignmentModalOpen(false);
                  setSelectedUser(null);
                  setUserRoles([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Assigned Roles</h3>
              {userRoles.length === 0 ? (
                <p className="text-gray-500 text-sm">No roles assigned</p>
              ) : (
                <div className="space-y-2">
                  {userRoles.map((role) => (
                    <div key={role.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium">{role.name}</span>
                        {role.description && (
                          <p className="text-sm text-gray-500">{role.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleUnassignRole(role.id)}
                        disabled={unassignRoleMutation.isPending}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Available Roles</h3>
              {availableRoles.filter(role => !userRoles.find(ur => ur.id === role.id)).length === 0 ? (
                <p className="text-gray-500 text-sm">All available roles are assigned</p>
              ) : (
                <div className="space-y-2">
                  {availableRoles
                    .filter(role => !userRoles.find(ur => ur.id === role.id))
                    .map((role) => (
                      <div key={role.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div>
                          <span className="font-medium">{role.name}</span>
                          {role.description && (
                            <p className="text-sm text-gray-500">{role.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleAssignRoleToUser(role.id)}
                          disabled={assignRoleMutation.isPending}
                          className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Assign
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setIsRoleAssignmentModalOpen(false);
                  setSelectedUser(null);
                  setUserRoles([]);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Management Modal */}
      {isRoleManagementModalOpen && currentUser?.role === 'superadmin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Custom Role Management</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsCreateRoleModalOpen(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  + Create Role
                </button>
                <button
                  onClick={() => {
                    setIsRoleManagementModalOpen(false);
                    setAllRoles([]);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allRoles.map((role) => (
                    <tr key={role.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{role.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-500">{role.description || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          role.isSystem ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {role.isSystem ? 'System' : 'Custom'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          role.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {role.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                        {!role.isSystem && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditRole(role)}
                              className="text-orange-600 hover:text-orange-900"
                              title="Edit Role"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRole(role)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Role"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {isCreateRoleModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Create Custom Role</h2>
              <button
                onClick={() => {
                  setIsCreateRoleModalOpen(false);
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Permissions</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">View</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Add</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Edit</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {availableModules.map((module) => {
                        const permission = rolePermissions.find((p) => p.module === module.value);
                        if (!permission) return null;
                        return (
                          <tr key={module.value} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{module.label}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <input
                                type="checkbox"
                                checked={permission.canView}
                                onChange={(e) => handleRolePermissionChange(permission.module, 'canView', e.target.checked)}
                                className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <input
                                type="checkbox"
                                checked={permission.canAdd}
                                onChange={(e) => handleRolePermissionChange(permission.module, 'canAdd', e.target.checked)}
                                className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <input
                                type="checkbox"
                                checked={permission.canEdit}
                                onChange={(e) => handleRolePermissionChange(permission.module, 'canEdit', e.target.checked)}
                                className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <input
                                type="checkbox"
                                checked={permission.canDelete}
                                onChange={(e) => handleRolePermissionChange(permission.module, 'canDelete', e.target.checked)}
                                className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createRoleMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {createRoleMutation.isPending ? 'Creating...' : 'Create Role'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateRoleModalOpen(false);
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

      {/* Edit Role Modal */}
      {isEditRoleModalOpen && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Edit Role</h2>
              <button
                onClick={() => {
                  setIsEditRoleModalOpen(false);
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={selectedRole.description || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select
                  name="isActive"
                  defaultValue={selectedRole.isActive ? 'true' : 'false'}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Permissions</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">View</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Add</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Edit</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {availableModules.map((module) => {
                        const permission = rolePermissions.find((p) => p.module === module.value);
                        if (!permission) return null;
                        return (
                          <tr key={module.value} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{module.label}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <input
                                type="checkbox"
                                checked={permission.canView}
                                onChange={(e) => handleRolePermissionChange(permission.module, 'canView', e.target.checked)}
                                className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <input
                                type="checkbox"
                                checked={permission.canAdd}
                                onChange={(e) => handleRolePermissionChange(permission.module, 'canAdd', e.target.checked)}
                                className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <input
                                type="checkbox"
                                checked={permission.canEdit}
                                onChange={(e) => handleRolePermissionChange(permission.module, 'canEdit', e.target.checked)}
                                className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <input
                                type="checkbox"
                                checked={permission.canDelete}
                                onChange={(e) => handleRolePermissionChange(permission.module, 'canDelete', e.target.checked)}
                                className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={updateRoleMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {updateRoleMutation.isPending ? 'Updating...' : 'Update Role'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditRoleModalOpen(false);
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

      {/* Delete Role Confirmation Modal */}
      {isDeleteRoleModalOpen && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Role</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete the role <strong>{selectedRole.name}</strong>? This action cannot be undone.
            </p>
            <p className="mb-4 text-sm text-yellow-600">
              Note: You cannot delete a role if it is assigned to any users. Please unassign it first.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmDeleteRole}
                disabled={deleteRoleMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteRoleMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setIsDeleteRoleModalOpen(false);
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
