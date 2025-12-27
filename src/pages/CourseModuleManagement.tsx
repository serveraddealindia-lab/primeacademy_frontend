import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { courseAPI, Course } from '../api/course.api';

const SOFTWARE_OPTIONS = [
  'Photoshop', 'Illustrator', 'Indesign', 'Corel Draw', 'Figma',
  'Premiere', 'Audition', 'Aftereffects',
  '3ds Max (AR)', 'V-ray', 'Sketchup', 'Lumion', 'Autocad',
];

export const CourseModuleManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [courseName, setCourseName] = useState('');
  const [selectedSoftware, setSelectedSoftware] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Fetch courses with error handling
  const { data: coursesData, isLoading, error, refetch } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      try {
        const result = await courseAPI.getAllCourses();
        console.log('Fetched courses:', result);
        return result;
      } catch (err: any) {
        console.error('Error fetching courses:', err);
        // Return empty data instead of throwing
        return { status: 'error', data: [] };
      }
    },
  });

  const courses = coursesData?.data || [];

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; software: string[] }) => {
      if (editingCourse) {
        return await courseAPI.updateCourse(editingCourse.id, data);
      }
      return await courseAPI.createCourse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      handleCloseModal();
      alert(editingCourse ? 'Course updated!' : 'Course created!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to save course');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => courseAPI.deleteCourse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      alert('Course deleted!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete course');
    },
  });

  const handleOpenModal = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setCourseName(course.name);
      // Handle both array and string formats
      const softwareList = Array.isArray(course.software) 
        ? course.software 
        : typeof course.software === 'string' 
        ? (course.software as string).split(',').map((s: string) => s.trim()).filter((s: string) => s)
        : [];
      setSelectedSoftware(softwareList);
    } else {
      setEditingCourse(null);
      setCourseName('');
      setSelectedSoftware([]);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCourse(null);
    setCourseName('');
    setSelectedSoftware([]);
  };

  const handleSave = () => {
    if (!courseName.trim()) {
      alert('Please enter course name');
      return;
    }
    if (selectedSoftware.length === 0) {
      alert('Please select at least one software');
      return;
    }
    saveMutation.mutate({
      name: courseName.trim(),
      software: selectedSoftware,
    });
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      deleteMutation.mutate(id);
    }
  };

  const toggleSoftware = (software: string) => {
    setSelectedSoftware(prev =>
      prev.includes(software)
        ? prev.filter(s => s !== software)
        : [...prev, software]
    );
  };

  // Permission check - hide from students and employees
  if (!user || user.role === 'student' || user.role === 'employee') {
    return (
      <Layout>
        <div className="p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-red-600">Access denied. This page is not available for your role.</p>
          </div>
        </div>
      </Layout>
    );
  }
  
  // Additional check for admin/superadmin only (faculty can view but not manage)
  if (user.role !== 'admin' && user.role !== 'superadmin' && user.role !== 'faculty') {
    return (
      <Layout>
        <div className="p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-red-600">Access denied. Admin only.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="bg-white rounded-lg shadow">
          {/* Header */}
          <div className="bg-orange-600 text-white p-6 rounded-t-lg">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">Course Modules</h1>
                <p className="text-orange-100 mt-1">Manage courses and software</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => refetch()}
                  className="bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold hover:bg-orange-50"
                  title="Refresh courses"
                >
                  🔄 Refresh
                </button>
                <button
                  onClick={() => handleOpenModal()}
                  className="bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold hover:bg-orange-50"
                >
                  + Add Course
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">
                  Error loading courses: {(error as any)?.message || 'Unknown error'}
                </p>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['courses'] })}
                  className="mt-2 text-red-600 underline"
                >
                  Retry
                </button>
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading courses...</p>
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-2">No courses found</p>
                <p className="text-gray-400 text-sm mb-4">Click "Add Course" to create your first course</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => refetch()}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                  >
                    🔄 Refresh
                  </button>
                  <button
                    onClick={() => handleOpenModal()}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
                  >
                    + Create First Course
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {courses.map((course) => (
                  <div key={course.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{course.name}</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Array.isArray(course.software) 
                            ? course.software.map((software, idx) => (
                                <span
                                  key={idx}
                                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"
                                >
                                  {software}
                                </span>
                              ))
                            : typeof course.software === 'string' && course.software
                            ? (course.software as string).split(',').map((software: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"
                                >
                                  {software.trim()}
                                </span>
                              ))
                            : null
                          }
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleOpenModal(course)}
                          className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(course.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">
                  {editingCourse ? 'Edit Course' : 'Add New Course'}
                </h2>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="e.g., Graphics Beginner"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Software List *
                  </label>
                  <div className="border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {SOFTWARE_OPTIONS.map((software) => (
                        <label
                          key={software}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSoftware.includes(software)}
                            onChange={() => toggleSoftware(software)}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{software}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {selectedSoftware.length > 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      Selected: {selectedSoftware.join(', ')}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCloseModal}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
