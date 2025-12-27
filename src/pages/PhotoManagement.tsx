import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { userAPI, User } from '../api/user.api';
import { uploadAPI } from '../api/upload.api';
import { getImageUrl } from '../utils/imageUtils';

export const PhotoManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [bulkUploadFiles, setBulkUploadFiles] = useState<Array<{ file: File; user: User | null; preview: string }>>([]);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<Record<number, { status: 'pending' | 'uploading' | 'success' | 'error'; message?: string }>>({});

  // Fetch all users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', roleFilter],
    queryFn: () => userAPI.getAllUsers(roleFilter !== 'all' ? { role: roleFilter } : {}),
  });

  // Debug: Log all users and their avatarUrls
  React.useEffect(() => {
    if (usersData?.data?.users) {
      console.log('👥 All users fetched:', usersData.data.users.map((u: User) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        hasAvatar: !!u.avatarUrl
      })));
    }
  }, [usersData]);

  // Update user photo mutation
  const updateUserPhotoMutation = useMutation({
    mutationFn: ({ userId, avatarUrl }: { userId: number; avatarUrl: string }) =>
      userAPI.updateUser(userId, { avatarUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsUploadModalOpen(false);
      setIsEditModalOpen(false);
      setSelectedUser(null);
      setImagePreview(null);
      alert('Photo updated successfully!');
    },
    onError: (error: any) => {
      console.error('Update photo error:', error);
      alert(error.response?.data?.message || 'Failed to update photo');
      setUploadingImage(false);
    },
  });

  // Delete user photo mutation
  const deleteUserPhotoMutation = useMutation({
    mutationFn: (userId: number) => userAPI.updateUser(userId, { avatarUrl: undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      alert('Photo deleted successfully!');
    },
    onError: (error: any) => {
      console.error('Delete photo error:', error);
      alert(error.response?.data?.message || 'Failed to delete photo');
    },
  });

  const handleUploadClick = (user: User) => {
    setSelectedUser(user);
    setImagePreview(user.avatarUrl || null);
    setIsUploadModalOpen(true);
  };

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setImagePreview(user.avatarUrl || null);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (user: User) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Show preview immediately using FileReader
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setUploadingImage(true);
    try {
      const uploadResponse = await uploadAPI.uploadFile(file);
      console.log('Upload response:', uploadResponse);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const uploadedFile = uploadResponse.data.files[0];
        console.log('Upload response file:', uploadedFile);
        
        // Store relative URL in database (backend will serve it)
        const relativeUrl = uploadedFile.url;
        console.log('Storing relative URL in database:', relativeUrl);
        
        // Get full URL for preview
        const fullImageUrl = getImageUrl(relativeUrl);
        console.log('Full image URL for preview:', fullImageUrl);
        
        // Update preview with the full URL
        setImagePreview(fullImageUrl || relativeUrl);
        
        // Update user with relative URL (backend will serve it)
        updateUserPhotoMutation.mutate({
          userId: selectedUser.id,
          avatarUrl: relativeUrl,
        });
      } else {
        throw new Error('No files returned from upload');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.response?.data?.message || error.message || 'Failed to upload image');
      setUploadingImage(false);
      setImagePreview(selectedUser.avatarUrl || null);
    }
  };

  const handleConfirmDelete = () => {
    if (selectedUser) {
      deleteUserPhotoMutation.mutate(selectedUser.id);
    }
  };

  const users = usersData?.data?.users || [];
  
  // Debug: Log users with avatarUrl
  React.useEffect(() => {
    const usersWithPhotos = users.filter((u: User) => u.avatarUrl);
    console.log('📸 Users with photos:', usersWithPhotos.map((u: User) => ({
      name: u.name,
      id: u.id,
      avatarUrl: u.avatarUrl,
      fullUrl: getImageUrl(u.avatarUrl || '')
    })));
  }, [users]);
  
  // Filter users based on search term
  const filteredUsers = users.filter((user: User) => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.phone && user.phone.includes(searchTerm));
    return matchesSearch;
  });

  // Group users by role
  const usersByRole = filteredUsers.reduce((acc: Record<string, User[]>, user: User) => {
    if (!acc[user.role]) {
      acc[user.role] = [];
    }
    acc[user.role].push(user);
    return acc;
  }, {} as Record<string, User[]>);

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
                <h1 className="text-3xl font-bold text-white">Photo Management</h1>
                <p className="mt-2 text-orange-100">Upload, edit, and manage user photos</p>
              </div>
              <button
                onClick={() => setIsBulkUploadModalOpen(true)}
                className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors flex items-center gap-2"
                title="Bulk upload photos for multiple users"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Bulk Upload
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Search and Filter */}
            <div className="mb-6 flex gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="faculty">Faculty</option>
                <option value="employee">Employees</option>
                <option value="admin">Admins</option>
                <option value="superadmin">Super Admins</option>
              </select>
            </div>

            {/* Users List */}
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No users found</p>
              </div>
            ) : (
              <div className="space-y-6">
                {(Object.entries(usersByRole) as [string, User[]][]).map(([role, roleUsers]) => (
                  <div key={role} className="border border-gray-200 rounded-lg p-4">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 capitalize">
                      {role} ({roleUsers.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {roleUsers.map((user: User) => (
                        <div
                          key={user.id}
                          className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
                        >
                          <div className="flex flex-col items-center">
                            {/* Photo Preview */}
                            <div className="relative mb-4">
                              {user.avatarUrl ? (
                                <img
                                  src={getImageUrl(user.avatarUrl) || ''}
                                  alt={user.name}
                                  className="w-24 h-24 rounded-full object-cover border-4 border-orange-500"
                                  crossOrigin="anonymous"
                                  onError={(e) => {
                                    const fullUrl = getImageUrl(user.avatarUrl);
                                    const imgElement = e.target as HTMLImageElement;
                                    console.error('❌ Image load error:', {
                                      user: user.name,
                                      userId: user.id,
                                      avatarUrl: user.avatarUrl,
                                      fullUrl: fullUrl,
                                      imageSrc: imgElement.src,
                                      error: 'Image failed to load'
                                    });
                                    // Use a data URI placeholder instead of external service
                                    imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFBob3RvPC90ZXh0Pjwvc3ZnPg==';
                                  }}
                                  onLoad={() => {
                                    console.log('✅ Image loaded successfully:', {
                                      user: user.name,
                                      userId: user.id,
                                      avatarUrl: user.avatarUrl,
                                      fullUrl: getImageUrl(user.avatarUrl)
                                    });
                                  }}
                                />
                              ) : (
                                <div className="w-24 h-24 rounded-full bg-gray-300 border-4 border-orange-500 flex items-center justify-center">
                                  <span className="text-3xl text-gray-600">👤</span>
                                </div>
                              )}
                            </div>

                            {/* User Info */}
                            <div className="text-center mb-4">
                              <h3 className="font-semibold text-gray-900 truncate w-full">{user.name}</h3>
                              <p className="text-sm text-gray-500 truncate w-full">{user.email}</p>
                              {user.phone && (
                                <p className="text-xs text-gray-400">{user.phone}</p>
                              )}
                              <span className="inline-block mt-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full capitalize">
                                {user.role}
                              </span>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 w-full">
                              {!user.avatarUrl ? (
                                <button
                                  onClick={() => handleUploadClick(user)}
                                  className="flex-1 px-3 py-2 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                                >
                                  Upload
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEditClick(user)}
                                    className="flex-1 px-3 py-2 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(user)}
                                    className="flex-1 px-3 py-2 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Photo Modal */}
      {isUploadModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Upload Photo for {selectedUser.name}</h2>
            
            {/* Preview */}
            <div className="mb-4 flex justify-center">
              {imagePreview ? (
                <img
                  src={getImageUrl(imagePreview) || imagePreview}
                  alt="Preview"
                  className="w-32 h-32 rounded-full object-cover border-4 border-orange-500"
                  crossOrigin="anonymous"
                  onError={(e) => {
                                    console.error('Image load error in upload modal:', imagePreview);
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFBob3RvPC90ZXh0Pjwvc3ZnPg==';
                                  }}
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-300 border-4 border-orange-500 flex items-center justify-center">
                  <span className="text-4xl text-gray-600">👤</span>
                </div>
              )}
            </div>

            {/* File Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Image (JPG, PNG, WEBP, GIF - Max 5MB)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setSelectedUser(null);
                  setImagePreview(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={uploadingImage}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Photo Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Photo for {selectedUser.name}</h2>
            
            {/* Current Photo Preview */}
            <div className="mb-4 flex justify-center">
              {imagePreview ? (
                <img
                  src={getImageUrl(imagePreview) || imagePreview}
                  alt="Current Photo"
                  className="w-32 h-32 rounded-full object-cover border-4 border-orange-500"
                                  onError={(e) => {
                                    console.error('Image load error in edit modal:', imagePreview);
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFBob3RvPC90ZXh0Pjwvc3ZnPg==';
                                  }}
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-300 border-4 border-orange-500 flex items-center justify-center">
                  <span className="text-4xl text-gray-600">👤</span>
                </div>
              )}
            </div>

            {/* File Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select New Image (JPG, PNG, WEBP, GIF - Max 5MB)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {uploadingImage && (
              <div className="mb-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Uploading...</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedUser(null);
                  setImagePreview(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={uploadingImage}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Photo Modal */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Delete Photo</h2>
            <p className="mb-4 text-gray-600">
              Are you sure you want to delete the photo for <strong>{selectedUser.name}</strong>?
            </p>
            {selectedUser.avatarUrl && (
              <div className="mb-4 flex justify-center">
                <img
                  src={getImageUrl(selectedUser.avatarUrl) || ''}
                  alt="Current Photo"
                  className="w-24 h-24 rounded-full object-cover border-4 border-red-500"
                  onError={(e) => {
                    console.error('Image load error in delete modal:', selectedUser.avatarUrl);
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFBob3RvPC90ZXh0Pjwvc3ZnPg==';
                  }}
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedUser(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Bulk Photo Upload</h2>
            
            {/* File Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Multiple Images (JPG, PNG, WEBP, GIF - Max 5MB each)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  const newFiles = files.map((file) => ({
                    file,
                    user: null as User | null,
                    preview: URL.createObjectURL(file),
                  }));
                  setBulkUploadFiles((prev) => [...prev, ...newFiles]);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <p className="mt-2 text-xs text-gray-500">
                Select multiple images, then assign each to a user below
              </p>
            </div>

            {/* File List with User Assignment */}
            {bulkUploadFiles.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Assign Photos to Users ({bulkUploadFiles.length} files)
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {bulkUploadFiles.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg">
                      {/* Image Preview */}
                      <div className="flex-shrink-0">
                        <img
                          src={item.preview}
                          alt={`Preview ${index + 1}`}
                          className="w-16 h-16 rounded object-cover border-2 border-gray-300"
                        />
                      </div>
                      
                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>

                      {/* User Selection */}
                      <div className="flex-1">
                        <select
                          value={item.user?.id || ''}
                          onChange={(e) => {
                            const userId = parseInt(e.target.value);
                            const selectedUser = users.find((u: User) => u.id === userId);
                            setBulkUploadFiles((prev) =>
                              prev.map((f, i) => (i === index ? { ...f, user: selectedUser || null } : f))
                            );
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        >
                          <option value="">Select User...</option>
                          {users.map((u: User) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.email}) - {u.role}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Status/Progress */}
                      <div className="flex-shrink-0 w-24 text-center">
                        {bulkUploadProgress[index]?.status === 'uploading' && (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500 mx-auto"></div>
                        )}
                        {bulkUploadProgress[index]?.status === 'success' && (
                          <span className="text-green-600 text-sm">✓ Done</span>
                        )}
                        {bulkUploadProgress[index]?.status === 'error' && (
                          <span className="text-red-600 text-sm">✗ Error</span>
                        )}
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => {
                          URL.revokeObjectURL(item.preview);
                          setBulkUploadFiles((prev) => prev.filter((_, i) => i !== index));
                          setBulkUploadProgress((prev) => {
                            const newProgress = { ...prev };
                            delete newProgress[index];
                            return newProgress;
                          });
                        }}
                        className="flex-shrink-0 px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Button */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  bulkUploadFiles.forEach((item) => URL.revokeObjectURL(item.preview));
                  setBulkUploadFiles([]);
                  setBulkUploadProgress({});
                  setIsBulkUploadModalOpen(false);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={uploadingBulk}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  // Validate all files have users assigned
                  const unassignedFiles = bulkUploadFiles.filter((item) => !item.user);
                  if (unassignedFiles.length > 0) {
                    alert(`Please assign users to all ${unassignedFiles.length} file(s)`);
                    return;
                  }

                  setUploadingBulk(true);
                  setBulkUploadProgress({});

                  let successCount = 0;
                  let errorCount = 0;

                  // Upload files one by one and assign to users
                  for (let i = 0; i < bulkUploadFiles.length; i++) {
                    const item = bulkUploadFiles[i];
                    if (!item.user) continue;

                    setBulkUploadProgress((prev) => ({
                      ...prev,
                      [i]: { status: 'uploading' },
                    }));

                    try {
                      // Validate file
                      if (!item.file.type.startsWith('image/')) {
                        throw new Error('Invalid file type');
                      }
                      if (item.file.size > 5 * 1024 * 1024) {
                        throw new Error('File size exceeds 5MB');
                      }

                      // Upload file
                      const uploadResponse = await uploadAPI.uploadFile(item.file);
                      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
                        const imageUrl = uploadResponse.data.files[0].url;
                        
                        // Update user with image URL
                        await userAPI.updateUser(item.user.id, { avatarUrl: imageUrl });
                        
                        setBulkUploadProgress((prev) => ({
                          ...prev,
                          [i]: { status: 'success' },
                        }));
                        successCount++;
                      } else {
                        throw new Error('No files returned from upload');
                      }
                    } catch (error: any) {
                      console.error(`Error uploading file ${i + 1}:`, error);
                      setBulkUploadProgress((prev) => ({
                        ...prev,
                        [i]: { status: 'error', message: error.message || 'Upload failed' },
                      }));
                      errorCount++;
                    }
                  }

                  setUploadingBulk(false);
                  
                  // Clean up preview URLs
                  bulkUploadFiles.forEach((item) => URL.revokeObjectURL(item.preview));
                  
                  // Refresh users list
                  queryClient.invalidateQueries({ queryKey: ['users'] });
                  
                  // Show results
                  alert(`Bulk upload completed!\n✓ Success: ${successCount}\n✗ Errors: ${errorCount}`);
                  
                  // Close modal if all successful
                  if (errorCount === 0) {
                    setBulkUploadFiles([]);
                    setBulkUploadProgress({});
                    setIsBulkUploadModalOpen(false);
                  }
                }}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={uploadingBulk || bulkUploadFiles.length === 0}
              >
                {uploadingBulk ? 'Uploading...' : `Upload ${bulkUploadFiles.length} Photo(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

