import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { attendanceAPI, Attendance } from '../api/attendance.api';
import { enrollmentAPI } from '../api/enrollment.api';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

interface BatchAttendance {
  batchId: number;
  batchTitle: string;
  attendances: Attendance[];
  stats: {
    total: number;
    present: number;
    absent: number;
    manualPresent: number;
    attendanceRate: number;
  };
}

export const StudentAttendanceView: React.FC = () => {
  const { user } = useAuth();
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<{ from?: string; to?: string }>({});

  // Fetch student enrollments to get batches
  const { data: enrollmentsData } = useQuery({
    queryKey: ['student-enrollments', user?.id || user?.userId],
    queryFn: async () => {
      if (!user) return { data: [] };
      const studentId = user.id || user.userId;
      if (!studentId) return { data: [] };
      return await enrollmentAPI.getAllEnrollments({ studentId });
    },
    enabled: !!user && (!!user.id || !!user.userId),
  });

  const enrollments = enrollmentsData?.data || [];
  const batches = enrollments.map((e: any) => ({
    id: e.batch?.id || e.batchId,
    title: e.batch?.title || 'Unknown Batch',
  })).filter((b: any) => b.id);

  // Fetch attendance for the student
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['student-attendance', user?.id || user?.userId, dateFilter],
    queryFn: async () => {
      if (!user) return { data: { attendances: [] } };
      const studentId = user.id || user.userId;
      if (!studentId) return { data: { attendances: [] } };
      return await attendanceAPI.getStudentAttendance(studentId, dateFilter);
    },
    enabled: !!user && (!!user.id || !!user.userId),
  });

  const attendances = attendanceData?.data?.attendances || [];

  // Group attendances by batch
  const batchAttendanceMap = useMemo(() => {
    const map = new Map<number, BatchAttendance>();

    attendances.forEach((attendance: Attendance) => {
      const session = attendance.session;
      if (!session) return;

      // Get batch ID from session
      const sessionData = session as any;
      const batchId = sessionData.batchId || sessionData.batch?.id;
      if (!batchId) {
        // Try to find batch from enrollments if not in session
        const enrollment = enrollments.find((e: any) => {
          // Check if this attendance's session date matches any enrollment's batch sessions
          return e.batchId && batches.some((b: any) => b.id === e.batchId);
        });
        if (enrollment) {
          const batch = batches.find((b: any) => b.id === enrollment.batchId);
          if (batch) {
            const batchData = map.get(batch.id) || {
              batchId: batch.id,
              batchTitle: batch.title,
              attendances: [] as Attendance[],
              stats: { total: 0, present: 0, absent: 0, manualPresent: 0, attendanceRate: 0 },
            };
            batchData.attendances.push(attendance);
            batchData.stats.total++;
            if (attendance.status === 'present') batchData.stats.present++;
            else if (attendance.status === 'absent') batchData.stats.absent++;
            else if (attendance.status === 'manual_present') batchData.stats.manualPresent++;
            map.set(batch.id, batchData);
          }
        }
        return;
      }

      const batchTitle = sessionData.batch?.title || batches.find((b: any) => b.id === batchId)?.title || `Batch ${batchId}`;

      if (!map.has(batchId)) {
        map.set(batchId, {
          batchId,
          batchTitle,
          attendances: [],
          stats: {
            total: 0,
            present: 0,
            absent: 0,
            manualPresent: 0,
            attendanceRate: 0,
          },
        });
      }

      const batchData = map.get(batchId)!;
      batchData.attendances.push(attendance);

      // Update stats
      batchData.stats.total++;
      if (attendance.status === 'present') {
        batchData.stats.present++;
      } else if (attendance.status === 'absent') {
        batchData.stats.absent++;
      } else if (attendance.status === 'manual_present') {
        batchData.stats.manualPresent++;
      }
    });

    // Calculate attendance rates
    map.forEach((batchData) => {
      const totalPresent = batchData.stats.present + batchData.stats.manualPresent;
      batchData.stats.attendanceRate = batchData.stats.total > 0
        ? Math.round((totalPresent / batchData.stats.total) * 100)
        : 0;
    });

    return map;
  }, [attendances, batches]);

  const batchAttendanceList = Array.from(batchAttendanceMap.values());

  // Filter by selected batch
  const filteredBatches = selectedBatchId
    ? batchAttendanceList.filter((b) => b.batchId === selectedBatchId)
    : batchAttendanceList;

  // Sort attendances by date within each batch
  filteredBatches.forEach((batch) => {
    batch.attendances.sort((a, b) => {
      const dateA = a.session?.date ? new Date(a.session.date).getTime() : 0;
      const dateB = b.session?.date ? new Date(b.session.date).getTime() : 0;
      return dateB - dateA; // Most recent first
    });
  });

  if (user?.role !== 'student') {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600">This page is only available for students.</p>
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">My Attendance</h1>
                <p className="mt-2 text-sm md:text-base text-orange-100">View your attendance by batch and day</p>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6">
            {/* Filters */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Batch</label>
                <select
                  value={selectedBatchId || ''}
                  onChange={(e) => setSelectedBatchId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">All Batches</option>
                  {batches.map((batch: any) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFilter.from || ''}
                  onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateFilter.to || ''}
                  onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading attendance...</p>
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No attendance records found</p>
                {attendances.length === 0 && (
                  <p className="text-gray-400 text-sm mt-2">You don't have any attendance records yet.</p>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredBatches.map((batch) => (
                  <div key={batch.batchId} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Batch Header */}
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{batch.batchTitle}</h3>
                          <p className="text-sm text-gray-600">{batch.attendances.length} session(s)</p>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div className="text-center">
                            <div className="font-semibold text-green-600">{batch.stats.present + batch.stats.manualPresent}</div>
                            <div className="text-gray-600">Present</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-red-600">{batch.stats.absent}</div>
                            <div className="text-gray-600">Absent</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-gray-900">{batch.stats.total}</div>
                            <div className="text-gray-600">Total</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-blue-600">{batch.stats.attendanceRate}%</div>
                            <div className="text-gray-600">Rate</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Attendance Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session / Topic</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marked At</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {batch.attendances.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                No attendance records for this batch
                              </td>
                            </tr>
                          ) : (
                            batch.attendances.map((attendance) => (
                              <tr key={attendance.id} className="hover:bg-gray-50">
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {attendance.session?.date ? formatDateDDMMYYYY(attendance.session.date) : '-'}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-900">
                                  <div>{attendance.session?.topic || 'No topic'}</div>
                                  {attendance.isManual && (
                                    <span className="text-xs text-gray-500">(Manually marked)</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-semibold ${
                                      attendance.status === 'present' || attendance.status === 'manual_present'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {attendance.status === 'present' ? 'Present' :
                                     attendance.status === 'manual_present' ? 'Present (Manual)' :
                                     'Absent'}
                                  </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {attendance.markedAt ? formatDateDDMMYYYY(attendance.markedAt) : '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

