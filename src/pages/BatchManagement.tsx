import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { batchAPI, Batch } from '../api/batch.api';
import { reportAPI } from '../api/report.api';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

export const BatchManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'batches' | 'available-students' | 'enrolled-not-started' | 'multiple-courses' | 'on-leave'>('batches');
  const [batchStatusFilter, setBatchStatusFilter] = useState<'all' | 'past' | 'current' | 'complete'>('all');

  // Fetch batches
  const { data: batchesData, isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });


  // Fetch students without batch
  const { data: availableStudentsData, isLoading: isLoadingAvailableStudents } = useQuery({
    queryKey: ['students-without-batch'],
    queryFn: () => reportAPI.getStudentsWithoutBatch(),
  });

  // Fetch students enrolled but batch not started
  const { data: enrolledNotStartedData, isLoading: isLoadingEnrolledNotStarted } = useQuery({
    queryKey: ['students-enrolled-batch-not-started'],
    queryFn: () => reportAPI.getStudentsEnrolledBatchNotStarted(),
  });

  // Fetch students with multiple courses conflict
  const { data: multipleCoursesData, isLoading: isLoadingMultipleCourses } = useQuery({
    queryKey: ['students-multiple-courses-conflict'],
    queryFn: () => reportAPI.getStudentsMultipleCoursesConflict(),
  });

  // Fetch students on leave with pending batches
  const { data: onLeaveData, isLoading: isLoadingOnLeave } = useQuery({
    queryKey: ['students-on-leave-pending-batches'],
    queryFn: () => reportAPI.getStudentsOnLeavePendingBatches(),
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

  const allBatches = batchesData?.data || [];
  const [batchSearchQuery, setBatchSearchQuery] = useState('');

  // Filter batches based on status filter and search query
  const batches = allBatches.filter((batch) => {
    // First filter by status (past, current, complete)
    if (batchStatusFilter !== 'all') {
      const startDate = new Date(batch.startDate);
      const endDate = new Date(batch.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      const isCompleted = endDate < today;
      const isOngoing = startDate <= today && endDate >= today;
      
      if (batchStatusFilter === 'past') {
        // Past batches: endDate < today
        if (!isCompleted) return false;
      } else if (batchStatusFilter === 'current') {
        // Current/Ongoing batches: startDate <= today && endDate >= today
        if (!isOngoing) return false;
      } else if (batchStatusFilter === 'complete') {
        // Complete batches: endDate < today (same as past)
        if (!isCompleted) return false;
      }
    }
    
    // Then filter by search query
    if (!batchSearchQuery.trim()) return true;
    const query = batchSearchQuery.toLowerCase();
    return (
      batch.title?.toLowerCase().includes(query) ||
      batch.software?.toLowerCase().includes(query) ||
      batch.mode?.toLowerCase().includes(query) ||
      batch.status?.toLowerCase().includes(query)
    );
  });

  const handleDownloadBatchesCSV = () => {
    if (batches.length === 0) {
      alert('No batches to export');
      return;
    }

    // CSV Headers
    const headers = [
      'Batch ID',
      'Title',
      'Course',
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
      
      // Normalize dates to midnight for proper comparison
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      const isCompleted = endDate < today;
      // Fixed: If start date is today or earlier AND end date is today or later, it's ongoing
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
        batch.course?.name || '',
        batch.software || '',
        batch.mode || '',
        scheduleText,
        formatDateDDMMYYYY(startDate),
        formatDateDDMMYYYY(endDate),
        durationDays,
        status,
        batch.maxCapacity || '',
        batch.enrollments?.length || 0,
        studentNames,
        studentEmails,
        batch.assignedFaculty?.length || 0,
        facultyNames,
        batch.createdAt ? formatDateDDMMYYYY(batch.createdAt) : ''
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
      ['Batch', 'Start Date', formatDateDDMMYYYY(batch.startDate)],
      ['Batch', 'End Date', formatDateDDMMYYYY(batch.endDate)],
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

  const handleEdit = (batch: Batch) => {
    navigate(`/batches/${batch.id}/edit`);
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

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 md:px-8 py-4 md:py-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Batch Management</h1>
                <p className="mt-2 text-sm md:text-base text-orange-100">Manage training batches</p>
              </div>
              <div className="flex flex-wrap gap-2 md:gap-3 w-full lg:w-auto">
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

          <div className="p-4 md:p-6">
            {/* Tabs */}
            <div className="mb-4 md:mb-6 border-b border-gray-200">
              <nav className="-mb-px flex space-x-2 md:space-x-4 overflow-x-auto">
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


            {activeTab === 'batches' && (
              <>
                {/* Batch Status Filter Tabs */}
                <div className="mb-4 border-b border-gray-200">
                  <nav className="-mb-px flex space-x-2 md:space-x-4 overflow-x-auto">
                    <button
                      onClick={() => setBatchStatusFilter('all')}
                      className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                        batchStatusFilter === 'all'
                          ? 'border-orange-500 text-orange-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      All Batches ({allBatches.length})
                    </button>
                    <button
                      onClick={() => setBatchStatusFilter('past')}
                      className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                        batchStatusFilter === 'past'
                          ? 'border-orange-500 text-orange-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Past ({allBatches.filter((b) => {
                        const endDate = new Date(b.endDate);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        endDate.setHours(0, 0, 0, 0);
                        return endDate < today;
                      }).length})
                    </button>
                    <button
                      onClick={() => setBatchStatusFilter('current')}
                      className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                        batchStatusFilter === 'current'
                          ? 'border-orange-500 text-orange-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Current/Ongoing ({allBatches.filter((b) => {
                        const startDate = new Date(b.startDate);
                        const endDate = new Date(b.endDate);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        startDate.setHours(0, 0, 0, 0);
                        endDate.setHours(0, 0, 0, 0);
                        return startDate <= today && endDate >= today;
                      }).length})
                    </button>
                    <button
                      onClick={() => setBatchStatusFilter('complete')}
                      className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                        batchStatusFilter === 'complete'
                          ? 'border-orange-500 text-orange-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Complete ({allBatches.filter((b) => {
                        const endDate = new Date(b.endDate);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        endDate.setHours(0, 0, 0, 0);
                        return endDate < today;
                      }).length})
                    </button>
                  </nav>
                </div>

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
                      placeholder="Search batches by title, software, mode, or status..."
                      value={batchSearchQuery}
                      onChange={(e) => setBatchSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    {batchSearchQuery && (
                      <button
                        onClick={() => setBatchSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {(batchSearchQuery || batchStatusFilter !== 'all') && (
                    <p className="mt-2 text-sm text-gray-600">
                      Showing {batches.length} of {allBatches.length} batches
                      {batchStatusFilter !== 'all' && (
                        <span className="ml-2 text-orange-600">
                          (Filtered: {batchStatusFilter === 'past' ? 'Past' : batchStatusFilter === 'current' ? 'Current/Ongoing' : 'Complete'})
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {batches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  {batchSearchQuery ? 'No batches found matching your search' : 'No batches found'}
                </p>
                {batchSearchQuery && (
                  <button
                    onClick={() => setBatchSearchQuery('')}
                    className="mt-2 text-orange-600 hover:text-orange-700 text-sm"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle sm:px-0">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          S.No
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Batch Title
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                          Course
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                          Software
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                          Mode
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                          Schedule/Time
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Start Date
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                          End Date
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                          Capacity
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                          Students
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {batches.map((batch, index) => {
                        const startDate = new Date(batch.startDate);
                        const endDate = new Date(batch.endDate);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        // Normalize dates to midnight for proper comparison
                        startDate.setHours(0, 0, 0, 0);
                        endDate.setHours(0, 0, 0, 0);
                        
                        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const isCompleted = endDate < today;
                        // Fixed: If start date is today or earlier AND end date is today or later, it's ongoing
                        const isOngoing = startDate <= today && endDate >= today;
                        const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                        
                        return (
                          <tr key={batch.id} className="hover:bg-gray-50">
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                              <div className="text-xs sm:text-sm font-medium text-gray-900">{index + 1}</div>
                            </td>
                            <td className="px-3 sm:px-6 py-4">
                              <div className="text-xs sm:text-sm font-medium text-gray-900">{batch.title}</div>
                              <div className="text-xs text-gray-500 md:hidden mt-1">
                                {batch.course?.name || '-'} • {batch.software || '-'} • {batch.mode || '-'}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                              <div className="text-xs sm:text-sm font-medium text-gray-900">
                                {batch.course?.name || '-'}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                              <div className="text-xs sm:text-sm text-gray-500">{batch.software || '-'}</div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <div className="text-xs sm:text-sm text-gray-500 capitalize">{batch.mode || '-'}</div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 hidden xl:table-cell">
                              {batch.schedule && (Array.isArray(batch.schedule) ? batch.schedule.length > 0 : Object.keys(batch.schedule).length > 0) ? (
                                <div className="text-xs text-gray-600 space-y-1 max-w-xs">
                                  {(() => {
                                    const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                                    
                                    // Handle array format (numeric indices)
                                    if (Array.isArray(batch.schedule)) {
                                      const scheduleEntries = batch.schedule
                                        .map((item: any, index: number) => {
                                          if (item && typeof item === 'object' && item.startTime) {
                                            return {
                                              day: item.day || DAYS_OF_WEEK[index] || `Day ${index + 1}`,
                                              times: item
                                            };
                                          }
                                          return null;
                                        })
                                        .filter((item): item is { day: string; times: any } => item !== null && item.times && item.times.startTime);
                                      
                                      return scheduleEntries.slice(0, 3).map(({ day, times }) => (
                                        <div key={day} className="truncate">
                                          {day.substring(0, 3)}: {times.startTime} - {times.endTime}
                                        </div>
                                      ));
                                    }
                                    
                                    // Handle object format with day names as keys
                                    const scheduleObj = batch.schedule as Record<string, { startTime: string; endTime: string }>;
                                    
                                    // Sort schedule by day order (Monday through Sunday)
                                    const sortedSchedule = DAYS_OF_WEEK
                                      .filter(day => scheduleObj[day] && scheduleObj[day].startTime)
                                      .map(day => ({
                                        day,
                                        times: scheduleObj[day]
                                      }));
                                    
                                    // If no matches with standard day names, try to map numeric keys to days
                                    const scheduleEntries = sortedSchedule.length > 0 
                                      ? sortedSchedule 
                                      : Object.entries(scheduleObj)
                                          .filter(([_, times]) => times && times.startTime)
                                          .map(([day, times]) => {
                                            const dayIndex = parseInt(day);
                                            if (!isNaN(dayIndex) && dayIndex >= 0 && dayIndex < DAYS_OF_WEEK.length) {
                                              return {
                                                day: DAYS_OF_WEEK[dayIndex],
                                                times
                                              };
                                            }
                                            return { day, times };
                                          });
                                    
                                    return scheduleEntries.slice(0, 3).map(({ day, times }: { day: string; times: any }) => (
                                      <div key={day} className="truncate">
                                        {day.substring(0, 3)}: {times.startTime} - {times.endTime}
                                      </div>
                                    ));
                                  })()}
                                  {(Array.isArray(batch.schedule) ? batch.schedule.length : Object.keys(batch.schedule).length) > 3 && (
                                    <div className="text-gray-500 italic">
                                      + {(Array.isArray(batch.schedule) ? batch.schedule.length : Object.keys(batch.schedule).length) - 3} more days
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs sm:text-sm text-gray-400">No schedule</div>
                              )}
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                              <div className="text-xs sm:text-sm font-medium text-gray-900">
                                {formatDateDDMMYYYY(startDate)}
                              </div>
                              <div className="text-xs text-gray-500 lg:hidden mt-1">
                                End: {formatDateDDMMYYYY(endDate)}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <div className="text-xs sm:text-sm font-medium text-gray-900">
                                {formatDateDDMMYYYY(endDate)}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4">
                              <div className="text-xs sm:text-sm text-gray-500">
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
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
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
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                              <div className="text-xs sm:text-sm text-gray-500">
                                {batch.enrollments?.length || 0} / {batch.maxCapacity || '-'}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 hidden xl:table-cell">
                              {batch.enrollments && batch.enrollments.length > 0 ? (
                                <div className="max-w-xs">
                                  <div className="text-xs sm:text-sm text-gray-900 font-medium mb-1">
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
                                <div className="text-xs sm:text-sm text-gray-400">No students enrolled</div>
                              )}
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                              <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                                <button
                                  onClick={() => handleView(batch)}
                                  className="px-2 sm:px-3 py-1 bg-blue-500 text-white rounded text-xs transition-colors hover:bg-blue-600"
                                  title="View Batch"
                                >
                                  View
                                </button>
                                {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                  <>
                                    <button
                                      onClick={() => handleEdit(batch)}
                                      className="px-2 sm:px-3 py-1 bg-orange-500 text-white rounded text-xs transition-colors hover:bg-orange-600"
                                      title="Edit Batch"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDelete(batch)}
                                      className="px-2 sm:px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
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
                ) : !availableStudentsData?.data?.students || availableStudentsData.data.students.length === 0 ? (
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
                        {availableStudentsData?.data?.students?.map((student) => (
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
                                {formatDateDDMMYYYY(student.createdAt)}
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
                ) : !enrolledNotStartedData?.data?.students || enrolledNotStartedData.data.students.length === 0 ? (
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
                        {enrolledNotStartedData?.data?.students?.map((student) => (
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
                              <div className="text-sm text-gray-900">{formatDateDDMMYYYY(student.batch.startDate)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{formatDateDDMMYYYY(student.enrollmentDate)}</div>
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
                ) : !multipleCoursesData?.data?.students || multipleCoursesData.data.students.length === 0 ? (
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
                        {multipleCoursesData?.data?.students?.map((student) => (
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
                                      {formatDateDDMMYYYY(batch.startDate)} - {formatDateDDMMYYYY(batch.endDate)}
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
                ) : !onLeaveData?.data?.students || onLeaveData.data.students.length === 0 ? (
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
                        {onLeaveData?.data?.students?.map((student) => (
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
                                      {formatDateDDMMYYYY(leave.startDate)} - {formatDateDDMMYYYY(leave.endDate)}
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
                                      {formatDateDDMMYYYY(batch.startDate)} - {formatDateDDMMYYYY(batch.endDate)}
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

      {/* Edit Batch Modal - Removed - Now using dedicated page at /batches/:id/edit */}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Batch</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete <strong>{selectedBatch.title}</strong>? This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleConfirmDelete}
                disabled={deleteBatchMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                {deleteBatchMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedBatch(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors text-sm sm:text-base"
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
