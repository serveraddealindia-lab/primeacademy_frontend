import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { employeeAPI, Employee } from '../api/employee.api';
import { userAPI } from '../api/user.api';
import { uploadAPI } from '../api/upload.api';
import { getImageUrl } from '../utils/imageUtils';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

export const EmployeeManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch employees
  const { data: employeesData, isLoading, error: employeesError } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeAPI.getAllEmployees(),
    retry: 1,
  });

  // Fetch full employee data with profile for view modal
  const { data: employeeProfileData, isLoading: isLoadingProfile, error: profileError, refetch: refetchEmployeeProfile } = useQuery({
    queryKey: ['employee-profile', selectedEmployee?.id],
    queryFn: async () => {
      if (!selectedEmployee?.id) return null;
      
      // Always fetch fresh data from backend to ensure we get complete profile
      try {
        // First, try to get the full user data with profile included
        const userResponse = await userAPI.getUser(selectedEmployee.id);
        console.log('User response:', userResponse);
        if (userResponse?.data?.user) {
          const user = userResponse.data.user;
          let profile = user.employeeProfile || null;
          
          // If profile exists but might be incomplete, try to fetch it separately
          if (!profile || !profile.documents) {
            try {
              const profileResponse = await employeeAPI.getEmployeeProfile(selectedEmployee.id);
              if (profileResponse?.data?.employeeProfile) {
                profile = profileResponse.data.employeeProfile;
                // Merge profile data with user data
                user.employeeProfile = profile;
              }
            } catch (profileErr: any) {
              console.warn('Profile fetch failed, using profile from user response:', profileErr?.message);
            }
          }
          
          console.log('Employee profile from user response:', profile);
          return {
            user: user,
            profile: profile,
          };
        }
      } catch (userErr: any) {
        console.warn('Failed to fetch user with profile, trying profile endpoint:', userErr?.message);
      }
      
      // Fallback: Try to fetch profile separately and combine with user data
      try {
        // Fetch user data first
        const userResponse = await userAPI.getUser(selectedEmployee.id);
        const profileResponse = await employeeAPI.getEmployeeProfile(selectedEmployee.id);
        console.log('Profile response:', profileResponse);
        if (profileResponse?.data?.employeeProfile && userResponse?.data?.user) {
          return {
            user: userResponse.data.user,
            profile: profileResponse.data.employeeProfile,
          };
        }
      } catch (profileErr: any) {
        console.warn('Profile fetch also failed:', profileErr?.message);
      }
      
      // Last resort: Use the data we already have, but try to refresh it
      console.log('Using selectedEmployee data as fallback:', selectedEmployee);
      return {
        user: selectedEmployee,
        profile: selectedEmployee.employeeProfile || null,
      };
    },
    enabled: !!selectedEmployee?.id && isViewModalOpen,
    retry: 2, // Retry more times to ensure we get data
    staleTime: 0, // Always fetch fresh data when modal opens
    gcTime: 0, // Don't cache, always get fresh data (gcTime replaces deprecated cacheTime)
  });

  // Refresh employee profile when view modal opens or when component mounts (after returning from edit)
  React.useEffect(() => {
    if (isViewModalOpen && selectedEmployee) {
      // Invalidate and refetch the employee profile data
      queryClient.invalidateQueries({ queryKey: ['employee-profile', selectedEmployee.id] });
      queryClient.invalidateQueries({ queryKey: ['employee', selectedEmployee.id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      // Refetch the profile data
      refetchEmployeeProfile();
    }
  }, [isViewModalOpen, selectedEmployee, queryClient, refetchEmployeeProfile]);

  // Also refresh when component mounts (useful when returning from edit page)
  React.useEffect(() => {
    // Invalidate queries on mount to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  }, [queryClient]);

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => userAPI.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsDeleteModalOpen(false);
      setSelectedEmployee(null);
      alert('Employee deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete employee');
    },
  });

  const updateUserImageMutation = useMutation({
    mutationFn: ({ userId, avatarUrl }: { userId: number; avatarUrl: string }) =>
      userAPI.updateUser(userId, { avatarUrl }),
    onSuccess: (_, variables) => {
      // Invalidate and refetch employees list
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employee-profile', selectedEmployee?.id] });
      
      // Update the selected employee's avatarUrl immediately
      if (selectedEmployee) {
        const updatedEmployee = { ...selectedEmployee, avatarUrl: variables.avatarUrl };
        setSelectedEmployee(updatedEmployee);
        
        // Update preview with cache-busted URL to force reload
        const fullImageUrl = getImageUrl(variables.avatarUrl) || variables.avatarUrl;
        const cacheBustedUrl = fullImageUrl + (fullImageUrl.includes('?') ? '&' : '?') + `t=${Date.now()}`;
        setImagePreview(cacheBustedUrl);
      }
      
      setUploadingImage(false);
      alert('Image updated successfully!');
      
      // Don't close modal immediately - let user see the updated image
      // Close after a short delay
      setTimeout(() => {
        setIsImageModalOpen(false);
        setSelectedEmployee(null);
        setImagePreview(null);
      }, 1000);
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update image');
      setUploadingImage(false);
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEmployee) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Show immediate preview using FileReader
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setUploadingImage(true);
    try {
      const uploadResponse = await uploadAPI.uploadFile(file);
      console.log('Upload response:', uploadResponse);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const relativeUrl = uploadResponse.data.files[0].url;
        console.log('Uploaded image URL (relative):', relativeUrl);
        
        // Get full URL for preview display with cache-busting
        const fullImageUrl = getImageUrl(relativeUrl) || relativeUrl;
        const cacheBustedUrl = fullImageUrl + (fullImageUrl.includes('?') ? '&' : '?') + `t=${Date.now()}`;
        console.log('Full image URL for preview (with cache-busting):', cacheBustedUrl);
        
        // Update preview with the full URL for display
        setImagePreview(cacheBustedUrl);
        
        // Update user with relative URL (backend will serve it)
        updateUserImageMutation.mutate({
          userId: selectedEmployee.id,
          avatarUrl: relativeUrl,
        });
      } else {
        throw new Error('No files returned from upload');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.response?.data?.message || error.message || 'Failed to upload image');
      setUploadingImage(false);
      setImagePreview(null);
    }
  };

  const allEmployees = employeesData?.data.users || [];
  
  // Filter employees based on search query
  const employees = allEmployees.filter((employee) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      employee.name?.toLowerCase().includes(query) ||
      employee.email?.toLowerCase().includes(query) ||
      employee.phone?.toLowerCase().includes(query) ||
      employee.employeeProfile?.department?.toLowerCase().includes(query) ||
      employee.employeeProfile?.designation?.toLowerCase().includes(query)
    );
  });

  const handleDelete = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedEmployee) {
      deleteUserMutation.mutate(selectedEmployee.id);
    }
  };

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

  if (employeesError) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <div className="text-center py-12">
              <p className="text-red-600 text-lg mb-4">Error loading employee data</p>
              <p className="text-gray-500 text-sm">
                {(employeesError as any)?.response?.data?.message || (employeesError as any)?.message || 'Unknown error'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden overflow-x-auto">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 md:px-8 py-4 md:py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Employee Management</h1>
                <p className="mt-2 text-sm md:text-base text-orange-100">Manage employees</p>
              </div>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <button
                  onClick={() => window.location.href = '/employees/register'}
                  className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors text-sm md:text-base whitespace-nowrap"
                >
                  + New Employee Registration
                </button>
              )}
            </div>
          </div>

          <div className="p-4 md:p-6">
            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search employees by name, email, phone, department, or designation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="mt-2 text-sm text-gray-600">
                  Showing {employees.length} of {allEmployees.length} employees
                </p>
              )}
            </div>

            {employees.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  {searchQuery ? 'No employees found matching your search' : 'No employees found'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-orange-600 hover:text-orange-700 text-sm"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.No</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      {(user?.role === 'admin' || user?.role === 'superadmin') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employees.map((employee, index) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{index + 1}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {employee.avatarUrl ? (
                              <img
                                src={(getImageUrl(employee.avatarUrl) || employee.avatarUrl) + (employee.avatarUrl.includes('?') ? '&' : '?') + `t=${Date.now()}`}
                                alt={employee.name}
                                className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                                crossOrigin="anonymous"
                                key={`employee-${employee.id}-${employee.avatarUrl}`}
                                onError={(e) => {
                                  console.error('Employee photo failed to load:', employee.avatarUrl);
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2ZmOTUwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj57e2VtcGxveWVlLm5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                                }}
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-lg">
                                {employee.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{employee.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{employee.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{employee.employeeProfile?.department || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{employee.employeeProfile?.designation || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            employee.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {employee.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {(user?.role === 'admin' || user?.role === 'superadmin') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => {
                                  setSelectedEmployee(employee);
                                  setIsViewModalOpen(true);
                                }}
                                className="text-blue-600 hover:text-blue-900 text-xs"
                                title="View Employee"
                              >
                                👁️ View
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedEmployee(employee);
                                  setImagePreview(employee.avatarUrl || null);
                                  setIsImageModalOpen(true);
                                }}
                                className="text-orange-600 hover:text-orange-900 text-xs"
                                title="Update Photo"
                              >
                                📷 Photo
                              </button>
                              <button
                                onClick={() => navigate(`/employees/${employee.id}/edit`)}
                                className="text-orange-600 hover:text-orange-900 text-xs"
                                title="Edit Employee"
                              >
                                ✏️ Edit
                              </button>
                              {user?.role === 'superadmin' && (
                                <button
                                  onClick={() => handleDelete(employee)}
                                  className="text-red-600 hover:text-red-900 text-xs"
                                  title="Delete Employee"
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Employee</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete <strong>{selectedEmployee.name}</strong>? This action cannot be undone.
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
                  setSelectedEmployee(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {isImageModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Update Employee Photo</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Employee:</strong> {selectedEmployee.name}
              </p>
              <div className="flex justify-center mb-4">
                {imagePreview ? (
                  <img
                    src={imagePreview.startsWith('data:') ? imagePreview : ((getImageUrl(imagePreview) || imagePreview) + (imagePreview.includes('?') ? '&' : '?') + `t=${Date.now()}`)}
                    alt="Preview"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    key={`preview-${imagePreview}-${Date.now()}`}
                    crossOrigin="anonymous"
                    onError={(e) => {
                      console.error('Image preview failed to load:', imagePreview);
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c2VsZWN0ZWRFbXBsb3llZS5uYW1lLmNoYXJBdCgwKX19PC90ZXh0Pjwvc3ZnPg==';
                    }}
                  />
                ) : selectedEmployee?.avatarUrl ? (
                  <img
                    src={(getImageUrl(selectedEmployee.avatarUrl) || selectedEmployee.avatarUrl) + (selectedEmployee.avatarUrl.includes('?') ? '&' : '?') + `t=${Date.now()}`}
                    alt="Current"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    crossOrigin="anonymous"
                    key={`current-${selectedEmployee.avatarUrl}-${Date.now()}`}
                    onError={(e) => {
                      console.error('Current employee photo failed to load:', selectedEmployee.avatarUrl);
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c2VsZWN0ZWRFbXBsb3llZS5uYW1lLmNoYXJBdCgwKX19PC90ZXh0Pjwvc3ZnPg==';
                    }}
                  />
                ) : (
                  <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Image (JPG, PNG - Max 5MB)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsImageModalOpen(false);
                  setSelectedEmployee(null);
                  setImagePreview(null);
                }}
                disabled={uploadingImage}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                {uploadingImage ? 'Uploading...' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Employee Modal */}
      {isViewModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-2xl font-bold text-gray-900">Employee Details</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => refetchEmployeeProfile()}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  title="Refresh Employee Data"
                >
                  🔄 Refresh
                </button>
                <button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    setSelectedEmployee(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              {isLoadingProfile ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading employee details...</p>
                </div>
              ) : profileError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 font-semibold mb-2">Failed to load employee details</p>
                  <p className="text-sm text-gray-600 mb-4">
                    {(profileError as any)?.response?.data?.message || (profileError as any)?.message || 'An error occurred while fetching employee details'}
                  </p>
                  <button
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['employee-profile', selectedEmployee?.id] });
                    }}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    Retry
                  </button>
                </div>
              ) : employeeProfileData ? (
                (() => {
                  // Parse documents field to extract nested data
                  const documents = employeeProfileData.profile?.documents;
                  let parsedDocuments: any = null;
                  
                  if (documents) {
                    if (typeof documents === 'string') {
                      try {
                        parsedDocuments = JSON.parse(documents);
                      } catch (e) {
                        console.error('Error parsing documents string:', e);
                      }
                    } else if (typeof documents === 'object' && documents !== null) {
                      parsedDocuments = documents;
                    }
                  }
                  
                  // Extract nested data from parsed documents
                  const personalInfo = parsedDocuments?.personalInfo || {};
                  const employmentInfo = parsedDocuments?.employmentInfo || {};
                  const bankInfo = parsedDocuments?.bankInfo || {};
                  
                  return (
                    <div className="space-y-6">
                      {/* Basic Information */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Photo</label>
                            <div className="mt-2">
                              {employeeProfileData.user.avatarUrl ? (
                                <img
                                  src={getImageUrl(employeeProfileData.user.avatarUrl) || ''}
                                  alt={employeeProfileData.user.name}
                                  className="h-24 w-24 rounded-full object-cover border-2 border-gray-200"
                                  crossOrigin="anonymous"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2ZmOTUwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzYiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj57e2VtcGxveWVlUHJvZmlsZURhdGEudXNlci5uYW1lLmNoYXJBdCgwKX19PC90ZXh0Pjwvc3ZnPg==';
                                  }}
                                />
                              ) : (
                                <div className="h-24 w-24 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-2xl">
                                  {employeeProfileData.user.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <p className="mt-1 text-sm text-gray-900">{employeeProfileData.user.name}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <p className="mt-1 text-sm text-gray-900">{employeeProfileData.user.email}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Phone</label>
                            <p className="mt-1 text-sm text-gray-900">{employeeProfileData.user.phone || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                            <p className="mt-1 text-sm text-gray-900">{employeeProfileData.profile?.employeeId || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Department</label>
                            <p className="mt-1 text-sm text-gray-900">{employmentInfo?.department || employeeProfileData.profile?.department || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Designation</label>
                            <p className="mt-1 text-sm text-gray-900">{employmentInfo?.designation || employeeProfileData.profile?.designation || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Status</label>
                            <p className="mt-1">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                employeeProfileData.user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {employeeProfileData.user.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Personal Information */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Gender</label>
                            <p className="mt-1 text-sm text-gray-900">{personalInfo?.gender || employeeProfileData.profile?.gender || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                            <p className="mt-1 text-sm text-gray-900">
                              {personalInfo?.dateOfBirth 
                                ? formatDateDDMMYYYY(personalInfo.dateOfBirth) 
                                : (employeeProfileData.profile?.dateOfBirth ? formatDateDDMMYYYY(employeeProfileData.profile.dateOfBirth) : '-')}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Nationality</label>
                            <p className="mt-1 text-sm text-gray-900">{personalInfo?.nationality || employeeProfileData.profile?.nationality || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Marital Status</label>
                            <p className="mt-1 text-sm text-gray-900">{personalInfo?.maritalStatus || employeeProfileData.profile?.maritalStatus || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Employment Information */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Employment Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Date of Joining</label>
                            <p className="mt-1 text-sm text-gray-900">
                              {employmentInfo?.dateOfJoining 
                                ? formatDateDDMMYYYY(employmentInfo.dateOfJoining) 
                                : (employeeProfileData.profile?.dateOfJoining ? formatDateDDMMYYYY(employeeProfileData.profile.dateOfJoining) : '-')}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Employment Type</label>
                            <p className="mt-1 text-sm text-gray-900">{employmentInfo?.employmentType || employeeProfileData.profile?.employmentType || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Reporting Manager</label>
                            <p className="mt-1 text-sm text-gray-900">{employmentInfo?.reportingManager || employeeProfileData.profile?.reportingManager || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Work Location</label>
                            <p className="mt-1 text-sm text-gray-900">{employmentInfo?.workLocation || employeeProfileData.profile?.workLocation || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Bank Information */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Bank Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Bank Name</label>
                            <p className="mt-1 text-sm text-gray-900">{bankInfo?.bankName || employeeProfileData.profile?.bankName || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Account Number</label>
                            <p className="mt-1 text-sm text-gray-900">{bankInfo?.accountNumber || employeeProfileData.profile?.accountNumber || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">IFSC Code</label>
                            <p className="mt-1 text-sm text-gray-900">{bankInfo?.ifscCode || employeeProfileData.profile?.ifscCode || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Branch</label>
                            <p className="mt-1 text-sm text-gray-900">{bankInfo?.branch || employeeProfileData.profile?.branch || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">PAN Number</label>
                            <p className="mt-1 text-sm text-gray-900">{bankInfo?.panNumber || employeeProfileData.profile?.panNumber || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Address Information */}
                      {(employeeProfileData.profile?.address || employeeProfileData.profile?.city || employeeProfileData.profile?.state || employeeProfileData.profile?.postalCode || personalInfo?.address || personalInfo?.city || personalInfo?.state || personalInfo?.postalCode) && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Address Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(employeeProfileData.profile?.address || personalInfo?.address) && (
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Full Address</label>
                                <p className="mt-1 text-sm text-gray-900">{employeeProfileData.profile?.address || personalInfo?.address || '-'}</p>
                              </div>
                            )}
                            {(employeeProfileData.profile?.city || personalInfo?.city) && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700">City</label>
                                <p className="mt-1 text-sm text-gray-900">{employeeProfileData.profile?.city || personalInfo?.city || '-'}</p>
                              </div>
                            )}
                            {(employeeProfileData.profile?.state || personalInfo?.state) && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700">State</label>
                                <p className="mt-1 text-sm text-gray-900">{employeeProfileData.profile?.state || personalInfo?.state || '-'}</p>
                              </div>
                            )}
                            {(employeeProfileData.profile?.postalCode || personalInfo?.postalCode) && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Postal Code</label>
                                <p className="mt-1 text-sm text-gray-900">{employeeProfileData.profile?.postalCode || personalInfo?.postalCode || '-'}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Emergency Contact Information */}
                      {(() => {
                        const emergencyInfo = parsedDocuments?.emergencyInfo || {};
                        const legacyEmergency = parsedDocuments?.emergencyContact || {};

                        const emergencyContactName =
                          emergencyInfo?.emergencyContactName ||
                          legacyEmergency?.emergencyContactName ||
                          parsedDocuments?.emergencyContactName ||
                          '';

                        const emergencyRelationship =
                          emergencyInfo?.emergencyRelationship ||
                          legacyEmergency?.emergencyRelationship ||
                          parsedDocuments?.emergencyRelationship ||
                          '';

                        const emergencyPhoneNumber =
                          emergencyInfo?.emergencyPhoneNumber ||
                          legacyEmergency?.emergencyPhoneNumber ||
                          parsedDocuments?.emergencyPhoneNumber ||
                          '';

                        const emergencyAlternatePhone =
                          emergencyInfo?.emergencyAlternatePhone ||
                          legacyEmergency?.emergencyAlternatePhone ||
                          parsedDocuments?.emergencyAlternatePhone ||
                          '';
                        
                        return (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Emergency Contact Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Contact Name</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContactName || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Relationship</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyRelationship || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyPhoneNumber || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Alternate Phone Number</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyAlternatePhone || '-'}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}


                      {/* Documents Section */}
                      {(() => {
                        // Only show documents section if profile exists
                        if (!employeeProfileData.profile) {
                          return null;
                        }

                        // Use the already parsed documents from outer scope

                    // Helper function to check if a document object has a valid URL
                    const hasValidUrl = (doc: any): boolean => {
                      if (!doc) return false;
                      if (typeof doc === 'string') return doc.trim() !== '';
                      if (typeof doc === 'object') {
                        const url = doc.url || doc.URL || doc.path || doc.file;
                        return url && typeof url === 'string' && url.trim() !== '';
                      }
                      return false;
                    };

                    // Check if documents exist and have valid URLs - more flexible checking
                    const photoDoc = parsedDocuments?.photo;
                    const panDoc = parsedDocuments?.panCard || parsedDocuments?.pan;
                    const aadharDoc = parsedDocuments?.aadharCard || parsedDocuments?.aadhar;
                    const otherDocs = parsedDocuments?.otherDocuments || parsedDocuments?.other || [];

                    const hasPhoto = hasValidUrl(photoDoc);
                    const hasPanCard = hasValidUrl(panDoc);
                    const hasAadharCard = hasValidUrl(aadharDoc);
                    const hasOtherDocs = Array.isArray(otherDocs) && otherDocs.length > 0 && 
                      otherDocs.some((doc: any) => hasValidUrl(doc));

                    const hasDocuments = hasPhoto || hasPanCard || hasAadharCard || hasOtherDocs;

                    return (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Documents</h3>
                        {hasDocuments ? (
                          <div className="space-y-4">
                            {/* Photo */}
                            {hasPhoto && (() => {
                              const photo = parsedDocuments.photo;
                              const photoUrl = photo?.url || photo?.URL || photo?.path || photo?.file || (typeof photo === 'string' ? photo : null);
                              const photoName = photo?.name || photo?.filename || 'Photo';
                              
                              if (!photoUrl) return null;
                              
                              return (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
                                  <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex-shrink-0">
                                      <img
                                        src={getImageUrl(photoUrl) || ''}
                                        alt="Photo"
                                        className="h-16 w-16 object-cover rounded border border-gray-300"
                                        crossOrigin="anonymous"
                                        onError={(e) => {
                                          console.error('Error loading photo:', photoUrl);
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">{photoName}</p>
                                      <p className="text-xs text-gray-500">Image File</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {(() => {
                                        const photoFullUrl = getImageUrl(photoUrl) || photoUrl || '#';
                                        const hasValidPhotoUrl = photoFullUrl && photoFullUrl !== '#' && photoFullUrl.trim() !== '';
                                        return hasValidPhotoUrl ? (
                                          <>
                                            <a
                                              href={photoFullUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
                                            >
                                              👁️ View
                                            </a>
                                            <a
                                              href={photoFullUrl}
                                              download
                                              className="px-3 py-1.5 text-sm text-green-600 hover:text-green-800 border border-green-300 rounded hover:bg-green-50"
                                            >
                                              ⬇️ Download
                                            </a>
                                          </>
                                        ) : (
                                          <span className="px-3 py-1.5 text-sm text-gray-400 italic">
                                            Invalid URL
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* PAN Card */}
                            {hasPanCard && (() => {
                              const panDoc = parsedDocuments.panCard || parsedDocuments.pan;
                              const panUrl = panDoc?.url || panDoc?.URL || panDoc?.path || panDoc?.file || (typeof panDoc === 'string' ? panDoc : null);
                              const panName = panDoc?.name || panDoc?.filename || 'PAN Card';
                              
                              if (!panUrl) return null;
                              
                              const isPdf = panUrl.endsWith('.pdf') || panUrl.includes('application/pdf');
                              
                              return (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">PAN Card</label>
                                  <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex-shrink-0">
                                      {isPdf ? (
                                        <div className="h-16 w-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                                          <span className="text-2xl">📄</span>
                                        </div>
                                      ) : (
                                        <img
                                          src={getImageUrl(panUrl) || ''}
                                          alt="PAN Card"
                                          className="h-16 w-16 object-cover rounded border border-gray-300"
                                          crossOrigin="anonymous"
                                          onError={(e) => {
                                            console.error('Error loading PAN card:', panUrl);
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                          }}
                                        />
                                      )}
                                      <div className="h-16 w-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center hidden">
                                        <span className="text-2xl">📄</span>
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">{panName}</p>
                                      <p className="text-xs text-gray-500">
                                        {isPdf ? 'PDF Document' : 'Image File'}
                                      </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {(() => {
                                        const panFullUrl = getImageUrl(panUrl) || panUrl || '#';
                                        const hasValidPanUrl = panFullUrl && panFullUrl !== '#' && panFullUrl.trim() !== '';
                                        return hasValidPanUrl ? (
                                          <>
                                            <a
                                              href={panFullUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
                                            >
                                              👁️ View
                                            </a>
                                            <a
                                              href={panFullUrl}
                                              download
                                              className="px-3 py-1.5 text-sm text-green-600 hover:text-green-800 border border-green-300 rounded hover:bg-green-50"
                                            >
                                              ⬇️ Download
                                            </a>
                                          </>
                                        ) : (
                                          <span className="px-3 py-1.5 text-sm text-gray-400 italic">
                                            Invalid URL
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Aadhar Card */}
                            {hasAadharCard && (() => {
                              const aadharDoc = parsedDocuments.aadharCard || parsedDocuments.aadhar;
                              const aadharUrl = aadharDoc?.url || aadharDoc?.URL || aadharDoc?.path || aadharDoc?.file || (typeof aadharDoc === 'string' ? aadharDoc : null);
                              const aadharName = aadharDoc?.name || aadharDoc?.filename || 'Aadhar Card';
                              
                              if (!aadharUrl) return null;
                              
                              const isPdf = aadharUrl.endsWith('.pdf') || aadharUrl.includes('application/pdf');
                              
                              return (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">Aadhar Card</label>
                                  <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex-shrink-0">
                                      {isPdf ? (
                                        <div className="h-16 w-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                                          <span className="text-2xl">📄</span>
                                        </div>
                                      ) : (
                                        <img
                                          src={getImageUrl(aadharUrl) || ''}
                                          alt="Aadhar Card"
                                          className="h-16 w-16 object-cover rounded border border-gray-300"
                                          crossOrigin="anonymous"
                                          onError={(e) => {
                                            console.error('Error loading Aadhar card:', aadharUrl);
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                          }}
                                        />
                                      )}
                                      <div className="h-16 w-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center hidden">
                                        <span className="text-2xl">📄</span>
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">{aadharName}</p>
                                      <p className="text-xs text-gray-500">
                                        {isPdf ? 'PDF Document' : 'Image File'}
                                      </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {(() => {
                                        const aadharFullUrl = getImageUrl(aadharUrl) || aadharUrl || '#';
                                        const hasValidAadharUrl = aadharFullUrl && aadharFullUrl !== '#' && aadharFullUrl.trim() !== '';
                                        return hasValidAadharUrl ? (
                                          <>
                                            <a
                                              href={aadharFullUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
                                            >
                                              👁️ View
                                            </a>
                                            <a
                                              href={aadharFullUrl}
                                              download
                                              className="px-3 py-1.5 text-sm text-green-600 hover:text-green-800 border border-green-300 rounded hover:bg-green-50"
                                            >
                                              ⬇️ Download
                                            </a>
                                          </>
                                        ) : (
                                          <span className="px-3 py-1.5 text-sm text-gray-400 italic">
                                            Invalid URL
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Other Documents */}
                            {hasOtherDocs && (() => {
                              const otherDocs = parsedDocuments.otherDocuments || parsedDocuments.other || [];
                              const validDocs = Array.isArray(otherDocs) 
                                ? otherDocs.filter((doc: any) => {
                                    const docUrl = typeof doc === 'string' ? doc : (doc?.url || doc?.URL || doc?.path || doc?.file);
                                    return docUrl && typeof docUrl === 'string' && docUrl.trim() !== '';
                                  })
                                : [];
                              
                              if (validDocs.length === 0) return null;
                              
                              return (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">Other Documents</label>
                                  <div className="space-y-2">
                                    {validDocs.map((doc: any, index: number) => {
                                      const docUrl = typeof doc === 'string' ? doc : (doc?.url || doc?.URL || doc?.path || doc?.file);
                                      const docName = typeof doc === 'string' ? `Document ${index + 1}` : (doc?.name || doc?.filename || `Document ${index + 1}`);
                                      // Ensure we get a valid URL - getImageUrl handles malformed URLs
                                      const fullUrl = getImageUrl(docUrl) || docUrl || '#';
                                      const isPdf = docUrl?.endsWith('.pdf') || docUrl?.includes('application/pdf');
                                      const isImage = docUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                      const hasValidUrl = fullUrl && fullUrl !== '#' && fullUrl.trim() !== '';

                                    return (
                                      <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="flex-shrink-0">
                                          {isImage && docUrl && hasValidUrl ? (
                                            <img
                                              src={fullUrl}
                                              alt={docName}
                                              className="h-16 w-16 object-cover rounded border border-gray-300"
                                              crossOrigin="anonymous"
                                              onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                              }}
                                            />
                                          ) : (
                                            <div className="h-16 w-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                                              <span className="text-2xl">{isPdf ? '📄' : '📎'}</span>
                                            </div>
                                          )}
                                          <div className="h-16 w-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center hidden">
                                            <span className="text-2xl">📎</span>
                                          </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 truncate" title={docName}>
                                            {docName}
                                          </p>
                                          <p className="text-xs text-gray-500 mt-0.5">
                                            {isPdf ? 'PDF Document' : isImage ? 'Image File' : 'Document'}
                                          </p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          {hasValidUrl ? (
                                            <>
                                              <a
                                                href={fullUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
                                                title="View Document"
                                              >
                                                👁️ View
                                              </a>
                                              <a
                                                href={fullUrl}
                                                download
                                                className="px-3 py-1.5 text-sm text-green-600 hover:text-green-800 border border-green-300 rounded hover:bg-green-50"
                                                title="Download Document"
                                              >
                                                ⬇️ Download
                                              </a>
                                            </>
                                          ) : (
                                            <span className="px-3 py-1.5 text-sm text-gray-400 italic">
                                              Invalid URL
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-gray-500 mb-2">No documents uploaded for this employee.</p>
                            <p className="text-xs text-gray-400 mt-2">
                              Documents can be uploaded through the Edit Employee page.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                    </div>
                  );
                })()
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Failed to load employee details.</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-between items-center">
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <button
                  onClick={() => {
                    if (selectedEmployee) {
                      setIsViewModalOpen(false);
                      // Invalidate queries before navigating to ensure fresh data on return
                      queryClient.invalidateQueries({ queryKey: ['employee-profile', selectedEmployee.id] });
                      queryClient.invalidateQueries({ queryKey: ['employee', selectedEmployee.id] });
                      queryClient.invalidateQueries({ queryKey: ['employees'] });
                      navigate(`/employees/${selectedEmployee.id}/edit`);
                    }
                  }}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                >
                  ✏️ Edit Employee
                </button>
              )}
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedEmployee(null);
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
