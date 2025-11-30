import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { facultyAPI } from '../api/faculty.api';
import { userAPI, UpdateUserRequest } from '../api/user.api';
import { uploadAPI } from '../api/upload.api';
import { getImageUrl } from '../utils/imageUtils';
import api from '../api/axios';

export const FacultyEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Fetch faculty data
  const { data: facultyData, isLoading } = useQuery({
    queryKey: ['faculty', id],
    queryFn: async () => {
      const userResponse = await api.get(`/users/${id}`);
      return userResponse.data.data.user;
    },
    enabled: !!id,
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: UpdateUserRequest) => userAPI.updateUser(Number(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty', id] });
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: { expertise?: string; availability?: string }) => facultyAPI.updateFacultyProfile(Number(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty', id] });
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      alert('Faculty updated successfully!');
      navigate('/faculty');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update faculty profile');
    },
  });

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600">You don't have permission to edit faculty.</p>
            <button
              onClick={() => navigate('/faculty')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Back to Faculty
            </button>
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

  if (!facultyData) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600">Faculty not found.</p>
            <button
              onClick={() => navigate('/faculty')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Back to Faculty
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Update user info
    const userData: UpdateUserRequest = {
      name: formData.get('name') as string || undefined,
      email: formData.get('email') as string || undefined,
      phone: formData.get('phone') as string || undefined,
      isActive: formData.get('isActive') === 'true',
    };

    // Update profile info
    const profileData = {
      expertise: formData.get('expertise') as string || undefined,
      availability: formData.get('availability') as string || undefined,
    };

    updateUserMutation.mutate(userData, {
      onSuccess: () => {
        if (profileData.expertise || profileData.availability) {
          updateProfileMutation.mutate(profileData);
        } else {
          alert('Faculty updated successfully!');
          navigate('/faculty');
        }
      },
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Edit Faculty</h1>
                <p className="mt-2 text-orange-100">Update faculty information</p>
              </div>
              <button
                onClick={() => navigate('/faculty')}
                className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Photo */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-6">Profile Photo</h2>
                <div className="flex items-center gap-6">
                  {imagePreview || facultyData.avatarUrl ? (
                    <img
                      src={getImageUrl(imagePreview || facultyData.avatarUrl || '') || ''}
                      alt={facultyData.name}
                      className="w-32 h-32 rounded-full object-cover border-4 border-orange-500"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7ZmFjdWx0eURhdGEubmFtZS5jaGFyQXQoMCl9fTwvdGV4dD48L3N2Zz4=';
                      }}
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gray-300 border-4 border-orange-500 flex items-center justify-center">
                      <span className="text-4xl text-gray-600">👤</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        if (!file.type.startsWith('image/')) {
                          alert('Please select an image file');
                          return;
                        }

                        if (file.size > 5 * 1024 * 1024) {
                          alert('Image size must be less than 5MB');
                          return;
                        }

                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setImagePreview(reader.result as string);
                        };
                        reader.readAsDataURL(file);

                        setUploadingImage(true);
                        try {
                          const uploadResponse = await uploadAPI.uploadFile(file);
                          if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
                            const imageUrl = uploadResponse.data.files[0].url;
                            setImagePreview(getImageUrl(imageUrl) || imageUrl);
                            // Update user with new image URL
                            await userAPI.updateUser(Number(id!), { avatarUrl: imageUrl });
                            queryClient.invalidateQueries({ queryKey: ['faculty', id] });
                            queryClient.invalidateQueries({ queryKey: ['faculty'] });
                            alert('Photo uploaded successfully!');
                          }
                        } catch (error: any) {
                          console.error('Upload error:', error);
                          alert(error.response?.data?.message || 'Failed to upload image');
                        } finally {
                          setUploadingImage(false);
                        }
                      }}
                      disabled={uploadingImage}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    />
                    {uploadingImage && (
                      <p className="mt-1 text-xs text-gray-500">Uploading...</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">JPG, PNG, WEBP, GIF - Max 5MB</p>
                  </div>
                </div>
              </div>

              {/* Basic Information */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-6">Basic Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={facultyData.name}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={facultyData.email}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      defaultValue={facultyData.phone || ''}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                    <select
                      name="isActive"
                      defaultValue={facultyData.isActive ? 'true' : 'false'}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Faculty Profile Information */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-6">Faculty Profile</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expertise</label>
                    <textarea
                      name="expertise"
                      rows={4}
                      defaultValue={facultyData.facultyProfile?.expertise || ''}
                      placeholder="e.g., Digital Art, Photoshop, Illustrator, UI/UX Design"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">List the areas of expertise for this faculty member</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                    <textarea
                      name="availability"
                      rows={4}
                      defaultValue={facultyData.facultyProfile?.availability || ''}
                      placeholder="e.g., Monday-Friday, 9 AM - 5 PM"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Specify the availability schedule for this faculty member</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={updateUserMutation.isPending || updateProfileMutation.isPending}
                  className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {(updateUserMutation.isPending || updateProfileMutation.isPending) ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/faculty')}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

