import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { batchAPI, Batch, UpdateBatchRequest } from '../api/batch.api';
import { facultyAPI } from '../api/faculty.api';
import { studentAPI } from '../api/student.api';
import { reportAPI } from '../api/report.api';

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
  const [activeTab, setActiveTab] = useState<'batches' | 'available-students' | 'enrolled-not-started' | 'multiple-courses' | 'on-leave'>('batches');

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

  // Fetch students without batch
  const { data: availableStudentsData, isLoading: isLoadingAvailableStudents } = useQuery({
    queryKey: ['students-without-batch'],
    queryFn: () => reportAPI.getStudentsWithoutBatch(),
    enabled: activeTab === 'available-students',
  });

  // Fetch students enrolled but batch not started
  const { data: enrolledNotStartedData, isLoading: isLoadingEnrolledNotStarted } = useQuery({
    queryKey: ['students-enrolled-batch-not-started'],
    queryFn: () => reportAPI.getStudentsEnrolledBatchNotStarted(),
    enabled: activeTab === 'enrolled-not-started',
  });

  // Fetch students with multiple courses conflict
  const { data: multipleCoursesData, isLoading: isLoadingMultipleCourses } = useQuery({
    queryKey: ['students-multiple-courses-conflict'],
    queryFn: () => reportAPI.getStudentsMultipleCoursesConflict(),
    enabled: activeTab === 'multiple-courses',
  });

  // Fetch students on leave with pending batches
  const { data: onLeaveData, isLoading: isLoadingOnLeave } = useQuery({
    queryKey: ['students-on-leave-pending-batches'],
    queryFn: () => reportAPI.getStudentsOnLeavePendingBatches(),
    enabled: activeTab === 'on-leave',
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

  const handleDownloadBatchesCSV = () => {
    if (batches.length === 0) {
      alert('No batches to export');
      return;
    }

    // CSV Headers
    const headers = [
      'Batch ID',
      'Title',
      'Software',
      'Mode',
      'Schedule',
      'Start Date',
      'End Date',
      'Duration (Days)',
      'Status',
      'Capacity',
      'Enrolled Students',
      'Student Names',
      'Student Emails',
      'Faculty Count',
      'Faculty Names',
      'Created Date'
    ];

    // CSV Rows
    const rows = batches.map((batch) => {
      const startDate = new Date(batch.startDate);
      const endDate = new Date(batch.endDate);
      const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isCompleted = endDate < today;
      const isOngoing = startDate <= today && endDate >= today;
      const status = isCompleted ? 'Completed' : isOngoing ? 'Ongoing' : 'Upcoming';
      
      const facultyNames = batch.assignedFaculty && batch.assignedFaculty.length > 0
        ? batch.assignedFaculty.map((f: any) => f.name).join('; ')
        : '-';

      const studentNames = batch.enrollments && batch.enrollments.length > 0
        ? batch.enrollments.map((enrollment: any) => {
            return enrollment.student?.name || enrollment.name || 'Unknown';
          }).join('; ')
        : '-';

      const studentEmails = batch.enrollments && batch.enrollments.length > 0
        ? batch.enrollments.map((enrollment: any) => {
            return enrollment.student?.email || enrollment.email || '';
          }).filter((email: string) => email).join('; ')
        : '-';

      const scheduleText = batch.schedule && Object.keys(batch.schedule).length > 0
        ? Object.entries(batch.schedule).map(([day, times]: [string, any]) => 
            `${day}: ${times.startTime}-${times.endTime}`
          ).join('; ')
        : '-';

      return [
        batch.id,
        batch.title || '',
        batch.software || '',
        batch.mode || '',
        scheduleText,
        startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        durationDays,
        status,
        batch.maxCapacity || '',
        batch.enrollments?.length || 0,
        studentNames,
        studentEmails,
        batch.assignedFaculty?.length || 0,
        facultyNames,
        batch.createdAt ? new Date(batch.createdAt).toLocaleDateString() : ''
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batches_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Unused function - kept for future use
  /*
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
  */

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
              <div className="flex gap-3">
                {batches.length > 0 && (
                  <button
                    onClick={handleDownloadBatchesCSV}
                    className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors flex items-center gap-2"
                    title="Download all batches as CSV"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download CSV
                  </button>
                )}
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
          </div>

          <div className="p-6">
            {/* Tabs */}
            <div className="mb-6 border-b border-gray-200">
              <nav className="-mb-px flex space-x-4 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('batches')}
                  className={`py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === 'batches'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  All Batches ({batches.length})
                </button>
                <button
                  onClick={() => setActiveTab('available-students')}
                  className={`py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === 'available-students'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Available Students ({availableStudentsData?.data.totalCount || 0})
                </button>
                <button
                  onClick={() => setActiveTab('enrolled-not-started')}
                  className={`py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === 'enrolled-not-started'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Enrolled - Batch Not Started ({enrolledNotStartedData?.data.totalCount || 0})
                </button>
                <button
                  onClick={() => setActiveTab('multiple-courses')}
                  className={`py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === 'multiple-courses'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Multiple Courses Conflict ({multipleCoursesData?.data.totalCount || 0})
                </button>
                <button
                  onClick={() => setActiveTab('on-leave')}
                  className={`py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === 'on-leave'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  On Leave - Pending Batches ({onLeaveData?.data.totalCount || 0})
                </button>
              </nav>
            </div>

            {isLoadingEditBatch && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <span>Loading batch details...</span>
              </div>
            )}

            {activeTab === 'batches' && (
              <>
                {batches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No batches found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Batch Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Software
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mode
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Schedule/Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Start Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        End Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Capacity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Students
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {batches.map((batch) => {
                      const startDate = new Date(batch.startDate);
                      const endDate = new Date(batch.endDate);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const isCompleted = endDate < today;
                      const isOngoing = startDate <= today && endDate >= today;
                      const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                      
                      return (
                        <tr key={batch.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{batch.title}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{batch.software || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500 capitalize">{batch.mode || '-'}</div>
                          </td>
                          <td className="px-6 py-4">
                            {batch.schedule && Object.keys(batch.schedule).length > 0 ? (
                              <div className="text-xs text-gray-600 space-y-1 max-w-xs">
                                {Object.entries(batch.schedule).slice(0, 3).map(([day, times]: [string, any]) => (
                                  <div key={day} className="truncate">
                                    {day.substring(0, 3)}: {times.startTime} - {times.endTime}
                                  </div>
                                ))}
                                {Object.keys(batch.schedule).length > 3 && (
                                  <div className="text-gray-500 italic">
                                    + {Object.keys(batch.schedule).length - 3} more days
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">No schedule</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {startDate.toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {startDate.toLocaleDateString('en-US', { weekday: 'short' })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {endDate.toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {endDate.toLocaleDateString('en-US', { weekday: 'short' })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {durationDays} {durationDays === 1 ? 'day' : 'days'}
                            </div>
                            {isOngoing && (
                              <div className="text-xs text-blue-600 font-medium">
                                {daysRemaining > 0 ? `${daysRemaining} days left` : 'Ends today'}
                              </div>
                            )}
                            {isCompleted && (
                              <div className="text-xs text-gray-500">
                                Completed
                              </div>
                            )}
                            {!isOngoing && !isCompleted && (
                              <div className="text-xs text-orange-600 font-medium">
                                Starts in {Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))} days
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              isCompleted 
                                ? 'bg-gray-100 text-gray-800' 
                                : isOngoing 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {isCompleted ? 'Completed' : isOngoing ? 'Ongoing' : 'Upcoming'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {batch.enrollments?.length || 0} / {batch.maxCapacity || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {batch.enrollments && batch.enrollments.length > 0 ? (
                              <div className="max-w-xs">
                                <div className="text-sm text-gray-900 font-medium mb-1">
                                  {batch.enrollments.length} student{batch.enrollments.length !== 1 ? 's' : ''}
                                </div>
                                <div className="text-xs text-gray-600 space-y-1">
                                  {batch.enrollments.slice(0, 3).map((enrollment: any, idx: number) => {
                                    const studentName = enrollment.student?.name || enrollment.name || `Student ${idx + 1}`;
                                    const studentEmail = enrollment.student?.email || enrollment.email || '';
                                    return (
                                      <div key={enrollment.id || enrollment.student?.id || idx} className="truncate" title={`${studentName}${studentEmail ? ` (${studentEmail})` : ''}`}>
                                        • {studentName}
                                      </div>
                                    );
                                  })}
                                  {batch.enrollments.length > 3 && (
                                    <div className="text-gray-500 italic">
                                      + {batch.enrollments.length - 3} more
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">No students enrolled</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleView(batch)}
                                disabled={isLoadingEditBatch}
                                className={`px-3 py-1 bg-blue-500 text-white rounded text-xs transition-colors ${
                                  isLoadingEditBatch
                                    ? 'opacity-60 cursor-not-allowed'
                                    : 'hover:bg-blue-600'
                                }`}
                                title="View Batch"
                              >
                                View
                              </button>
                              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                <>
                                  <button
                                    onClick={() => handleEdit(batch)}
                                    disabled={isLoadingEditBatch}
                                    className={`px-3 py-1 bg-orange-500 text-white rounded text-xs transition-colors ${
                                      isLoadingEditBatch
                                        ? 'opacity-60 cursor-not-allowed'
                                        : 'hover:bg-orange-600'
                                    }`}
                                    title="Edit Batch"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(batch)}
                                    className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                                    title="Delete Batch"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
                )}
              </>
            )}

            {activeTab === 'available-students' && (
              <>
                {isLoadingAvailableStudents ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Loading available students...</p>
                  </div>
                ) : availableStudentsData?.data.students.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">All students are enrolled in batches</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Previous Enrollments
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Registered Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {availableStudentsData?.data.students.map((student) => (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{student.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{student.phone || '-'}</div>
                            </td>
                            <td className="px-6 py-4">
                              {student.enrollments && student.enrollments.length > 0 ? (
                                <div className="text-xs text-gray-600">
                                  {student.enrollments.map((enrollment: any, idx: number) => {
                                    const batch = enrollment.batch;
                                    if (!batch) return null;
                                    return (
                                      <div key={idx} className="mb-1">
                                        {batch.title} ({batch.status || 'ended'})
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-400">No previous enrollments</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '-'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-4 text-sm text-gray-600">
                      Total: {availableStudentsData?.data.totalCount || 0} students available for enrollment
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'enrolled-not-started' && (
              <>
                {isLoadingEnrolledNotStarted ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Loading students...</p>
                  </div>
                ) : enrolledNotStartedData?.data.students.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No students found enrolled in batches that haven't started yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> These students are enrolled but their batch start date is in the future. They are waiting for their batch to begin.
                      </p>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch Start Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrollment Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {enrolledNotStartedData?.data.students.map((student) => (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{student.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{student.phone || '-'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{student.batch.title}</div>
                              <div className="text-xs text-gray-500">{student.batch.software || 'N/A'} • {student.batch.mode}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{new Date(student.batch.startDate).toLocaleDateString()}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{new Date(student.enrollmentDate).toLocaleDateString()}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-4 text-sm text-gray-600">
                      Total: {enrolledNotStartedData?.data.totalCount || 0} students waiting for batch to start
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'multiple-courses' && (
              <>
                {isLoadingMultipleCourses ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Loading students...</p>
                  </div>
                ) : multipleCoursesData?.data.students.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No students found with multiple course enrollments</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> These students are enrolled in 2 or more courses. Some may have time conflicts or overlapping schedules.
                      </p>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Enrollments</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Running Batches</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Future Batches</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Conflict</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batches</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {multipleCoursesData?.data.students.map((student) => (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{student.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{student.totalEnrollments}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                {student.runningBatches}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                {student.futureBatches}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {student.hasTimeConflict ? (
                                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Yes</span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">No</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-xs space-y-1 max-w-md">
                                {student.batches.map((batch, idx) => (
                                  <div key={batch.id || idx} className="p-2 bg-gray-50 rounded border border-gray-200">
                                    <div className="font-medium text-gray-900">{batch.title}</div>
                                    <div className="text-gray-600">{batch.software || 'N/A'} • {batch.mode}</div>
                                    <div className="text-gray-500 text-xs mt-1">
                                      {new Date(batch.startDate).toLocaleDateString()} - {new Date(batch.endDate).toLocaleDateString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-4 text-sm text-gray-600">
                      Total: {multipleCoursesData?.data.totalCount || 0} students with multiple course enrollments
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'on-leave' && (
              <>
                {isLoadingOnLeave ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Loading students...</p>
                  </div>
                ) : onLeaveData?.data.students.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No students found on leave with pending batches</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-800">
                        <strong>Note:</strong> These students are on approved leave but have other batches that need to be allocated or are currently running.
                      </p>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leaves</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Batches</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {onLeaveData?.data.students.map((student) => (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{student.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{student.phone || '-'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-xs space-y-1 max-w-xs">
                                {student.leaves.map((leave) => (
                                  <div key={leave.id} className="p-2 bg-blue-50 rounded border border-blue-200">
                                    <div className="font-medium text-gray-900">{leave.batchTitle}</div>
                                    <div className="text-gray-600 text-xs">
                                      {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                                    </div>
                                    {leave.reason && (
                                      <div className="text-gray-500 text-xs mt-1">Reason: {leave.reason}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-xs space-y-1 max-w-md">
                                {student.pendingBatches.map((batch) => (
                                  <div key={batch.id} className={`p-2 rounded border ${batch.isRunning ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                                    <div className="font-medium text-gray-900">{batch.title}</div>
                                    <div className="text-gray-600">{batch.software || 'N/A'} • {batch.mode}</div>
                                    <div className="text-gray-500 text-xs mt-1">
                                      {new Date(batch.startDate).toLocaleDateString()} - {new Date(batch.endDate).toLocaleDateString()}
                                    </div>
                                    {batch.isRunning && (
                                      <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded">
                                        Currently Running
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-4 text-sm text-gray-600">
                      Total: {onLeaveData?.data.totalCount || 0} students on leave with pending batches
                    </div>
                  </div>
                )}
              </>
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
