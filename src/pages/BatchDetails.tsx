import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { batchAPI, Batch } from '../api/batch.api';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const BatchDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);

  const { data: batchData, isLoading, error } = useQuery({
    queryKey: ['batch', id],
    queryFn: () => batchAPI.getBatchById(Number(id)),
    enabled: !!id,
  });

  useEffect(() => {
    if (batchData?.data.batch) {
      setBatch(batchData.data.batch);
    }
  }, [batchData]);

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

  if (error || !batch) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-8">
            <div className="text-center">
              <p className="text-red-600 mb-4">Failed to load batch details</p>
              <button
                onClick={() => navigate('/batches')}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Back to Batches
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
        <div className="mb-6">
          <button
            onClick={() => navigate('/batches')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Batches
          </button>
        </div>

        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="space-y-6 p-6">
            <div className="rounded-2xl bg-gradient-to-r from-orange-600 to-pink-500 p-5 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-orange-100">Batch Overview</p>
                <h1 className="text-3xl font-bold">{batch.title}</h1>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="px-3 py-1 rounded-full bg-white/20">{batch.mode}</span>
                  <span
                    className={`px-3 py-1 rounded-full ${
                      batch.status === 'active' ? 'bg-emerald-200/80 text-emerald-800' : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {batch.status || 'inactive'}
                  </span>
                  {batch.maxCapacity && (
                    <span className="px-3 py-1 rounded-full bg-white/20">{batch.maxCapacity} seats</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleDownloadBatchCsv(batch)}
                  className="px-4 py-2 rounded-lg bg-white text-orange-600 font-semibold shadow hover:bg-gray-100 transition-colors"
                >
                  Download CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-xl border border-gray-200 p-5 space-y-4">
                <h4 className="text-lg font-semibold text-gray-900">Key Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
                  <div>
                    <p className="text-xs uppercase text-gray-500">Start Date</p>
                    <p className="font-medium">{new Date(batch.startDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">End Date</p>
                    <p className="font-medium">{new Date(batch.endDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">Software</p>
                    <p className="font-medium">{batch.software || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">Created At</p>
                    <p className="font-medium">
                      {batch.createdAt ? new Date(batch.createdAt).toLocaleString() : '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-5 space-y-4">
                <h4 className="text-lg font-semibold text-gray-900">Schedule</h4>
                {batch.schedule && Object.keys(batch.schedule).length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {Object.entries(batch.schedule).map(([day, times]) => (
                      <div key={day} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium text-gray-700">{day}</span>
                        <span className="text-gray-600">
                          {times.startTime} - {times.endTime}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No schedule defined.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-gray-900">Assigned Faculty</h4>
                  <span className="text-xs text-gray-500">
                    {batch.assignedFaculty?.length || 0} member(s)
                  </span>
                </div>
                {batch.assignedFaculty && batch.assignedFaculty.length > 0 ? (
                  <div className="space-y-3">
                    {batch.assignedFaculty.map((faculty) => (
                      <div
                        key={faculty.id}
                        className="flex flex-col rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-gray-900">{faculty.name}</span>
                        <span className="text-gray-600">{faculty.email}</span>
                        {faculty.phone && <span className="text-gray-500">{faculty.phone}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No faculty assigned.</p>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-gray-900">Enrolled Students</h4>
                  <span className="text-xs text-gray-500">
                    {batch.enrollments?.length || 0} student(s)
                  </span>
                </div>
                {batch.enrollments && batch.enrollments.length > 0 ? (
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {batch.enrollments.map((enrollment, index) => {
                      const studentId = enrollment.student?.id ?? enrollment.id ?? index;
                      const studentName = enrollment.student?.name ?? enrollment.name ?? 'Unknown Student';
                      const studentEmail = enrollment.student?.email ?? enrollment.email ?? '-';
                      const studentPhone = enrollment.student?.phone ?? enrollment.phone;
                      return (
                        <div key={studentId} className="flex flex-col rounded-lg border border-gray-100 px-3 py-2 text-sm">
                          <span className="font-semibold text-gray-900">{studentName}</span>
                          <span className="text-gray-600">{studentEmail}</span>
                          {studentPhone && <span className="text-gray-500">{studentPhone}</span>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No students enrolled yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

