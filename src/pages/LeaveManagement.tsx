import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { studentLeaveAPI, CreateLeaveRequest as CreateStudentLeaveRequest, LeaveStatus } from '../api/studentLeave.api';
import { employeeLeaveAPI, CreateEmployeeLeaveRequest } from '../api/employeeLeave.api';
import { facultyLeaveAPI, CreateFacultyLeaveRequest } from '../api/facultyLeave.api';
import { batchAPI } from '../api/batch.api';
import { userAPI } from '../api/user.api';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

type LeaveType = 'student' | 'employee' | 'faculty';

export const LeaveManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<LeaveType>(() => {
    // Set default tab based on user role
    if (currentUser?.role === 'student') return 'student';
    if (currentUser?.role === 'employee') return 'employee';
    if (currentUser?.role === 'faculty') return 'faculty';
    return 'student'; // Default for admin/superadmin
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'all'>('all');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Fetch student leaves
  const { data: studentLeavesData, isLoading: isLoadingStudent } = useQuery({
    queryKey: ['student-leaves', statusFilter],
    queryFn: () => studentLeaveAPI.getLeaves(statusFilter !== 'all' ? { status: statusFilter } : {}),
    enabled: activeTab === 'student' || currentUser?.role === 'admin' || currentUser?.role === 'superadmin',
  });

  // Fetch employee leaves
  const { data: employeeLeavesData, isLoading: isLoadingEmployee } = useQuery({
    queryKey: ['employee-leaves', statusFilter],
    queryFn: () => employeeLeaveAPI.getLeaves(statusFilter !== 'all' ? { status: statusFilter } : {}),
    enabled: activeTab === 'employee' || currentUser?.role === 'admin' || currentUser?.role === 'superadmin',
  });

  // Fetch faculty leaves
  const { data: facultyLeavesData, isLoading: isLoadingFaculty } = useQuery({
    queryKey: ['faculty-leaves', statusFilter],
    queryFn: () => facultyLeaveAPI.getLeaves(statusFilter !== 'all' ? { status: statusFilter } : {}),
    enabled: activeTab === 'faculty' || currentUser?.role === 'admin' || currentUser?.role === 'superadmin',
  });

  // Fetch batches for student leave creation
  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
    enabled: isCreateModalOpen && activeTab === 'student' && (currentUser?.role === 'student' || currentUser?.role === 'admin' || currentUser?.role === 'superadmin'),
  });

  // Fetch students for admin dropdown
  const { data: studentsData } = useQuery({
    queryKey: ['students', 'active'],
    queryFn: () => userAPI.getAllUsers({ role: 'student', isActive: true }),
    enabled: isCreateModalOpen && activeTab === 'student' && (currentUser?.role === 'admin' || currentUser?.role === 'superadmin'),
  });

  // Fetch employees for admin dropdown
  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'active'],
    queryFn: () => userAPI.getAllUsers({ role: 'employee', isActive: true }),
    enabled: isCreateModalOpen && activeTab === 'employee' && (currentUser?.role === 'admin' || currentUser?.role === 'superadmin'),
  });

  // Fetch faculty for admin dropdown
  const { data: facultyData } = useQuery({
    queryKey: ['faculty', 'active'],
    queryFn: () => userAPI.getAllUsers({ role: 'faculty', isActive: true }),
    enabled: isCreateModalOpen && activeTab === 'faculty' && (currentUser?.role === 'admin' || currentUser?.role === 'superadmin'),
  });

  const createStudentLeaveMutation = useMutation({
    mutationFn: (data: CreateStudentLeaveRequest) => studentLeaveAPI.createLeave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-leaves'] });
      setIsCreateModalOpen(false);
      alert('Leave request created successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to create leave request');
    },
  });

  const createEmployeeLeaveMutation = useMutation({
    mutationFn: (data: CreateEmployeeLeaveRequest) => employeeLeaveAPI.createLeave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-leaves'] });
      setIsCreateModalOpen(false);
      alert('Leave request created successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to create leave request');
    },
  });

  const createFacultyLeaveMutation = useMutation({
    mutationFn: (data: CreateFacultyLeaveRequest) => facultyLeaveAPI.createLeave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-leaves'] });
      setIsCreateModalOpen(false);
      alert('Leave request created successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to create leave request');
    },
  });

  const approveStudentLeaveMutation = useMutation({
    mutationFn: ({ id, approve, rejectionReason }: { id: number; approve: boolean; rejectionReason?: string }) =>
      studentLeaveAPI.approveLeave(id, { approve, rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-leaves'] });
      setIsApproveModalOpen(false);
      setSelectedLeave(null);
      alert('Leave request updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update leave request');
    },
  });

  const approveEmployeeLeaveMutation = useMutation({
    mutationFn: ({ id, approve, rejectionReason }: { id: number; approve: boolean; rejectionReason?: string }) =>
      employeeLeaveAPI.approveLeave(id, { approve, rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-leaves'] });
      setIsApproveModalOpen(false);
      setSelectedLeave(null);
      alert('Leave request updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update leave request');
    },
  });

  const approveFacultyLeaveMutation = useMutation({
    mutationFn: ({ id, approve, rejectionReason }: { id: number; approve: boolean; rejectionReason?: string }) =>
      facultyLeaveAPI.approveLeave(id, { approve, rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-leaves'] });
      setIsApproveModalOpen(false);
      setSelectedLeave(null);
      alert('Leave request updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update leave request');
    },
  });

  const handleCreateLeave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (activeTab === 'student') {
      const data: CreateStudentLeaveRequest = {
        studentId: currentUser?.role === 'student' ? (currentUser?.id || 0) : parseInt(formData.get('studentId') as string),
        batchId: parseInt(formData.get('batchId') as string),
        startDate: formData.get('startDate') as string,
        endDate: formData.get('endDate') as string,
        reason: formData.get('reason') as string || undefined,
      };
      createStudentLeaveMutation.mutate(data);
    } else if (activeTab === 'employee') {
      const data: CreateEmployeeLeaveRequest = {
        employeeId: currentUser?.role === 'employee' ? (currentUser?.id || 0) : parseInt(formData.get('employeeId') as string),
        startDate: formData.get('startDate') as string,
        endDate: formData.get('endDate') as string,
        reason: formData.get('reason') as string || undefined,
      };
      createEmployeeLeaveMutation.mutate(data);
    } else if (activeTab === 'faculty') {
      const data: CreateFacultyLeaveRequest = {
        facultyId: currentUser?.role === 'faculty' ? (currentUser?.id || 0) : parseInt(formData.get('facultyId') as string),
        startDate: formData.get('startDate') as string,
        endDate: formData.get('endDate') as string,
        reason: formData.get('reason') as string || undefined,
      };
      createFacultyLeaveMutation.mutate(data);
    }
  };

  const handleApprove = (leave: any) => {
    setSelectedLeave(leave);
    setIsApproveModalOpen(true);
  };

  const handleConfirmApprove = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLeave) return;

    const formData = new FormData(e.currentTarget);
    const approve = formData.get('approve') === 'true';
    const rejectionReason = formData.get('rejectionReason') as string || undefined;

    if (activeTab === 'student') {
      approveStudentLeaveMutation.mutate({ id: selectedLeave.id, approve, rejectionReason });
    } else if (activeTab === 'employee') {
      approveEmployeeLeaveMutation.mutate({ id: selectedLeave.id, approve, rejectionReason });
    } else if (activeTab === 'faculty') {
      approveFacultyLeaveMutation.mutate({ id: selectedLeave.id, approve, rejectionReason });
    }
  };

  const getCurrentLeaves = () => {
    if (activeTab === 'student') return studentLeavesData?.data.leaves || [];
    if (activeTab === 'employee') return employeeLeavesData?.data.leaves || [];
    if (activeTab === 'faculty') return facultyLeavesData?.data.leaves || [];
    return [];
  };

  const isLoading = () => {
    if (activeTab === 'student') return isLoadingStudent;
    if (activeTab === 'employee') return isLoadingEmployee;
    if (activeTab === 'faculty') return isLoadingFaculty;
    return false;
  };

  const canCreateLeave = () => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') return true;
    if (activeTab === 'student' && currentUser?.role === 'student') return true;
    if (activeTab === 'employee' && currentUser?.role === 'employee') return true;
    if (activeTab === 'faculty' && currentUser?.role === 'faculty') return true;
    return false;
  };

  const canApproveLeave = () => {
    return currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  };

  const leaves = getCurrentLeaves();
  const filteredLeaves = statusFilter === 'all' 
    ? leaves 
    : leaves.filter((leave: any) => leave.status === statusFilter);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 md:px-8 py-4 md:py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Leave Management</h1>
                <p className="mt-2 text-orange-100">Manage leave requests for all users</p>
              </div>
              {canCreateLeave() && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                >
                  + Request Leave
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'student') && (
                <button
                  onClick={() => setActiveTab('student')}
                  className={`px-6 py-3 text-sm font-medium ${
                    activeTab === 'student'
                      ? 'border-b-2 border-orange-500 text-orange-600'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Student Leaves
                </button>
              )}
              {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'employee') && (
                <button
                  onClick={() => setActiveTab('employee')}
                  className={`px-6 py-3 text-sm font-medium ${
                    activeTab === 'employee'
                      ? 'border-b-2 border-orange-500 text-orange-600'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Employee Leaves
                </button>
              )}
              {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'faculty') && (
                <button
                  onClick={() => setActiveTab('faculty')}
                  className={`px-6 py-3 text-sm font-medium ${
                    activeTab === 'faculty'
                      ? 'border-b-2 border-orange-500 text-orange-600'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Faculty Leaves
                </button>
              )}
            </nav>
          </div>

          <div className="p-6">
            {/* Status Filter */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  statusFilter === 'all'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter(LeaveStatus.PENDING)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  statusFilter === LeaveStatus.PENDING
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter(LeaveStatus.APPROVED)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  statusFilter === LeaveStatus.APPROVED
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setStatusFilter(LeaveStatus.REJECTED)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  statusFilter === LeaveStatus.REJECTED
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Rejected
              </button>
            </div>

            {isLoading() ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : filteredLeaves.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No leave requests found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {activeTab === 'student' && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>}
                      {activeTab === 'employee' && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>}
                      {activeTab === 'faculty' && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>}
                      {activeTab === 'student' && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      {canApproveLeave() && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLeaves.map((leave: any) => (
                      <tr key={leave.id} className="hover:bg-gray-50">
                        {activeTab === 'student' && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{leave.student?.name || 'N/A'}</div>
                            <div className="text-sm text-gray-500">{leave.student?.email}</div>
                          </td>
                        )}
                        {activeTab === 'employee' && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{leave.employee?.name || 'N/A'}</div>
                            <div className="text-sm text-gray-500">{leave.employee?.email}</div>
                          </td>
                        )}
                        {activeTab === 'faculty' && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{leave.faculty?.name || 'N/A'}</div>
                            <div className="text-sm text-gray-500">{leave.faculty?.email}</div>
                          </td>
                        )}
                        {activeTab === 'student' && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{leave.batch?.title || 'N/A'}</div>
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDateDDMMYYYY(leave.startDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDateDDMMYYYY(leave.endDate)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {leave.reason || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            leave.status === LeaveStatus.APPROVED ? 'bg-green-100 text-green-800' :
                            leave.status === LeaveStatus.REJECTED ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {leave.status}
                          </span>
                        </td>
                        {canApproveLeave() && leave.status === LeaveStatus.PENDING && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleApprove(leave)}
                              className="text-green-600 hover:text-green-900 mr-3"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApprove(leave)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Reject
                            </button>
                          </td>
                        )}
                        {canApproveLeave() && leave.status !== LeaveStatus.PENDING && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {leave.approver?.name && `By ${leave.approver.name}`}
                            {leave.approvedAt && ` on ${formatDateDDMMYYYY(leave.approvedAt)}`}
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

      {/* Create Leave Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Request Leave</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateLeave}>
              {activeTab === 'student' && (
                <>
                  {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                      <div className="relative mb-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          placeholder="Search students by name or email..."
                          value={studentSearchQuery}
                          onChange={(e) => setStudentSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <select
                        name="studentId"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        disabled={!studentsData?.data?.users}
                      >
                        <option value="">{studentsData?.data?.users ? 'Select Student' : 'Loading...'}</option>
                        {studentsData?.data?.users
                          ?.filter((student: any) => {
                            if (!studentSearchQuery.trim()) return true;
                            const query = studentSearchQuery.toLowerCase();
                            return (
                              student.name?.toLowerCase().includes(query) ||
                              student.email?.toLowerCase().includes(query)
                            );
                          })
                          ?.map((student: any) => (
                            <option key={student.id} value={student.id}>
                              {student.name} ({student.email})
                            </option>
                          ))}
                      </select>
                      {studentsData?.data?.users?.filter((student: any) => {
                        if (!studentSearchQuery.trim()) return false;
                        const query = studentSearchQuery.toLowerCase();
                        return (
                          student.name?.toLowerCase().includes(query) ||
                          student.email?.toLowerCase().includes(query)
                        );
                      }).length === 0 && studentSearchQuery.trim() && (
                        <p className="mt-1 text-xs text-gray-500">No students found matching your search</p>
                      )}
                    </div>
                  )}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch *</label>
                    <select
                      name="batchId"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Select Batch</option>
                      {batchesData?.data?.map((batch: any) => (
                        <option key={batch.id} value={batch.id}>{batch.title}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {activeTab === 'employee' && (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                  <select
                    name="employeeId"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={!employeesData?.data?.users}
                  >
                    <option value="">{employeesData?.data?.users ? 'Select Employee' : 'Loading...'}</option>
                    {employeesData?.data?.users?.map((employee: any) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} ({employee.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {activeTab === 'faculty' && (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Faculty *</label>
                  <select
                    name="facultyId"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={!facultyData?.data?.users}
                  >
                    <option value="">{facultyData?.data?.users ? 'Select Faculty' : 'Loading...'}</option>
                    {facultyData?.data?.users?.map((faculty: any) => (
                      <option key={faculty.id} value={faculty.id}>
                        {faculty.name} ({faculty.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  name="startDate"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                <input
                  type="date"
                  name="endDate"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  name="reason"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={
                    (activeTab === 'student' && createStudentLeaveMutation.isPending) ||
                    (activeTab === 'employee' && createEmployeeLeaveMutation.isPending) ||
                    (activeTab === 'faculty' && createFacultyLeaveMutation.isPending)
                  }
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {createStudentLeaveMutation.isPending || createEmployeeLeaveMutation.isPending || createFacultyLeaveMutation.isPending
                    ? 'Submitting...'
                    : 'Submit Request'}
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

      {/* Approve/Reject Modal */}
      {isApproveModalOpen && selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {selectedLeave.status === LeaveStatus.PENDING ? 'Approve/Reject Leave' : 'Leave Details'}
              </h2>
              <button
                onClick={() => {
                  setIsApproveModalOpen(false);
                  setSelectedLeave(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {selectedLeave.status === LeaveStatus.PENDING ? (
              <form onSubmit={handleConfirmApprove}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Action *</label>
                  <select
                    name="approve"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="true">Approve</option>
                    <option value="false">Reject</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason (if rejecting)</label>
                  <textarea
                    name="rejectionReason"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={
                      (activeTab === 'student' && approveStudentLeaveMutation.isPending) ||
                      (activeTab === 'employee' && approveEmployeeLeaveMutation.isPending) ||
                      (activeTab === 'faculty' && approveFacultyLeaveMutation.isPending)
                    }
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {approveStudentLeaveMutation.isPending || approveEmployeeLeaveMutation.isPending || approveFacultyLeaveMutation.isPending
                      ? 'Processing...'
                      : 'Submit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsApproveModalOpen(false);
                      setSelectedLeave(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLeave.status}</p>
                </div>
                {selectedLeave.rejectionReason && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Rejection Reason</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedLeave.rejectionReason}</p>
                  </div>
                )}
                {selectedLeave.approver && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Approved By</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedLeave.approver.name}</p>
                  </div>
                )}
                <button
                  onClick={() => {
                    setIsApproveModalOpen(false);
                    setSelectedLeave(null);
                  }}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

