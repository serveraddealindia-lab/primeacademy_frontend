import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { reportAPI } from '../api/report.api';
import { batchAPI } from '../api/batch.api';
import { facultyAPI } from '../api/faculty.api';
import { attendanceReportAPI } from '../api/attendanceReport.api';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

export const ReportManagement: React.FC = () => {
  const [activeReport, setActiveReport] = useState<
    | 'all-analysis'
    | 'students-without-batch'
    | 'batch-attendance'
    | 'pending-payments'
    | 'portfolio-status'
    | 'faculty-attendance'
    | 'student-attendance'
    | 'punch-summary'
    | null
  >(null);
  const [batchAttendanceBatchId, setBatchAttendanceBatchId] = useState<number | null>(null);
  const [batchAttendanceFrom, setBatchAttendanceFrom] = useState<string>('');
  const [batchAttendanceTo, setBatchAttendanceTo] = useState<string>('');

  const [facultyReportFacultyId, setFacultyReportFacultyId] = useState<number | null>(null);
  const [facultyReportBatchId, setFacultyReportBatchId] = useState<number | null>(null);
  const [facultyReportFrom, setFacultyReportFrom] = useState<string>('');
  const [facultyReportTo, setFacultyReportTo] = useState<string>('');

  const [studentReportBatchId, setStudentReportBatchId] = useState<number | null>(null);
  const [studentReportStudentId, setStudentReportStudentId] = useState<number | null>(null);
  const [studentReportFrom, setStudentReportFrom] = useState<string>('');
  const [studentReportTo, setStudentReportTo] = useState<string>('');

  const [punchReportUserId, setPunchReportUserId] = useState<number | null>(null);
  const [punchReportRole, setPunchReportRole] = useState<string>('');
  const [punchReportFrom, setPunchReportFrom] = useState<string>('');
  const [punchReportTo, setPunchReportTo] = useState<string>('');

  // Fetch batches for batch attendance report
  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });

  const { data: facultyData } = useQuery({
    queryKey: ['faculty'],
    queryFn: () => facultyAPI.getAllFaculty(),
  });

  // Fetch students without batch report
  const { data: studentsWithoutBatchData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['reports', 'students-without-batch'],
    queryFn: () => reportAPI.getStudentsWithoutBatch(),
    enabled: activeReport === 'students-without-batch',
  });

  // Fetch batch attendance report
  const { data: batchAttendanceData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['reports', 'batch-attendance', batchAttendanceBatchId, batchAttendanceFrom, batchAttendanceTo],
    queryFn: () =>
      reportAPI.getBatchAttendance(batchAttendanceBatchId!, {
        from: batchAttendanceFrom || undefined,
        to: batchAttendanceTo || undefined,
      }),
    enabled: activeReport === 'batch-attendance' && batchAttendanceBatchId !== null,
  });

  // Fetch pending payments report
  const { data: pendingPaymentsData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['reports', 'pending-payments'],
    queryFn: () => reportAPI.getPendingPayments(),
    enabled: activeReport === 'pending-payments',
  });

  // Fetch portfolio status report
  const { data: portfolioStatusData, isLoading: isLoadingPortfolio } = useQuery({
    queryKey: ['reports', 'portfolio-status'],
    queryFn: () => reportAPI.getPortfolioStatus(),
    enabled: activeReport === 'portfolio-status',
  });

  // Fetch all analysis reports
  const { data: allAnalysisData, isLoading: isLoadingAnalysis } = useQuery({
    queryKey: ['reports', 'all-analysis'],
    queryFn: () => reportAPI.getAllAnalysisReports(),
    enabled: activeReport === 'all-analysis',
  });

  const facultyAttendanceFilters = useMemo(
    () => ({
      facultyId: facultyReportFacultyId ?? undefined,
      batchId: facultyReportBatchId ?? undefined,
      from: facultyReportFrom || undefined,
      to: facultyReportTo || undefined,
    }),
    [facultyReportFacultyId, facultyReportBatchId, facultyReportFrom, facultyReportTo]
  );

  const studentAttendanceFilters = useMemo(
    () =>
      studentReportBatchId
        ? {
            batchId: studentReportBatchId,
            studentId: studentReportStudentId ?? undefined,
            from: studentReportFrom || undefined,
            to: studentReportTo || undefined,
          }
        : null,
    [studentReportBatchId, studentReportStudentId, studentReportFrom, studentReportTo]
  );

  const punchSummaryFilters = useMemo(
    () => ({
      userId: punchReportUserId ?? undefined,
      role: punchReportRole || undefined,
      from: punchReportFrom || undefined,
      to: punchReportTo || undefined,
    }),
    [punchReportUserId, punchReportRole, punchReportFrom, punchReportTo]
  );

  const { data: facultyAttendanceData, isLoading: isLoadingFacultyAttendance } = useQuery({
    queryKey: [
      'attendance-reports',
      'faculty',
      facultyReportFacultyId,
      facultyReportBatchId,
      facultyReportFrom,
      facultyReportTo,
    ],
    queryFn: () =>
      attendanceReportAPI.getFacultyAttendance(facultyAttendanceFilters),
    enabled: activeReport === 'faculty-attendance',
  });

  const { data: studentAttendanceData, isLoading: isLoadingStudentAttendance } = useQuery({
    queryKey: [
      'attendance-reports',
      'students',
      studentReportBatchId,
      studentReportStudentId,
      studentReportFrom,
      studentReportTo,
    ],
    queryFn: () =>
      attendanceReportAPI.getStudentAttendance(studentAttendanceFilters!),
    enabled: activeReport === 'student-attendance' && !!studentAttendanceFilters,
  });

  const { data: punchSummaryData, isLoading: isLoadingPunchSummary } = useQuery({
    queryKey: ['attendance-reports', 'punches', punchReportUserId, punchReportRole, punchReportFrom, punchReportTo],
    queryFn: () => attendanceReportAPI.getPunchSummary(punchSummaryFilters),
    enabled: activeReport === 'punch-summary',
  });

  const batches = batchesData?.data || [];
  const faculties = facultyData?.data.users || [];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 md:px-8 py-4 md:py-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Reports</h1>
              <p className="mt-2 text-sm md:text-base text-orange-100">View reports</p>
            </div>
          </div>

          <div className="p-4 md:p-6">
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-4">
              <button
                onClick={() => setActiveReport('all-analysis')}
                className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                  activeReport === 'all-analysis'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Analysis
              </button>
              <button
                onClick={() => setActiveReport('students-without-batch')}
                className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                  activeReport === 'students-without-batch'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Students Without Batch
              </button>
              <button
                onClick={() => setActiveReport('batch-attendance')}
                className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                  activeReport === 'batch-attendance'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Batch Attendance
              </button>
              <button
                onClick={() => setActiveReport('pending-payments')}
                className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                  activeReport === 'pending-payments'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending Payments
              </button>
              <button
                onClick={() => setActiveReport('portfolio-status')}
                className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                  activeReport === 'portfolio-status'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Portfolio Status
              </button>
              <button
                onClick={() => setActiveReport('faculty-attendance')}
                className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                  activeReport === 'faculty-attendance'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Faculty Attendance
              </button>
              <button
                onClick={() => setActiveReport('student-attendance')}
                className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                  activeReport === 'student-attendance'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Student Attendance
              </button>
              <button
                onClick={() => setActiveReport('punch-summary')}
                className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                  activeReport === 'punch-summary'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Punch Summary
              </button>
            </div>

            {activeReport === 'students-without-batch' && (
              <div>
                {isLoadingStudents ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {studentsWithoutBatchData?.data.students.map((student) => (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">{student.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{student.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{student.phone || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{formatDateDDMMYYYY(student.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-4 text-sm text-gray-600">
                      Total: {studentsWithoutBatchData?.data.totalCount || 0} students
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeReport === 'batch-attendance' && (
              <div>
                <div className="mb-4 flex gap-4">
                  <select
                    value={batchAttendanceBatchId || ''}
                    onChange={(e) => setBatchAttendanceBatchId(e.target.value ? parseInt(e.target.value) : null)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select a batch</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={batchAttendanceFrom}
                    onChange={(e) => setBatchAttendanceFrom(e.target.value)}
                    placeholder="From Date"
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <input
                    type="date"
                    value={batchAttendanceTo}
                    onChange={(e) => setBatchAttendanceTo(e.target.value)}
                    placeholder="To Date"
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                {isLoadingAttendance ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                  </div>
                ) : batchAttendanceData?.data ? (
                  <div>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold mb-2">{batchAttendanceData.data.batch.title}</h3>
                      <p className="text-sm text-gray-600">
                        Total Sessions: {batchAttendanceData.data.totalSessions} | Total Attendances: {batchAttendanceData.data.totalAttendances}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {batchAttendanceData.data.studentStatistics.map((stat) => (
                            <tr key={stat.studentId} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">Student {stat.studentId}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{stat.present}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{stat.absent}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{stat.total}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{stat.attendanceRate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-12">Select a batch to view attendance report</p>
                )}
              </div>
            )}

            {activeReport === 'pending-payments' && (
              <div>
                {isLoadingPayments ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                  </div>
                ) : pendingPaymentsData?.data ? (
                  <div>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold mb-2">Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Total Pending</p>
                          <p className="font-semibold">{pendingPaymentsData.data.summary.totalPending}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Total Amount</p>
                          <p className="font-semibold">₹{pendingPaymentsData.data.summary.totalPendingAmount}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Overdue</p>
                          <p className="font-semibold">{pendingPaymentsData.data.summary.overdue.count}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Upcoming</p>
                          <p className="font-semibold">{pendingPaymentsData.data.summary.upcoming.count}</p>
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pendingPaymentsData.data.payments.map((payment) => (
                            <tr key={payment.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">{payment.student.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap">₹{payment.amount.toFixed(2)}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{formatDateDDMMYYYY(payment.dueDate)}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  payment.isOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {payment.isOverdue ? 'Overdue' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {activeReport === 'portfolio-status' && (
              <div>
                {isLoadingPortfolio ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                  </div>
                ) : portfolioStatusData?.data ? (
                  <div>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold mb-2">Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Total</p>
                          <p className="font-semibold">{portfolioStatusData.data.summary.total}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Pending</p>
                          <p className="font-semibold">{portfolioStatusData.data.summary.pending}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Approved</p>
                          <p className="font-semibold">{portfolioStatusData.data.summary.approved}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Rejected</p>
                          <p className="font-semibold">{portfolioStatusData.data.summary.rejected}</p>
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <div className="inline-block min-w-full align-middle sm:px-0">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Batch</th>
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Files</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {portfolioStatusData.data.portfolios.map((portfolio) => (
                              <tr key={portfolio.id} className="hover:bg-gray-50">
                                <td className="px-3 sm:px-6 py-4">
                                  <div className="text-xs sm:text-sm font-medium text-gray-900">{portfolio.student.name}</div>
                                  <div className="text-xs text-gray-500 md:hidden mt-1">{portfolio.batch.title}</div>
                                </td>
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                                  <div className="text-xs sm:text-sm text-gray-900">{portfolio.batch.title}</div>
                                </td>
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    portfolio.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    portfolio.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {portfolio.status}
                                  </span>
                                </td>
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                  <div className="text-xs sm:text-sm text-gray-900">{Object.keys(portfolio.files || {}).length}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {activeReport === 'all-analysis' && (
              <div>
                {isLoadingAnalysis ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                  </div>
                ) : allAnalysisData?.data ? (
                  <div className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">
                        Generated at: {new Date(allAnalysisData.data.generatedAt).toLocaleString()}
                      </p>
                    </div>
                    
                    {/* Students Summary */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">Students Summary</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Students</p>
                          <p className="text-2xl font-bold text-blue-600">{allAnalysisData.data.summary.students.total}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">With Batch</p>
                          <p className="text-2xl font-bold text-green-600">{allAnalysisData.data.summary.students.withBatch}</p>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Without Batch</p>
                          <p className="text-2xl font-bold text-yellow-600">{allAnalysisData.data.summary.students.withoutBatch}</p>
                        </div>
                      </div>
                    </div>

                    {/* Batches Summary */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">Batches Summary</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Batches</p>
                          <p className="text-2xl font-bold text-blue-600">{allAnalysisData.data.summary.batches.total}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Active Batches</p>
                          <p className="text-2xl font-bold text-green-600">{allAnalysisData.data.summary.batches.active}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Ended Batches</p>
                          <p className="text-2xl font-bold text-gray-600">{allAnalysisData.data.summary.batches.ended}</p>
                        </div>
                      </div>
                    </div>

                    {/* Sessions Summary */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">Sessions Summary</h3>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Sessions</p>
                        <p className="text-2xl font-bold text-purple-600">{allAnalysisData.data.summary.sessions.total}</p>
                      </div>
                    </div>

                    {/* Payments Summary */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">Payments Summary</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Payments</p>
                          <p className="text-2xl font-bold text-blue-600">{allAnalysisData.data.summary.payments.total}</p>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Pending</p>
                          <p className="text-2xl font-bold text-yellow-600">{allAnalysisData.data.summary.payments.pending}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="text-lg font-bold text-green-600">₹{allAnalysisData.data.summary.payments.totalAmount.toFixed(2)}</p>
                        </div>
                        <div className="bg-teal-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Paid Amount</p>
                          <p className="text-lg font-bold text-teal-600">₹{allAnalysisData.data.summary.payments.paidAmount.toFixed(2)}</p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Pending Amount</p>
                          <p className="text-lg font-bold text-red-600">₹{allAnalysisData.data.summary.payments.pendingAmount.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Portfolios Summary */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">Portfolios Summary</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Portfolios</p>
                          <p className="text-2xl font-bold text-blue-600">{allAnalysisData.data.summary.portfolios.total}</p>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Pending</p>
                          <p className="text-2xl font-bold text-yellow-600">{allAnalysisData.data.summary.portfolios.pending}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {activeReport === 'faculty-attendance' && (
              <div>
                <div className="flex flex-wrap gap-4 mb-4">
                  <select
                    value={facultyReportFacultyId || ''}
                    onChange={(e) => setFacultyReportFacultyId(e.target.value ? Number(e.target.value) : null)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">All Faculty</option>
                    {faculties.map((faculty) => (
                      <option key={faculty.id} value={faculty.id}>
                        {faculty.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={facultyReportBatchId || ''}
                    onChange={(e) => setFacultyReportBatchId(e.target.value ? Number(e.target.value) : null)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">All Batches</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={facultyReportFrom}
                    onChange={(e) => setFacultyReportFrom(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <input
                    type="date"
                    value={facultyReportTo}
                    onChange={(e) => setFacultyReportTo(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    onClick={() => attendanceReportAPI.downloadFacultyAttendanceCsv(facultyAttendanceFilters)}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md font-semibold hover:bg-orange-700 transition-colors"
                  >
                    Download CSV
                  </button>
                </div>
                {isLoadingFacultyAttendance ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                  </div>
                ) : facultyAttendanceData ? (
                  <div>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg flex flex-wrap gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Sessions</p>
                        <p className="font-semibold text-gray-900">{facultyAttendanceData.summary.sessions}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Total Present</p>
                        <p className="font-semibold text-green-700">{facultyAttendanceData.summary.totalPresent}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Total Absent</p>
                        <p className="font-semibold text-red-600">{facultyAttendanceData.summary.totalAbsent}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Average Rate</p>
                        <p className="font-semibold text-blue-600">{facultyAttendanceData.summary.averageRate}%</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {facultyAttendanceData.rows.map((row) => (
                            <tr key={row.sessionId} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDateDDMMYYYY(row.date)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.batchTitle}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.facultyName}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-700">{row.present}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{row.absent}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.attendanceRate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-12">Select filters to view faculty attendance.</p>
                )}
              </div>
            )}

            {activeReport === 'student-attendance' && (
              <div>
                <div className="flex flex-wrap gap-4 mb-4">
                  <select
                    value={studentReportBatchId || ''}
                    onChange={(e) => setStudentReportBatchId(e.target.value ? Number(e.target.value) : null)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select Batch</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Student ID (optional)"
                    value={studentReportStudentId || ''}
                    onChange={(e) => setStudentReportStudentId(e.target.value ? Number(e.target.value) : null)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
                  />
                  <input
                    type="date"
                    value={studentReportFrom}
                    onChange={(e) => setStudentReportFrom(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <input
                    type="date"
                    value={studentReportTo}
                    onChange={(e) => setStudentReportTo(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    disabled={!studentAttendanceFilters}
                    onClick={() =>
                      studentAttendanceFilters && attendanceReportAPI.downloadStudentAttendanceCsv(studentAttendanceFilters)
                    }
                    className="px-4 py-2 bg-orange-600 text-white rounded-md font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    Download CSV
                  </button>
                </div>
                {studentReportBatchId === null ? (
                  <p className="text-gray-500 text-center py-12">Select a batch to view student attendance.</p>
                ) : isLoadingStudentAttendance ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                  </div>
                ) : studentAttendanceData ? (
                  <div>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg flex flex-wrap gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Students</p>
                        <p className="font-semibold text-gray-900">{studentAttendanceData.summary.students}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Average Rate</p>
                        <p className="font-semibold text-blue-600">{studentAttendanceData.summary.averageRate}%</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manual Present</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {studentAttendanceData.rows.map((row) => (
                            <tr key={row.studentId} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="font-semibold">{row.studentName}</div>
                                <div className="text-xs text-gray-500">{row.studentEmail}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-700">{row.present}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600">{row.manualPresent}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{row.absent}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.total}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.attendanceRate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {activeReport === 'punch-summary' && (
              <div>
                <div className="flex flex-wrap gap-4 mb-4">
                  <input
                    type="number"
                    placeholder="User ID"
                    value={punchReportUserId || ''}
                    onChange={(e) => setPunchReportUserId(e.target.value ? Number(e.target.value) : null)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 w-40"
                  />
                  <select
                    value={punchReportRole}
                    onChange={(e) => setPunchReportRole(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">All Roles</option>
                    <option value="faculty">Faculty</option>
                    <option value="employee">Employee</option>
                  </select>
                  <input
                    type="date"
                    value={punchReportFrom}
                    onChange={(e) => setPunchReportFrom(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <input
                    type="date"
                    value={punchReportTo}
                    onChange={(e) => setPunchReportTo(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    onClick={() => attendanceReportAPI.downloadPunchSummaryCsv(punchSummaryFilters)}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md font-semibold hover:bg-orange-700 transition-colors"
                  >
                    Download CSV
                  </button>
                </div>
                {isLoadingPunchSummary ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                  </div>
                ) : punchSummaryData ? (
                  <div>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg flex flex-wrap gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Punches</p>
                        <p className="font-semibold text-gray-900">{punchSummaryData.summary.punches}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Total Hours</p>
                        <p className="font-semibold text-blue-600">{punchSummaryData.summary.totalHours}</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punch In</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punch Out</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {punchSummaryData.rows.map((row, idx) => (
                            <tr key={`${row.userName}-${row.date}-${idx}`} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDateDDMMYYYY(row.date)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.userName}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.role}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {row.punchInAt ? new Date(row.punchInAt).toLocaleTimeString() : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {row.punchOutAt ? new Date(row.punchOutAt).toLocaleTimeString() : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.hours}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-12">No punch data for the selected filters.</p>
                )}
              </div>
            )}

            {!activeReport && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-4">Select a report type to view</p>
                <p className="text-sm text-gray-400">
                  Available reports: All Analysis, Students Without Batch, Batch Attendance, Pending Payments, Portfolio Status, Faculty Attendance,
                  Student Attendance, Punch Summary
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

