import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { batchAPI, Batch } from '../api/batch.api';
import { attendanceReportAPI, PunchSummaryRow, StudentAttendanceRow } from '../api/attendanceReport.api';
import { studentAPI } from '../api/student.api';
import { facultyAPI, FacultyUser } from '../api/faculty.api';
import { employeeAPI, Employee } from '../api/employee.api';
import { attendanceAPI, Attendance } from '../api/attendance.api';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

type UserRoleFilter = 'student' | 'faculty' | 'employee';
type StudentUserAttendance = { type: 'student'; rows: Attendance[] };
type PunchUserAttendance = { type: 'punch'; rows: PunchSummaryRow[]; summary: { punches: number; totalHours: string } };
type UserAttendanceResult = StudentUserAttendance | PunchUserAttendance | null;

const emptyState = (
  <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">No data found for the selected filters.</div>
);

export const AttendanceManagement: React.FC = () => {
  const { user } = useAuth();
  const isAdminUser = user?.role === 'superadmin' || user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'batches' | 'users'>('batches');
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [batchFilters, setBatchFilters] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [userRoleFilter, setUserRoleFilter] = useState<UserRoleFilter>('student');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userFilters, setUserFilters] = useState<{ from: string; to: string }>({ from: '', to: '' });

  if (!isAdminUser) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-lg p-8 mt-10 text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-600 leading-relaxed">
            This dashboard is available for Admin and Superadmin roles. Please use the Attendance tab for punch in/out and
            session management.
          </p>
        </div>
      </Layout>
    );
  }

  const { data: batchesResponse, isLoading: isLoadingBatches } = useQuery({
    queryKey: ['attendance-batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });
  const batches = batchesResponse?.data || [];

  useEffect(() => {
    if (!selectedBatchId && batches.length > 0) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  const sanitizedBatchFilters = useMemo(
    () => ({
      ...(batchFilters.from ? { from: batchFilters.from } : {}),
      ...(batchFilters.to ? { to: batchFilters.to } : {}),
    }),
    [batchFilters.from, batchFilters.to]
  );

  const sanitizedUserFilters = useMemo(
    () => ({
      ...(userFilters.from ? { from: userFilters.from } : {}),
      ...(userFilters.to ? { to: userFilters.to } : {}),
    }),
    [userFilters.from, userFilters.to]
  );

  const { data: batchAttendanceData, isFetching: isFetchingBatchAttendance } = useQuery({
    queryKey: ['batch-attendance-report', selectedBatchId, batchFilters.from, batchFilters.to],
    queryFn: () =>
      attendanceReportAPI.getStudentAttendance({
        batchId: selectedBatchId!,
        ...sanitizedBatchFilters,
      }),
    enabled: !!selectedBatchId,
  });

  const { data: facultyResponse } = useQuery({
    queryKey: ['attendance-faculty'],
    queryFn: () => facultyAPI.getAllFaculty(500),
  });

  const { data: employeeResponse } = useQuery({
    queryKey: ['attendance-employees'],
    queryFn: () => employeeAPI.getAllEmployees(),
  });

  const { data: studentsResponse } = useQuery({
    queryKey: ['attendance-students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  const facultyList = facultyResponse?.data?.users || facultyResponse?.data?.faculty || [];
  const employeeList = employeeResponse?.data?.users || [];
  const studentList = studentsResponse?.data.students || [];

  const userOptions = useMemo(() => {
    if (userRoleFilter === 'student') {
      return studentList.map((student) => ({
        id: student.id,
        name: student.name,
        email: student.email,
      }));
    }
    if (userRoleFilter === 'faculty') {
      return facultyList.map((faculty: FacultyUser) => ({
        id: faculty.id,
        name: faculty.name,
        email: faculty.email,
      }));
    }
    return employeeList.map((employee: Employee) => ({
      id: employee.id,
      name: employee.name,
      email: employee.email,
    }));
  }, [employeeList, facultyList, studentList, userRoleFilter]);

  useEffect(() => {
    if (userOptions && userOptions.length > 0) {
      setSelectedUserId(userOptions[0].id);
    } else {
      setSelectedUserId(null);
    }
  }, [userOptions]);

  const {
    data: userAttendanceData,
    isFetching: isFetchingUserAttendance,
  } = useQuery<UserAttendanceResult>({
    queryKey: ['user-attendance', userRoleFilter, selectedUserId, userFilters.from, userFilters.to],
    queryFn: async () => {
      if (!selectedUserId) return null;
      if (userRoleFilter === 'student') {
        const response = await attendanceAPI.getStudentAttendance(selectedUserId, sanitizedUserFilters);
        return {
          type: 'student',
          rows: response.data.attendances,
        };
      }

      const response = await attendanceReportAPI.getPunchSummary({
        userId: selectedUserId,
        role: userRoleFilter,
        ...sanitizedUserFilters,
      });

      return {
        type: 'punch',
        rows: response.rows,
        summary: response.summary,
      };
    },
    enabled: !!selectedUserId,
  });

  const renderBatchAttendance = () => {
    if (isLoadingBatches) {
      return <div className="py-12 text-center text-gray-500">Loading batches...</div>;
    }

    if (batches.length === 0) {
      return <div className="py-12 text-center text-gray-500">No batches available.</div>;
    }

    const rows: StudentAttendanceRow[] = batchAttendanceData?.rows || [];

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
            <select
              value={selectedBatchId || ''}
              onChange={(e) => setSelectedBatchId(Number(e.target.value) || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {batches.map((batch: Batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.title} (#{batch.id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={batchFilters.from}
              onChange={(e) => setBatchFilters((prev) => ({ ...prev, from: e.target.value }))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={batchFilters.to}
              onChange={(e) => setBatchFilters((prev) => ({ ...prev, to: e.target.value }))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                attendanceReportAPI.downloadStudentAttendanceCsv({
                  batchId: selectedBatchId!,
                  ...sanitizedBatchFilters,
                })
              }
              disabled={!selectedBatchId}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Download CSV
            </button>
          </div>
        </div>

        {isFetchingBatchAttendance ? (
          <div className="py-12 text-center text-gray-500">Loading attendance...</div>
        ) : rows.length === 0 ? (
          emptyState
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Present</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Absent</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Late</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Attendance %</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row) => (
                  <tr key={row.studentId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <p className="font-semibold">{row.studentName}</p>
                      <p className="text-xs text-gray-500">{row.studentEmail}</p>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-green-700 font-semibold">{row.present}</td>
                    <td className="px-6 py-4 text-center text-sm text-red-600 font-semibold">{row.absent}</td>
                    <td className="px-6 py-4 text-center text-sm text-blue-600 font-semibold">{row.manualPresent}</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900 font-semibold">{row.total}</td>
                    <td className="px-6 py-4 text-center text-sm">
                      <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 font-semibold">{row.attendanceRate}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderUserAttendance = () => {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User Type</label>
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value as UserRoleFilter)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="student">Students</option>
              <option value="faculty">Faculty</option>
              <option value="employee">Employees</option>
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
            <select
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {userOptions?.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} {option.email ? `(${option.email})` : ''}
                </option>
              )) || <option value="">No users available</option>}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={userFilters.from}
              onChange={(e) => setUserFilters((prev) => ({ ...prev, from: e.target.value }))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={userFilters.to}
              onChange={(e) => setUserFilters((prev) => ({ ...prev, to: e.target.value }))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex gap-2">
            {userRoleFilter !== 'student' && (
              <button
                onClick={() =>
                  attendanceReportAPI.downloadPunchSummaryCsv({
                    userId: selectedUserId || undefined,
                    role: userRoleFilter,
                    ...sanitizedUserFilters,
                  })
                }
                disabled={!selectedUserId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                Download CSV
              </button>
            )}
          </div>
        </div>

        {isFetchingUserAttendance ? (
          <div className="py-10 text-center text-gray-500">Loading user attendance...</div>
        ) : !userAttendanceData || !selectedUserId ? (
          emptyState
        ) : userAttendanceData.type === 'student' ? (
          <>
            {userAttendanceData.rows.length === 0 ? (
              emptyState
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Session / Topic</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Marked At</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {userAttendanceData.rows.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {record.session?.date ? formatDateDDMMYYYY(record.session.date) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{record.session?.topic || `Session #${record.sessionId}`}</td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              record.status === 'absent'
                                ? 'bg-red-100 text-red-700'
                                : record.status === 'manual_present'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {record.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{record.markedAt ? new Date(record.markedAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-xs text-green-700 uppercase tracking-wide">Total Punch Days</p>
                <p className="text-2xl font-bold text-green-900 mt-1">{userAttendanceData.summary?.punches ?? 0}</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-xs text-orange-700 uppercase tracking-wide">Total Hours</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">{userAttendanceData.summary?.totalHours ?? '0.00'}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-700 uppercase tracking-wide">Role</p>
                <p className="text-2xl font-bold text-blue-900 mt-1 capitalize">{userRoleFilter}</p>
              </div>
            </div>
            {userAttendanceData.rows.length === 0 ? (
              emptyState
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Punch In</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Punch Out</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(userAttendanceData.rows as PunchSummaryRow[]).map((row, index) => (
                      <tr key={`${row.date}-${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{formatDateDDMMYYYY(row.date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{row.punchInAt ? new Date(row.punchInAt).toLocaleTimeString() : '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{row.punchOutAt ? new Date(row.punchOutAt).toLocaleTimeString() : '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-semibold">{row.hours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Attendance Management</h1>
              <p className="mt-1 text-orange-100">Monitor attendance by batch or individual users.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab('batches')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                  activeTab === 'batches' ? 'bg-white text-orange-600' : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Batch Attendance
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                  activeTab === 'users' ? 'bg-white text-orange-600' : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                User Attendance
              </button>
            </div>
          </div>
          <div className="p-8">{activeTab === 'batches' ? renderBatchAttendance() : renderUserAttendance()}</div>
        </div>
      </div>
    </Layout>
  );
};

