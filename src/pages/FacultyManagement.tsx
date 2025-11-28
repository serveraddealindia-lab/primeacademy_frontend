import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { facultyAPI, FacultyUser } from '../api/faculty.api';
import { userAPI } from '../api/user.api';
import { uploadAPI } from '../api/upload.api';

export const FacultyManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyUser | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Fetch faculty
  const { data: facultyData, isLoading, error: facultyError } = useQuery({
    queryKey: ['faculty'],
    queryFn: () => facultyAPI.getAllFaculty(),
    retry: 1,
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => userAPI.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      setIsDeleteModalOpen(false);
      setSelectedFaculty(null);
      alert('Faculty deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete faculty');
    },
  });

  const updateUserImageMutation = useMutation({
    mutationFn: ({ userId, avatarUrl }: { userId: number; avatarUrl: string }) =>
      userAPI.updateUser(userId, { avatarUrl }),
    onSuccess: (data, variables) => {
      // Invalidate and refetch faculty list
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      // Update the selected faculty's avatarUrl immediately
      if (selectedFaculty) {
        setSelectedFaculty({ ...selectedFaculty, avatarUrl: variables.avatarUrl });
      }
      setUploadingImage(false);
      setIsImageModalOpen(false);
      setSelectedFaculty(null);
      setImagePreview(null);
      alert('Image updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update image');
      setUploadingImage(false);
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedFaculty) return;

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
      console.log('Upload response:', uploadResponse);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const imageUrl = uploadResponse.data.files[0].url;
        console.log('Uploaded image URL:', imageUrl);
        // Update preview with the uploaded URL
        setImagePreview(imageUrl);
        // Update user with new image URL
        updateUserImageMutation.mutate({
          userId: selectedFaculty.id,
          avatarUrl: imageUrl,
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

  const faculty = facultyData?.data.users || [];

  const handleDelete = (facultyMember: FacultyUser) => {
    setSelectedFaculty(facultyMember);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedFaculty) {
      deleteUserMutation.mutate(selectedFaculty.id);
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

  if (facultyError) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <div className="text-center py-12">
              <p className="text-red-600 text-lg mb-4">Error loading faculty data</p>
              <p className="text-gray-500 text-sm">
                {(facultyError as any)?.response?.data?.message || (facultyError as any)?.message || 'Unknown error'}
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
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Faculty Management</h1>
                <p className="mt-2 text-orange-100">Manage faculty members</p>
              </div>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <button
                  onClick={() => window.location.href = '/faculty/register'}
                  className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                >
                  + New Faculty Registration
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {faculty.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No faculty members found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {faculty.map((facultyMember) => (
                  <div key={facultyMember.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          {facultyMember.avatarUrl ? (
                            <img
                              src={`${facultyMember.avatarUrl}?t=${Date.now()}`}
                              alt={facultyMember.name}
                              className="h-16 w-16 rounded-full object-cover border-2 border-orange-200"
                              key={facultyMember.avatarUrl}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(facultyMember.name) + '&background=orange&color=fff';
                              }}
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-xl">
                              {facultyMember.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">{facultyMember.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{facultyMember.email}</p>
                          {facultyMember.phone && (
                            <p className="text-sm text-gray-600">{facultyMember.phone}</p>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        facultyMember.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {facultyMember.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {facultyMember.facultyProfile && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        {facultyMember.facultyProfile.expertise && (
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Expertise:</span> {facultyMember.facultyProfile.expertise}
                          </p>
                        )}
                        {facultyMember.facultyProfile.availability && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Availability:</span> {facultyMember.facultyProfile.availability}
                          </p>
                        )}
                      </div>
                    )}
                    {!facultyMember.facultyProfile && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 italic">No faculty profile created yet</p>
                      </div>
                    )}
                    {(user?.role === 'admin' || user?.role === 'superadmin') && (
                      <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col gap-2">
                        <button
                          onClick={() => {
                            setSelectedFaculty(facultyMember);
                            setImagePreview(facultyMember.avatarUrl || null);
                            setIsImageModalOpen(true);
                          }}
                          className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          📷 Update Photo
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/faculty/${facultyMember.id}/edit`)}
                            className="flex-1 px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                          >
                            ✏️ Edit
                          </button>
                          {user?.role === 'superadmin' && (
                            <button
                              onClick={() => handleDelete(facultyMember)}
                              className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedFaculty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Faculty</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete <strong>{selectedFaculty.name}</strong>? This action cannot be undone.
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
                  setSelectedFaculty(null);
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
      {isImageModalOpen && selectedFaculty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Update Faculty Photo</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Faculty:</strong> {selectedFaculty.name}
              </p>
              <div className="flex justify-center mb-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    key={imagePreview}
                  />
                ) : selectedFaculty?.avatarUrl ? (
                  <img
                    src={`${selectedFaculty.avatarUrl}?t=${Date.now()}`}
                    alt="Current"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    key={selectedFaculty.avatarUrl}
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
                  setSelectedFaculty(null);
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
    </Layout>
  );
};

