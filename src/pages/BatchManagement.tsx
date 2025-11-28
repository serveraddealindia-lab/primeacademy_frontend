import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { batchAPI, Batch, UpdateBatchRequest } from '../api/batch.api';
import { facultyAPI } from '../api/faculty.api';
import { studentAPI } from '../api/student.api';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface DaySchedule {
  startTime: string;
  endTime: string;
}

export const BatchManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [daySchedules, setDaySchedules] = useState<Record<string, DaySchedule>>({});
  const [applyToAll, setApplyToAll] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<number[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [isLoadingEditBatch, setIsLoadingEditBatch] = useState(false);

  // Fetch batches
  const { data: batchesData, isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });

  // Fetch all faculty
  const { data: facultyData, isLoading: isLoadingFaculty } = useQuery({
    queryKey: ['faculty'],
    queryFn: () => facultyAPI.getAllFaculty(1000),
  });

  // Fetch all students
  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  const fetchBatchDetails = async (batchId: number): Promise<Batch> => {
    const response = await batchAPI.getBatchById(batchId);
    return response.data.batch;
  };

  const updateBatchMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBatchRequest }) => batchAPI.updateBatch(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['faculty-batches'] });
      setIsEditModalOpen(false);
      setSelectedBatch(null);
      setDaySchedules({});
      setApplyToAll(false);
      setSelectedFaculty([]);
      setSelectedStudents([]);
      alert('Batch updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update batch');
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: (id: number) => batchAPI.deleteBatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setIsDeleteModalOpen(false);
      setSelectedBatch(null);
      alert('Batch deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete batch');
    },
  });

  const batches = batchesData?.data || [];

  const handleDownloadBatchCsv = (batch: Batch) => {
    const baseRows = [
      ['Section', 'Field', 'Value'],
      ['Batch', 'Title', batch.title],
      ['Batch', 'Software', batch.software || '-'],
      ['Batch', 'Mode', batch.mode],
      ['Batch', 'Status', batch.status || '-'],
      ['Batch', 'Start Date', new Date(batch.startDate).toLocaleDateString()],
      ['Batch', 'End Date', new Date(batch.endDate).toLocaleDateString()],
      ['Batch', 'Max Capacity', batch.maxCapacity?.toString() || '-'],
    ];

    const scheduleRows =
      batch.schedule && Object.keys(batch.schedule).length > 0
        ? Object.entries(batch.schedule).map(([day, times]) => ['Schedule', day, `${times.startTime} - ${times.endTime}`])
        : [];

    const facultyRows =
      batch.assignedFaculty && batch.assignedFaculty.length > 0
        ? batch.assignedFaculty.map((faculty) => [
            'Faculty',
            faculty.name,
            `${faculty.email}${faculty.phone ? ` / ${faculty.phone}` : ''}`,
          ])
        : [];

    const studentRows =
      batch.enrollments && batch.enrollments.length > 0
        ? batch.enrollments.map((enrollment, index) => {
            const studentName = enrollment.student?.name ?? enrollment.name ?? `Student ${index + 1}`;
            const studentEmail = enrollment.student?.email ?? enrollment.email ?? '-';
            const studentPhone = enrollment.student?.phone ?? enrollment.phone;
            return [
              'Student',
              studentName,
              `${studentEmail}${studentPhone ? ` / ${studentPhone}` : ''}`,
            ];
          })
        : [];

    const csvRows = [...baseRows, ...scheduleRows, ...facultyRows, ...studentRows];
    const csv = csvRows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${batch.title.replace(/\s+/g, '_')}-details.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleView = (batch: Batch) => {
    navigate(`/batches/${batch.id}`);
  };

  const handleEdit = async (batch: Batch) => {
    setIsLoadingEditBatch(true);
    try {
      const detailedBatch = await fetchBatchDetails(batch.id);
      setSelectedBatch(detailedBatch);
      setDaySchedules(detailedBatch.schedule || {});
      setApplyToAll(false);
      const assignedFacultyIds = detailedBatch.assignedFaculty?.map((f) => f.id) || [];
      setSelectedFaculty(assignedFacultyIds);
      const enrolledStudentIds =
        detailedBatch.enrollments
          ?.map((enrollment) => enrollment.student?.id ?? enrollment.id)
          .filter((id): id is number => typeof id === 'number') || [];
      setSelectedStudents(enrolledStudentIds);
      setIsEditModalOpen(true);
    } catch (error: any) {
      console.error('Failed to load batch details for editing', error);
      alert(error?.response?.data?.message || 'Failed to load batch details for editing. Please try again.');
    } finally {
      setIsLoadingEditBatch(false);
    }
  };

  const handleToggleFaculty = (facultyId: number) => {
    setSelectedFaculty(prev =>
      prev.includes(facultyId)
        ? prev.filter(id => id !== facultyId)
        : [...prev, facultyId]
    );
  };

  const handleToggleStudent = (studentId: number) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleDayToggle = (day: string) => {
    setDaySchedules(prev => {
      if (prev[day]) {
        const newSchedules = { ...prev };
        delete newSchedules[day];
        return newSchedules;
      } else {
        return {
          ...prev,
          [day]: { startTime: '', endTime: '' }
        };
      }
    });
  };

  const handleTimeChange = (day: string, field: 'startTime' | 'endTime', value: string) => {
    setDaySchedules(prev => {
      const updated = { ...prev };
      
      if (applyToAll) {
        // Apply to all selected days
        Object.keys(prev).forEach(d => {
          updated[d] = {
            ...prev[d],
            [field]: value
          };
        });
      } else {
        // Apply only to the current day
        updated[day] = {
          ...prev[day],
          [field]: value
        };
      }
      
      return updated;
    });
  };

  const handleDelete = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedBatch) {
      deleteBatchMutation.mutate(selectedBatch.id);
    }
  };

  const handleUpdateBatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBatch) return;

    // Validate faculty selection
    if (selectedFaculty.length === 0) {
      alert('Please select at least one faculty member to assign to this batch.');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const data: UpdateBatchRequest = {
      title: formData.get('title') as string || undefined,
      software: formData.get('software') as string || undefined,
      mode: formData.get('mode') as string || undefined,
      startDate: formData.get('startDate') as string || undefined,
      endDate: formData.get('endDate') as string || undefined,
      maxCapacity: formData.get('maxCapacity') ? parseInt(formData.get('maxCapacity') as string) : undefined,
      status: formData.get('status') as string || undefined,
      schedule: Object.keys(daySchedules).length > 0 ? 
        Object.fromEntries(
          Object.entries(daySchedules).filter(([_, times]) => times.startTime && times.endTime)
        ) : undefined,
      facultyIds: selectedFaculty,
      studentIds: selectedStudents,
    };
    updateBatchMutation.mutate({ id: selectedBatch.id, data });
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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Batch Management</h1>
                <p className="mt-2 text-orange-100">Manage training batches</p>
              </div>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <button
                  onClick={() => navigate('/batches/create')}
                  className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                >
                  + Create Batch
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {isLoadingEditBatch && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <span>Loading batch details...</span>
              </div>
            )}
            {batches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No batches found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {batches.map((batch) => (
                  <div key={batch.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{batch.title}</h3>
                    {batch.software && (
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Software:</span> {batch.software}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Mode:</span> {batch.mode}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Start:</span> {new Date(batch.startDate).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">End:</span> {new Date(batch.endDate).toLocaleDateString()}
                    </p>
                    {batch.maxCapacity && (
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Capacity:</span> {batch.maxCapacity}
                      </p>
                    )}
                    {batch.status && (
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        batch.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {batch.status}
                      </span>
                    )}
                    <div className="mt-4 flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleView(batch)}
                        disabled={isLoadingEditBatch}
                        className={`px-3 py-1 bg-blue-500 text-white rounded text-sm transition-colors ${
                          isLoadingEditBatch
                            ? 'opacity-60 cursor-not-allowed'
                            : 'hover:bg-blue-600'
                        }`}
                        title="View Batch"
                      >
                        👁️ View
                      </button>
                      {(user?.role === 'admin' || user?.role === 'superadmin') && (
                        <>
                          <button
                            onClick={() => handleEdit(batch)}
                            disabled={isLoadingEditBatch}
                            className={`px-3 py-1 bg-orange-500 text-white rounded text-sm transition-colors ${
                              isLoadingEditBatch
                                ? 'opacity-60 cursor-not-allowed'
                                : 'hover:bg-orange-600'
                            }`}
                            title="Edit Batch"
                          >
                            {isLoadingEditBatch ? 'Loading...' : '✏️ Edit'}
                          </button>
                          <button
                            onClick={() => handleDelete(batch)}
                            className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
                            title="Delete Batch"
                          >
                            🗑️ Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Batch Modal */}
      {isEditModalOpen && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Edit Batch</h2>
            <form onSubmit={handleUpdateBatch}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    name="title"
                    defaultValue={selectedBatch.title}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Software</label>
                  <input
                    type="text"
                    name="software"
                    defaultValue={selectedBatch.software || ''}
                    placeholder="e.g., Adobe Photoshop, Figma"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode *</label>
                  <select
                    name="mode"
                    defaultValue={selectedBatch.mode}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                    <input
                      type="date"
                      name="startDate"
                      defaultValue={selectedBatch.startDate.split('T')[0]}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                    <input
                      type="date"
                      name="endDate"
                      defaultValue={selectedBatch.endDate.split('T')[0]}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Capacity</label>
                  <input
                    type="number"
                    name="maxCapacity"
                    min="1"
                    defaultValue={selectedBatch.maxCapacity || ''}
                    placeholder="e.g., 30"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={selectedBatch.status || 'active'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Faculty Assignment Section */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Assign Faculty <span className="text-red-500">*</span>
                </h3>
                <p className="text-sm text-gray-600 mb-4">Select at least one faculty member to assign to this batch</p>
                {facultyData?.data?.users && facultyData.data.users.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      No faculty members found. Please create faculty users first.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                      {isLoadingFaculty ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                          <span className="ml-2 text-sm text-gray-500">Loading faculty...</span>
                        </div>
                      ) : (facultyData?.data?.users || []).length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No active faculty members found</p>
                      ) : (
                        (facultyData?.data?.users || [])
                          .filter((fac: any) => fac.isActive !== false)
                          .map((fac: any) => (
                            <label key={fac.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedFaculty.includes(fac.id)}
                                onChange={() => handleToggleFaculty(fac.id)}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 mr-3"
                              />
                              <div>
                                <span className="font-medium">{fac.name}</span>
                                <span className="text-sm text-gray-600 ml-2">({fac.email})</span>
                                {fac.phone && (
                                  <span className="text-xs text-gray-500 ml-2">• {fac.phone}</span>
                                )}
                              </div>
                            </label>
                          ))
                      )}
                    </div>
                    {selectedFaculty.length > 0 ? (
                      <p className="mt-2 text-sm text-green-600 font-medium">
                        ✓ {selectedFaculty.length} faculty member(s) selected
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-red-600">
                        ⚠ Please select at least one faculty member
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Student Selection Section */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Students (Optional)</h3>
                <p className="text-sm text-gray-600 mb-4">Select students to enroll in this batch</p>
                {isLoadingStudents ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                    <span className="ml-2 text-sm text-gray-500">Loading students...</span>
                  </div>
                ) : !studentsData?.data?.students || studentsData.data.students.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No students available</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                    {studentsData.data.students.map((student) => {
                      const isChecked = selectedStudents.includes(student.id);
                      return (
                        <label
                          key={student.id}
                          className={`flex items-center p-2 rounded cursor-pointer ${
                            isChecked ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleStudent(student.id)}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 mr-3"
                          />
                          <div className="flex-1">
                            <span className="font-medium">{student.name}</span>
                            <span className="text-sm text-gray-600 ml-2">({student.email})</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                {selectedStudents.length > 0 && (
                  <p className="mt-2 text-sm text-green-600 font-medium">
                    ✓ {selectedStudents.length} student(s) selected
                  </p>
                )}
              </div>

              {/* Schedule Section */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Schedule (Optional)</h3>
                <p className="text-sm text-gray-600 mb-4">Select days and set start/end times for each day</p>
                
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToAll}
                      onChange={(e) => setApplyToAll(e.target.checked)}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      Apply same time to all selected days
                    </span>
                  </label>
                  <p className="ml-6 mt-1 text-xs text-gray-600">
                    When enabled, changing time on any day will update all selected days
                  </p>
                </div>
                
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = !!daySchedules[day];
                    const schedule = daySchedules[day] || { startTime: '', endTime: '' };
                    
                    return (
                      <div key={day} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleDayToggle(day)}
                              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">{day}</span>
                          </label>
                        </div>
                        
                        {isSelected && (
                          <div className="grid grid-cols-2 gap-3 mt-2 pl-6">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                                value={schedule.startTime}
                                onChange={(e) => handleTimeChange(day, 'startTime', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                End Time
                              </label>
                              <input
                                type="time"
                                value={schedule.endTime}
                                onChange={(e) => handleTimeChange(day, 'endTime', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={updateBatchMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {updateBatchMutation.isPending ? 'Updating...' : 'Update'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedBatch(null);
                    setDaySchedules({});
                    setApplyToAll(false);
                    setSelectedFaculty([]);
                    setSelectedStudents([]);
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
      {isDeleteModalOpen && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Batch</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete <strong>{selectedBatch.title}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmDelete}
                disabled={deleteBatchMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteBatchMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedBatch(null);
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
