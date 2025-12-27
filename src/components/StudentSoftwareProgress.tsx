import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentSoftwareProgressAPI, StudentSoftwareProgress } from '../api/studentSoftwareProgress.api';
import { useAuth } from '../context/AuthContext';

interface StudentSoftwareProgressProps {
  onClose?: () => void;
}

export const StudentSoftwareProgressComponent: React.FC<StudentSoftwareProgressProps> = ({ onClose: _onClose }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(100); // Increased for Excel-like view
  const [filterStudentId, setFilterStudentId] = useState<number | undefined>();
  const [filterStudentName, setFilterStudentName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterSoftwareName, setFilterSoftwareName] = useState('');
  const [filterSoftwareCode, setFilterSoftwareCode] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCourseName, setFilterCourseName] = useState('');
  const [filterCourseType, setFilterCourseType] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'detailed'>('detailed'); // New view mode
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: any[] } | null>(null);
  const [editingRecord, setEditingRecord] = useState<StudentSoftwareProgress | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Fetch records - fetch all for filtering (Excel-like)
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-software-progress', page, limit, filterStudentId, filterStudentName, filterPhone, filterSoftwareName, filterSoftwareCode, filterStatus, filterCourseName, filterCourseType],
    queryFn: () =>
      studentSoftwareProgressAPI.getAll({
        page: 1, // Get all for client-side filtering
        limit: 10000, // Large limit for Excel-like view
        studentId: filterStudentId,
        softwareName: filterSoftwareName || undefined,
        status: filterStatus || undefined,
        courseName: filterCourseName || undefined,
      }),
  });

  const records = data?.data?.records || [];

  // Client-side filtering for Excel-like experience
  const filteredRecords = React.useMemo(() => {
    if (!records || records.length === 0) return [];
    
    let filtered = [...records];
    
    if (filterStudentName) {
      filtered = filtered.filter(r => 
        r.student?.name?.toLowerCase().includes(filterStudentName.toLowerCase())
      );
    }
    
    if (filterPhone) {
      filtered = filtered.filter(r => 
        r.student?.phone?.includes(filterPhone)
      );
    }
    
    if (filterSoftwareCode) {
      filtered = filtered.filter(r => 
        r.softwareCode?.includes(filterSoftwareCode)
      );
    }
    
    if (filterCourseType) {
      filtered = filtered.filter(r => 
        r.courseType?.toLowerCase().includes(filterCourseType.toLowerCase())
      );
    }
    
    return filtered;
  }, [records, filterStudentName, filterPhone, filterSoftwareCode, filterCourseType]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => studentSoftwareProgressAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-software-progress'] });
      alert('Record deleted successfully');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete record');
    },
  });

  // Delete all mutation
  const deleteAllMutation = useMutation({
    mutationFn: () => studentSoftwareProgressAPI.deleteAll(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['student-software-progress'] });
      alert(data.message || `All ${data.deletedCount || 0} records deleted successfully`);
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete all records');
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: (file: File) => studentSoftwareProgressAPI.importExcel(file),
    onSuccess: (data) => {
      setImportResult(data.data);
      queryClient.invalidateQueries({ queryKey: ['student-software-progress'] });
      setIsImportModalOpen(false);
      setImportFile(null);
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to import Excel');
      setImporting(false);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => studentSoftwareProgressAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-software-progress'] });
      setIsEditModalOpen(false);
      setEditingRecord(null);
      alert('Record updated successfully');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update record');
    },
  });

  const handleImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!importFile) {
      alert('Please select a file');
      return;
    }
    setImporting(true);
    importMutation.mutate(importFile);
  };

  const handleDownloadTemplate = async () => {
    try {
      await studentSoftwareProgressAPI.downloadTemplate();
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.message || 'Failed to download template';
      alert(errorMessage);
      console.error('Download template error:', error);
    }
  };

  const handleExport = async () => {
    try {
      await studentSoftwareProgressAPI.exportExcel({
        studentId: filterStudentId,
        courseName: filterCourseName || undefined,
        status: filterStatus || undefined,
      });
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.message || 'Failed to export Excel';
      alert(errorMessage);
      console.error('Export error:', error);
    }
  };

  const handleEdit = (record: StudentSoftwareProgress) => {
    setEditingRecord(record);
    setIsEditModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingRecord) return;

    const formData = new FormData(e.currentTarget);
    const updateData: any = {
      softwareName: formData.get('softwareName') as string,
      status: formData.get('status') as string,
      courseName: formData.get('courseName') as string || null,
      courseType: formData.get('courseType') as string || null,
      studentStatus: formData.get('studentStatus') as string || null,
      batchTiming: formData.get('batchTiming') as string || null,
      notes: formData.get('notes') as string || null,
    };

    updateMutation.mutate({ id: editingRecord.id, data: updateData });
  };

  const allRecords = filteredRecords;

  // Group records by student
  const groupedByStudent = React.useMemo(() => {
    const grouped: Record<number, StudentSoftwareProgress[]> = {};
    allRecords.forEach((record) => {
      const studentId = record.studentId;
      if (!grouped[studentId]) {
        grouped[studentId] = [];
      }
      grouped[studentId].push(record);
    });
    return grouped;
  }, [allRecords]);

  const groupedRecords = React.useMemo(() => {
    return Object.values(groupedByStudent).map((studentRecords) => {
      const firstRecord = studentRecords[0];
      
      // Organize software by status
      const currentSoftware = studentRecords.filter(r => r.status === 'IP');
      const pendingSoftware = studentRecords.filter(r => r.status === 'XX');
      const finishedSoftware = studentRecords.filter(r => r.status === 'Finished');
      const notApplicableSoftware = studentRecords.filter(r => r.status === 'NO');
      
      return {
        studentId: firstRecord.studentId,
        student: firstRecord.student,
        courseName: firstRecord.courseName,
        courseType: firstRecord.courseType,
        enrollmentDate: firstRecord.enrollmentDate,
        softwareList: studentRecords,
        currentSoftware,
        pendingSoftware,
        finishedSoftware,
        notApplicableSoftware,
        totalSoftware: studentRecords.length,
      };
    });
  }, [groupedByStudent]);

  // For pagination - use grouped records for detailed view
  const paginatedGroupedRecords = React.useMemo(() => {
    const start = (page - 1) * limit;
    const end = start + limit;
    return groupedRecords.slice(start, end);
  }, [groupedRecords, page, limit]);
  
  const totalCount = viewMode === 'detailed' ? groupedRecords.length : allRecords.length;
  const totalPages = Math.ceil(totalCount / limit);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Finished':
        return 'bg-green-100 text-green-800';
      case 'IP':
        return 'bg-blue-100 text-blue-800';
      case 'NO':
        return 'bg-gray-100 text-gray-800';
      case 'XX':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Student Software Progress</h2>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            title="Download Excel import template"
          >
            📋 Download Template
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            📤 Import Excel
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            📥 Export Excel
          </button>
          {user?.role === 'superadmin' && (
            <button
              onClick={() => {
                const confirmMessage = `Are you sure you want to delete ALL ${totalCount} student software progress records?\n\nThis action cannot be undone!`;
                if (window.confirm(confirmMessage)) {
                  const doubleConfirm = window.confirm('This will permanently delete ALL records. Are you absolutely sure?');
                  if (doubleConfirm) {
                    deleteAllMutation.mutate();
                  }
                }
              }}
              disabled={deleteAllMutation.isPending || totalCount === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteAllMutation.isPending ? 'Deleting...' : '🗑️ Delete All'}
            </button>
          )}
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('detailed')}
            className={`px-4 py-2 rounded-md font-semibold transition-colors ${
              viewMode === 'detailed'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📊 Excel View (Detailed)
          </button>
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-4 py-2 rounded-md font-semibold transition-colors ${
              viewMode === 'grouped'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            👥 Grouped by Student
          </button>
        </div>
        <div className="text-sm text-gray-600">
          Total Records: <span className="font-semibold">{totalCount}</span>
        </div>
      </div>

      {/* Excel-like Filters */}
      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
          <h3 className="font-semibold text-gray-700">🔍 Filters</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Student ID</label>
              <input
                type="number"
                placeholder="ID"
                value={filterStudentId || ''}
                onChange={(e) => setFilterStudentId(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Student Name</label>
              <input
                type="text"
                placeholder="Name"
                value={filterStudentName}
                onChange={(e) => setFilterStudentName(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                placeholder="Phone"
                value={filterPhone}
                onChange={(e) => setFilterPhone(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Software Name</label>
              <input
                type="text"
                placeholder="Software"
                value={filterSoftwareName}
                onChange={(e) => setFilterSoftwareName(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Software Code</label>
              <input
                type="text"
                placeholder="Code"
                value={filterSoftwareCode}
                onChange={(e) => setFilterSoftwareCode(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="">All</option>
                <option value="XX">Not Started (XX)</option>
                <option value="IP">In Progress (IP)</option>
                <option value="NO">Not Applicable (NO)</option>
                <option value="Finished">Finished</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Course Name</label>
              <input
                type="text"
                placeholder="Course"
                value={filterCourseName}
                onChange={(e) => setFilterCourseName(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Course Type</label>
              <input
                type="text"
                placeholder="Type"
                value={filterCourseType}
                onChange={(e) => setFilterCourseType(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                setFilterStudentId(undefined);
                setFilterStudentName('');
                setFilterPhone('');
                setFilterSoftwareName('');
                setFilterSoftwareCode('');
                setFilterStatus('');
                setFilterCourseName('');
                setFilterCourseType('');
                setPage(1);
              }}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className={`p-4 rounded-lg ${importResult.failed > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
          <p className="font-semibold">
            Import Complete: {importResult.success} successful, {importResult.failed} failed
          </p>
          {importResult.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-gray-600">View Errors ({importResult.errors.length})</summary>
              <ul className="mt-2 text-sm space-y-1">
                {importResult.errors.slice(0, 10).map((error, idx) => (
                  <li key={idx} className="text-red-600">
                    Row {error.row}: {error.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading student software progress...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-600 font-semibold mb-2">Error loading data</div>
          <div className="text-sm text-gray-600">
            {error instanceof Error ? error.message : 'Please check your connection and try again'}
          </div>
        </div>
      ) : viewMode === 'detailed' ? (
        // Excel-like Detailed View - One row per student with all software
        groupedRecords.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No records found</div>
        ) : (
          <>
            <div className="overflow-x-auto border border-gray-300 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 bg-white">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      Student ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      Student Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      All Software
                      <div className="text-xs font-normal text-gray-500 mt-1">(Name - Code - Status)</div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      Course Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      Course Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      Student Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      Batch Timing
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      Enrollment Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Summary
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedGroupedRecords.map((groupedRecord) => {
                    // Organize software by status for summary
                    const currentCount = groupedRecord.currentSoftware.length;
                    const pendingCount = groupedRecord.pendingSoftware.length;
                    const finishedCount = groupedRecord.finishedSoftware.length;
                    const notApplicableCount = groupedRecord.notApplicableSoftware.length;
                    
                    return (
                      <tr key={groupedRecord.studentId} className="hover:bg-gray-50 border-b border-gray-200">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                          {groupedRecord.studentId}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                          {groupedRecord.student?.name || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border-r border-gray-200">
                          {groupedRecord.student?.phone || '-'}
                        </td>
                        <td className="px-4 py-3 border-r border-gray-200">
                          <div className="space-y-1 max-w-md">
                            {groupedRecord.softwareList.map((record) => (
                              <div
                                key={record.id}
                                className="flex items-center gap-2 text-xs"
                              >
                                <span className="font-medium text-gray-900">{record.softwareName}</span>
                                {record.softwareCode && (
                                  <span className="text-gray-500">({record.softwareCode})</span>
                                )}
                                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${getStatusColor(record.status)}`}>
                                  {record.status}
                                </span>
                                <button
                                  onClick={() => handleEdit(record)}
                                  className="text-blue-600 hover:text-blue-900 text-xs ml-auto"
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDelete(record.id)}
                                  className="text-red-600 hover:text-red-900 text-xs"
                                  title="Delete"
                                >
                                  🗑️
                                </button>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border-r border-gray-200">
                          {groupedRecord.courseName || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border-r border-gray-200">
                          {groupedRecord.courseType || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border-r border-gray-200">
                          {groupedRecord.softwareList[0]?.studentStatus || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border-r border-gray-200">
                          {groupedRecord.softwareList[0]?.batchTiming || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border-r border-gray-200">
                          {groupedRecord.enrollmentDate ? new Date(groupedRecord.enrollmentDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <span className="text-blue-600 font-semibold">{currentCount}</span>
                              <span className="text-gray-600">Current</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-yellow-600 font-semibold">{pendingCount}</span>
                              <span className="text-gray-600">Pending</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-green-600 font-semibold">{finishedCount}</span>
                              <span className="text-gray-600">Finished</span>
                            </div>
                            {notApplicableCount > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-600 font-semibold">{notApplicableCount}</span>
                                <span className="text-gray-600">N/A</span>
                              </div>
                            )}
                            <div className="pt-1 border-t border-gray-200 mt-1">
                              <span className="font-semibold text-gray-900">Total: {groupedRecord.totalSoftware}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : groupedRecords.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No records found</div>
      ) : (
        <>
          <div className="overflow-x-auto border border-gray-300 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 bg-white">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">
                    Software Status
                    <div className="text-xs font-normal text-gray-400 mt-1">
                      Current • Pending • Finished
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Course</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Enrollment Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groupedRecords.map((groupedRecord) => (
                  <tr key={groupedRecord.studentId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{groupedRecord.student?.name || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{groupedRecord.student?.phone || '-'}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Total: {groupedRecord.totalSoftware} software
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-3">
                        {/* Current Software (In Progress) */}
                        {groupedRecord.currentSoftware.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                🔵 CURRENT ({groupedRecord.currentSoftware.length})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {groupedRecord.currentSoftware.map((record) => (
                                <div
                                  key={record.id}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200"
                                >
                                  <div className="flex flex-col">
                                    <div className="text-sm font-medium text-gray-900">{record.softwareName}</div>
                                    {record.softwareCode && (
                                      <div className="text-xs text-gray-500">Code: {record.softwareCode}</div>
                                    )}
                                  </div>
                                  <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                                    IP
                                  </span>
                                  <button
                                    onClick={() => handleEdit(record)}
                                    className="ml-1 text-blue-600 hover:text-blue-900 text-xs"
                                    title="Edit"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDelete(record.id)}
                                    className="ml-1 text-red-600 hover:text-red-900 text-xs"
                                    title="Delete"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pending Software (Not Started) */}
                        {groupedRecord.pendingSoftware.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                                ⏳ PENDING ({groupedRecord.pendingSoftware.length})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {groupedRecord.pendingSoftware.map((record) => (
                                <div
                                  key={record.id}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-50 rounded-lg border border-yellow-200"
                                >
                                  <div className="flex flex-col">
                                    <div className="text-sm font-medium text-gray-900">{record.softwareName}</div>
                                    {record.softwareCode && (
                                      <div className="text-xs text-gray-500">Code: {record.softwareCode}</div>
                                    )}
                                  </div>
                                  <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
                                    XX
                                  </span>
                                  <button
                                    onClick={() => handleEdit(record)}
                                    className="ml-1 text-blue-600 hover:text-blue-900 text-xs"
                                    title="Edit"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDelete(record.id)}
                                    className="ml-1 text-red-600 hover:text-red-900 text-xs"
                                    title="Delete"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Finished Software */}
                        {groupedRecord.finishedSoftware.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">
                                ✅ FINISHED ({groupedRecord.finishedSoftware.length})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {groupedRecord.finishedSoftware.map((record) => (
                                <div
                                  key={record.id}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200"
                                >
                                  <div className="flex flex-col">
                                    <div className="text-sm font-medium text-gray-900">{record.softwareName}</div>
                                    {record.softwareCode && (
                                      <div className="text-xs text-gray-500">Code: {record.softwareCode}</div>
                                    )}
                                  </div>
                                  <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                                    Finished
                                  </span>
                                  <button
                                    onClick={() => handleEdit(record)}
                                    className="ml-1 text-blue-600 hover:text-blue-900 text-xs"
                                    title="Edit"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDelete(record.id)}
                                    className="ml-1 text-red-600 hover:text-red-900 text-xs"
                                    title="Delete"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Not Applicable Software */}
                        {groupedRecord.notApplicableSoftware.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-gray-700 bg-gray-50 px-2 py-1 rounded">
                                ❌ NOT APPLICABLE ({groupedRecord.notApplicableSoftware.length})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {groupedRecord.notApplicableSoftware.map((record) => (
                                <div
                                  key={record.id}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200"
                                >
                                  <div className="flex flex-col">
                                    <div className="text-sm font-medium text-gray-900">{record.softwareName}</div>
                                    {record.softwareCode && (
                                      <div className="text-xs text-gray-500">Code: {record.softwareCode}</div>
                                    )}
                                  </div>
                                  <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                                    NO
                                  </span>
                                  <button
                                    onClick={() => handleEdit(record)}
                                    className="ml-1 text-blue-600 hover:text-blue-900 text-xs"
                                    title="Edit"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDelete(record.id)}
                                    className="ml-1 text-red-600 hover:text-red-900 text-xs"
                                    title="Delete"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* No Software Message */}
                        {groupedRecord.totalSoftware === 0 && (
                          <div className="text-sm text-gray-400 italic">No software assigned</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{groupedRecord.courseName || '-'}</div>
                      {groupedRecord.courseType && <div className="text-xs text-gray-500">{groupedRecord.courseType}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {groupedRecord.enrollmentDate ? new Date(groupedRecord.enrollmentDate).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 bg-gray-50 p-4 rounded-lg border border-gray-300">
              <div className="text-sm text-gray-700">
                Showing <span className="font-semibold">{(page - 1) * limit + 1}</span> to <span className="font-semibold">{Math.min(page * limit, totalCount)}</span> of <span className="font-semibold">{totalCount}</span> records
                {viewMode === 'grouped' && (
                  <span className="ml-2 text-gray-500">({groupedRecords.length} unique students)</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 bg-white"
                >
                  ← Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 bg-white"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Import Excel</h3>
            <form onSubmit={handleImport}>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="mb-4 w-full"
                required
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                    setImportResult(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing || !importFile}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
                >
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Edit Record</h3>
            <form onSubmit={handleUpdate}>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Software Name</label>
                  <input
                    type="text"
                    name="softwareName"
                    defaultValue={editingRecord.softwareName}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    name="status"
                    defaultValue={editingRecord.status}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="XX">Not Started</option>
                    <option value="IP">In Progress</option>
                    <option value="NO">Not Applicable</option>
                    <option value="Finished">Finished</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Course Name</label>
                  <input
                    type="text"
                    name="courseName"
                    defaultValue={editingRecord.courseName || ''}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Course Type</label>
                  <input
                    type="text"
                    name="courseType"
                    defaultValue={editingRecord.courseType || ''}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Student Status</label>
                  <input
                    type="text"
                    name="studentStatus"
                    defaultValue={editingRecord.studentStatus || ''}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Batch Timing</label>
                  <input
                    type="text"
                    name="batchTiming"
                    defaultValue={editingRecord.batchTiming || ''}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    name="notes"
                    defaultValue={editingRecord.notes || ''}
                    rows={3}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingRecord(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
