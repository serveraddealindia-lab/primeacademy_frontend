import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { sessionAPI, FacultyBatch, StudentAttendanceEntry } from '../api/session.api';
import { useAuth } from '../context/AuthContext';

interface AttendanceState {
  [studentId: number]: boolean;
}

export const FacultyAttendance: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<FacultyBatch | null>(null);
  const [attendanceState, setAttendanceState] = useState<AttendanceState>({});
  const [showAttendancePanel, setShowAttendancePanel] = useState(false);
  const [isFetchingStudents, setIsFetchingStudents] = useState(false);
  const [students, setStudents] = useState<StudentAttendanceEntry[]>([]);

  const {
    data: facultyBatches,
    isLoading: loadingBatches,
    error: batchesError,
  } = useQuery({
    queryKey: ['faculty-batches'],
    queryFn: () => sessionAPI.getFacultyBatches(),
  });

  const startSessionMutation = useMutation({
    mutationFn: ({ batchId, topicValue }: { batchId: number; topicValue?: string }) =>
      sessionAPI.startSession(batchId, topicValue ? { topic: topicValue } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-batches'] });
      alert('Session started!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to start session');
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: (sessionId: number) => sessionAPI.endSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-batches'] });
      setShowAttendancePanel(false);
      setSelectedBatch(null);
      alert('Session ended!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to end session');
    },
  });

  const submitAttendanceMutation = useMutation({
    mutationFn: ({ sessionId, payload }: { sessionId: number; payload: AttendanceState }) =>
      sessionAPI.submitAttendance(sessionId, {
        attendance: Object.entries(payload).map(([studentId, present]) => ({
          studentId: Number(studentId),
          present,
        })),
      }),
    onSuccess: () => {
      alert('Attendance submitted!');
      setShowAttendancePanel(false);
      queryClient.invalidateQueries({ queryKey: ['faculty-batches'] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to submit attendance');
    },
  });

  const loadStudents = useCallback(async (batch: FacultyBatch) => {
    try {
      setIsFetchingStudents(true);
      const batchStudents = await sessionAPI.getBatchStudents(batch.batch.id);
      setStudents(batchStudents);
      const nextState: AttendanceState = {};
      batchStudents.forEach((student) => {
        nextState[student.studentId] = student.present ?? true;
      });
      setAttendanceState(nextState);
      setSelectedBatch(batch);
      setShowAttendancePanel(true);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to load students');
    } finally {
      setIsFetchingStudents(false);
    }
  }, []);

  const handleToggleStudent = (studentId: number) => {
    setAttendanceState((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  const activeSession = useMemo(() => selectedBatch?.activeSession ?? null, [selectedBatch]);

  useEffect(() => {
    if (!showAttendancePanel) {
      setAttendanceState({});
      setStudents([]);
      setSelectedBatch(null);
    }
  }, [showAttendancePanel]);

  const handleStartSession = (batchId: number) => {
    const topicValue = window.prompt('Enter session topic (optional)') || undefined;
    startSessionMutation.mutate({ batchId, topicValue });
  };

  if (loadingBatches) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      </Layout>
    );
  }

  if (batchesError) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto bg-white shadow rounded p-8">
          <p className="text-red-600 font-semibold mb-2">Unable to load batches</p>
          <p className="text-gray-600 text-sm">{(batchesError as any)?.response?.data?.message || (batchesError as any)?.message}</p>
        </div>
      </Layout>
    );
  }

  if (!user || user.role !== 'faculty') {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto bg-white shadow rounded p-8">
          <p className="text-gray-600">This page is available only to faculty users.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-500 px-8 py-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold text-white">My Batches</h1>
              <p className="text-indigo-100">Start sessions, mark attendance, and wrap up classes in one place.</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {facultyBatches && facultyBatches.length === 0 && (
              <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg">
                No batches assigned yet.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {(() => {
                // Check if faculty has ANY active session across ALL batches
                const hasAnyActiveSession = facultyBatches?.some((item) => {
                  const session = item.activeSession;
                  return session && session.status === 'ongoing' && !session.actualEndAt;
                });
                
                return facultyBatches?.map((batchItem) => {
                  const session = batchItem.activeSession;
                  const isOngoing = session && session.status === 'ongoing' && !session.actualEndAt;
                  // Can only start if this batch has no session AND no other batch has an active session
                  const canStartSession = !session && !hasAnyActiveSession;
                  
                  return (
                    <div key={batchItem.batch.id} className="border border-gray-200 rounded-lg p-5 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">{batchItem.batch.title}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            Batch #{batchItem.batch.id}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            isOngoing ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {isOngoing ? 'Session Active' : 'Idle'}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600">
                        {session ? (
                          <>
                            <p>
                              <span className="font-medium">Started:</span>{' '}
                              {session.actualStartAt ? new Date(session.actualStartAt).toLocaleTimeString() : 'Not started'}
                            </p>
                            <p>
                              <span className="font-medium">Topic:</span> {session.topic || 'N/A'}
                            </p>
                          </>
                        ) : (
                          <p className="text-gray-500">No session created today.</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {!session && (
                          <>
                            <button
                              onClick={() => handleStartSession(batchItem.batch.id)}
                              disabled={!canStartSession}
                              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                                canStartSession
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                              title={!canStartSession && hasAnyActiveSession ? 'You already have an active session running. Please end it before starting a new one.' : ''}
                            >
                              Start Session
                            </button>
                            {!canStartSession && hasAnyActiveSession && (
                              <p className="text-xs text-red-600 mt-1 w-full">
                                You have an active session in another batch. End it first.
                              </p>
                            )}
                          </>
                        )}
                      {session && (
                        <>
                          <button
                            onClick={() => loadStudents(batchItem)}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                          >
                            Mark Attendance
                          </button>
                          <button
                            onClick={() => endSessionMutation.mutate(session.id)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                          >
                            End Session
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              });
              })()}
            </div>
          </div>
        </div>

        {/* Attendance Panel */}
        {showAttendancePanel && selectedBatch && (
          <div className="mt-6 bg-white shadow-xl rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedBatch.batch.title} &mdash; Attendance
                </h2>
                {activeSession && (
                  <p className="text-sm text-gray-500">
                    Session started at {activeSession.actualStartAt ? new Date(activeSession.actualStartAt).toLocaleTimeString() : 'N/A'}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowAttendancePanel(false)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Close ✕
              </button>
            </div>

            {activeSession && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => endSessionMutation.mutate(activeSession.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  End Session
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              {isFetchingStudents ? (
                <div className="flex items-center justify-center py-12 text-gray-500">Loading students...</div>
              ) : students.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No students enrolled in this batch.</div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Present?</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.studentId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <label className="inline-flex items-center cursor-pointer space-x-2">
                            <input
                              type="checkbox"
                              className="form-checkbox h-5 w-5 text-green-600"
                              checked={attendanceState[student.studentId] ?? false}
                              onChange={() => handleToggleStudent(student.studentId)}
                            />
                            <span className="text-sm text-gray-700">{attendanceState[student.studentId] ? 'Present' : 'Absent'}</span>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {activeSession && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() =>
                    submitAttendanceMutation.mutate({
                      sessionId: activeSession.id,
                      payload: attendanceState,
                    })
                  }
                  disabled={submitAttendanceMutation.isPending}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {submitAttendanceMutation.isPending ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};


