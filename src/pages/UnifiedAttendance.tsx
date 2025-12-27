import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { attendanceAPI, PunchInRequest, PunchOutRequest } from '../api/attendance.api';
import { sessionAPI, FacultyBatch, StudentAttendanceEntry, AttendanceOption, SessionSummary } from '../api/session.api';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

type AttendanceState = Record<number, AttendanceOption>;
const ATTENDANCE_OPTIONS: AttendanceOption[] = ['present', 'absent', 'late'];

export const UnifiedAttendance: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isFaculty = user?.role === 'faculty';
  const isEmployee = user?.role === 'employee';

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Punch in/out states
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [fingerprintData, setFingerprintData] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude?: number; longitude?: number; address?: string } | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Faculty batch attendance states
  const [selectedBatch, setSelectedBatch] = useState<FacultyBatch | null>(null);
  const [attendanceState, setAttendanceState] = useState<AttendanceState>({});
  const [showStudentList, setShowStudentList] = useState(false);
  const [isFetchingStudents, setIsFetchingStudents] = useState(false);
  const [students, setStudents] = useState<StudentAttendanceEntry[]>([]);
  const [selectedBatchForHistory, setSelectedBatchForHistory] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'punch' | 'history' | 'batches'>(() => {
    // Initialize tab based on user role
    if (user?.role === 'faculty') return 'batches';
    if (user?.role === 'employee') return 'punch';
    return 'punch';
  });

  // Break management states
  const [showBreakReasonModal, setShowBreakReasonModal] = useState(false);
  const [breakReason, setBreakReason] = useState('');

  // Fetch today's punch status (enabled when on punch tab or for employees)
  const shouldFetchPunch = !isFaculty || activeTab === 'punch' || activeTab === 'history';
  const { data: todayPunchData, isLoading: isLoadingPunch, error: todayPunchError } = useQuery({
    queryKey: ['today-punch'],
    queryFn: () => attendanceAPI.getTodayPunch(),
    enabled: shouldFetchPunch && !!user,
    retry: 1,
  });

  // Fetch punch history (enabled when on punch or history tab or for employees)
  const { data: punchHistoryData, error: historyError } = useQuery({
    queryKey: ['punch-history'],
    queryFn: () => attendanceAPI.getStudentPunchHistory(),
    enabled: shouldFetchPunch && !!user,
    retry: 1,
  });

  // Fetch faculty batches (only for faculty)
  const { data: facultyBatches, error: batchesError } = useQuery({
    queryKey: ['faculty-batches'],
    queryFn: () => sessionAPI.getFacultyBatches(),
    enabled: isFaculty,
    retry: 1,
  });

  const punchInMutation = useMutation({
    mutationFn: (data: PunchInRequest) => attendanceAPI.punchIn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-punch'] });
      queryClient.invalidateQueries({ queryKey: ['punch-history'] });
      setCapturedPhoto(null);
      setCapturedFile(null);
      setFingerprintData(null);
      showToast('Punched in successfully!');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to punch in', 'error');
    },
  });

  const punchOutMutation = useMutation({
    mutationFn: (data: PunchOutRequest) => attendanceAPI.punchOut(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-punch'] });
      queryClient.invalidateQueries({ queryKey: ['punch-history'] });
      setCapturedPhoto(null);
      setCapturedFile(null);
      setFingerprintData(null);
      showToast('Punched out successfully!');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to punch out', 'error');
    },
  });

  const [optimisticSessions, setOptimisticSessions] = useState<Record<number, SessionSummary>>({});

  useEffect(() => {
    if (!facultyBatches) return;
    setOptimisticSessions((prev) => {
      const next = { ...prev };
      facultyBatches.forEach((item) => {
        if (item.activeSession) {
          delete next[item.batch.id];
        }
      });
      return next;
    });
  }, [facultyBatches]);

  const startSessionMutation = useMutation({
    mutationFn: ({ batchId, topicValue }: { batchId: number; topicValue?: string }) =>
      sessionAPI.startSession(batchId, topicValue ? { topic: topicValue } : undefined),
    onSuccess: async (sessionSummary, variables) => {
      setOptimisticSessions((prev) => ({
        ...prev,
        [variables.batchId]: sessionSummary,
      }));

      // Optimistically update faculty batches so UI immediately shows "Running"
      queryClient.setQueryData<FacultyBatch[] | undefined>(['faculty-batches'], (prev) => {
        if (!prev) {
          return prev;
        }
        return prev.map((item) =>
          item.batch.id === variables.batchId ? { ...item, activeSession: sessionSummary } : item
        );
      });

      // Give backend a moment to persist before refetching fresh data
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await queryClient.invalidateQueries({ queryKey: ['faculty-batches'] });

      let localBatch = facultyBatches?.find((b) => b.batch.id === variables.batchId);
      if (!localBatch) {
        const fetchedBatches = await queryClient.fetchQuery({
          queryKey: ['faculty-batches'],
          queryFn: () => sessionAPI.getFacultyBatches(),
        });
        localBatch = fetchedBatches?.find((b) => b.batch.id === variables.batchId);
      }

      if (localBatch) {
        loadStudents({
          batch: localBatch.batch,
          activeSession: sessionSummary,
        });
      }

      showToast('Session started!');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to start session', 'error');
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: (sessionId: number) => sessionAPI.endSession(sessionId),
    onSuccess: (sessionSummary) => {
      queryClient.invalidateQueries({ queryKey: ['faculty-batches'] });
      setShowStudentList(false);
      setSelectedBatch(null);
      setOptimisticSessions((prev) => {
        const next = { ...prev };
        if (sessionSummary?.batchId) {
          delete next[sessionSummary.batchId];
        }
        return next;
      });
      showToast('Session ended!');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to end session', 'error');
    },
  });

  const submitAttendanceMutation = useMutation({
    mutationFn: ({ sessionId, payload }: { sessionId: number; payload: AttendanceState }) =>
      sessionAPI.submitAttendance(sessionId, {
      attendance: Object.entries(payload).map(([studentId, status]) => ({
        studentId: Number(studentId),
        status,
        })),
      }),
    onSuccess: () => {
      showToast('Attendance submitted!');
      queryClient.invalidateQueries({ queryKey: ['faculty-batches'] });
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to submit attendance', 'error');
    },
  });

  const breakInMutation = useMutation({
    mutationFn: (reason?: string) => attendanceAPI.breakIn(reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-punch'] });
      setShowBreakReasonModal(false);
      setBreakReason('');
      showToast('Break started successfully!');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to start break', 'error');
      setShowBreakReasonModal(false);
      setBreakReason('');
    },
  });

  const breakOutMutation = useMutation({
    mutationFn: () => attendanceAPI.breakOut(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-punch'] });
      showToast('Break ended successfully!');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to end break', 'error');
    },
  });


  // Fetch batch history
  const { data: batchHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['batch-history', selectedBatchForHistory],
    queryFn: () => sessionAPI.getBatchHistory(selectedBatchForHistory!),
    enabled: !!selectedBatchForHistory,
  });

  const loadStudents = useCallback(async (batch: FacultyBatch) => {
    try {
      setIsFetchingStudents(true);
      const batchStudents = await sessionAPI.getBatchStudents(batch.batch.id);
      setStudents(batchStudents);
      const nextState: AttendanceState = {};
      batchStudents.forEach((student) => {
        const defaultStatus = student.status ?? (student.present ? 'present' : 'absent');
        nextState[student.studentId] = defaultStatus || 'present';
      });
      setAttendanceState(nextState);
      setSelectedBatch(batch);
      setShowStudentList(true);
      setActiveTab('batches');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load students', 'error');
    } finally {
      setIsFetchingStudents(false);
    }
  }, []);

  const handleStudentStatusChange = (studentId: number, status: AttendanceOption) => {
    setAttendanceState((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  // Get user location
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation({ address: 'Geolocation not supported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Error getting location:', error);
        setLocation({ address: 'Location access denied' });
      }
    );
  }, []);

  const dataUrlToFile = useCallback((dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }, []);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
        getLocation();
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
      showToast('Unable to access webcam. Please check permissions.', 'error');
    }
  }, [getLocation]);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(photoDataUrl);
        setCapturedFile(dataUrlToFile(photoDataUrl, `attendance-${Date.now()}.jpg`));
      }
    }
  }, [dataUrlToFile]);

  const captureFingerprint = useCallback(async () => {
    const simulatedFingerprint = `FP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setFingerprintData(simulatedFingerprint);
    showToast('Fingerprint captured! (Simulated - connect actual scanner in production)');
  }, []);

  const handlePunchIn = useCallback(async () => {
    let currentLocation = location;
    if (!currentLocation) {
      try {
        if (navigator.geolocation) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        }
      } catch (error) {
        console.log('Location not available:', error);
      }
    }

    const data: PunchInRequest = {
      photo: capturedPhoto || undefined,
      photoFile: capturedFile || undefined,
      fingerprint: fingerprintData || undefined,
      location: currentLocation || undefined,
    };

    punchInMutation.mutate(data);
    stopWebcam();
  }, [capturedPhoto, capturedFile, fingerprintData, location, punchInMutation, stopWebcam]);

  const handlePunchOut = useCallback(async () => {
    let currentLocation = location;
    if (!currentLocation) {
      try {
        if (navigator.geolocation) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        }
      } catch (error) {
        console.log('Location not available:', error);
      }
    }

    const data: PunchOutRequest = {
      photo: capturedPhoto || undefined,
      photoFile: capturedFile || undefined,
      fingerprint: fingerprintData || undefined,
      location: currentLocation || undefined,
    };

    punchOutMutation.mutate(data);
    stopWebcam();
  }, [capturedPhoto, capturedFile, fingerprintData, location, punchOutMutation, stopWebcam]);

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  const uploadsBaseUrl = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    return apiBase.replace(/\/api\/?$/, '/').replace(/\/+$/, '') || '';
  }, []);

  const resolvePhotoUrl = useCallback(
    (path?: string | null): string | null => {
      if (!path) return null;
      if (path.startsWith('http')) return path;
      const cleanedPath = path.startsWith('/') ? path.slice(1) : path;
      return `${uploadsBaseUrl}/${cleanedPath}`;
    },
    [uploadsBaseUrl]
  );

  const todayPunch = todayPunchData?.data?.punch
    ? {
        ...todayPunchData.data.punch,
        punchInPhoto: resolvePhotoUrl(todayPunchData.data.punch.punchInPhoto),
        punchOutPhoto: resolvePhotoUrl(todayPunchData.data.punch.punchOutPhoto),
      }
    : null;
  const hasPunchedIn = todayPunchData?.data?.hasPunchedIn || false;
  const hasPunchedOut = todayPunchData?.data?.hasPunchedOut || false;

  // Parse breaks and calculate total break time
  const breaks = useMemo(() => {
    if (!todayPunch?.breaks) return [];
    try {
      const breaksData = typeof todayPunch.breaks === 'string' 
        ? JSON.parse(todayPunch.breaks) 
        : todayPunch.breaks;
      return Array.isArray(breaksData) ? breaksData : [];
    } catch {
      return [];
    }
  }, [todayPunch?.breaks]);

  const activeBreak = useMemo(() => {
    return breaks.find((b: any) => b.startTime && !b.endTime) || null;
  }, [breaks]);

  const totalBreakTime = useMemo(() => {
    let totalMinutes = 0;
    breaks.forEach((b: any) => {
      if (b.startTime && b.endTime) {
        const breakStart = new Date(b.startTime);
        const breakEnd = new Date(b.endTime);
        totalMinutes += (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
      } else if (b.startTime && !b.endTime) {
        // Active break - calculate until now
        const breakStart = new Date(b.startTime);
        const now = new Date();
        totalMinutes += (now.getTime() - breakStart.getTime()) / (1000 * 60);
      }
    });
    return totalMinutes;
  }, [breaks]);
  const punches =
    (punchHistoryData?.data?.punches || []).map((punch) => ({
      ...punch,
      punchInPhoto: resolvePhotoUrl(punch.punchInPhoto),
      punchOutPhoto: resolvePhotoUrl(punch.punchOutPhoto),
    }));

  const activeSession = useMemo(() => selectedBatch?.activeSession ?? null, [selectedBatch]);

  // Safety check - ensure user is faculty or employee
  if (!user || (!isFaculty && !isEmployee)) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-gray-600">This page is only available for faculty and employees.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <h1 className="text-3xl font-bold text-white">Attendance</h1>
            <p className="mt-2 text-orange-100">
              {isFaculty ? 'Manage your attendance and student batch attendance' : 'Punch in and punch out (photo and fingerprint optional)'}
            </p>
          </div>

          <div className="p-6">
            {/* Error Messages */}
            {(todayPunchError || historyError || batchesError) && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">
                  {todayPunchError && 'Error loading today\'s punch status. '}
                  {historyError && 'Error loading attendance history. '}
                  {batchesError && 'Error loading batches. '}
                  Please refresh the page or contact support.
                </p>
              </div>
            )}

            {/* Tabs for Faculty */}
            {isFaculty && (
              <div className="mb-6 border-b border-gray-200">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveTab('batches')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'batches'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    My Batches
                  </button>
                  <button
                    onClick={() => setActiveTab('punch')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'punch'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Punch In/Out
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'history'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    History
                  </button>
                </nav>
              </div>
            )}

            {/* Tabs for Employees */}
            {isEmployee && (
              <div className="mb-6 border-b border-gray-200">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveTab('punch')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'punch'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Punch In/Out
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'history'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    History
                  </button>
                </nav>
              </div>
            )}

            {/* Faculty Batches Tab */}
            {isFaculty && activeTab === 'batches' && (
              <div className="space-y-6">
                {batchesError ? (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-red-800 text-sm font-semibold mb-2">Error loading batches</p>
                    <p className="text-red-600 text-xs">
                      {batchesError instanceof Error ? batchesError.message : 'Failed to fetch assigned batches. Please refresh the page.'}
                    </p>
                    <button
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['faculty-batches'] })}
                      className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      Retry
                    </button>
                  </div>
                ) : !facultyBatches ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    <span className="ml-3 text-gray-500">Loading batches...</span>
                  </div>
                ) : facultyBatches.length === 0 ? (
                  <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg">
                    <p className="text-lg font-medium mb-2">No batches assigned yet.</p>
                    <p className="text-sm">Contact your administrator to get assigned to a batch.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {(() => {
                      // Check if faculty has ANY active session across ALL batches
                      const hasAnyActiveSession = facultyBatches?.some((item) => {
                        const session = item.activeSession || optimisticSessions[item.batch.id];
                        return session && session.status === 'ongoing' && !session.actualEndAt;
                      });
                      
                      return facultyBatches?.map((batchItem) => {
                        const selectedBatchSession =
                          selectedBatch && selectedBatch.batch.id === batchItem.batch.id
                            ? selectedBatch.activeSession
                            : null;
                        const session =
                          batchItem.activeSession ||
                          optimisticSessions[batchItem.batch.id] ||
                          selectedBatchSession;
                        const isOngoing = session && session.status === 'ongoing' && !session.actualEndAt;
                        // Can only start if this batch has no session AND no other batch has an active session
                        const canStartSession = !session && !hasAnyActiveSession;
                      
                      // Get schedule for today
                      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                      const todaySchedule = batchItem.batch.schedule?.[dayNames[new Date().getDay()]];
                      
                        return (
                          <div key={batchItem.batch.id} className="border border-gray-200 rounded-lg p-5 space-y-4 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-xl font-semibold text-gray-900">{batchItem.batch.title}</h3>
                              <p className="text-sm text-gray-500 mt-1">Batch #{batchItem.batch.id}</p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                isOngoing ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {isOngoing ? 'Running' : 'Idle'}
                            </span>
                          </div>

                          {/* Schedule Information */}
                          {todaySchedule && (
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                              <p className="text-sm font-medium text-blue-900">
                                Today's Schedule: {todaySchedule.startTime} - {todaySchedule.endTime}
                              </p>
                            </div>
                          )}

                          {session && (
                            <div className="text-sm text-gray-600">
                              <p>
                                <span className="font-medium">Started:</span>{' '}
                                {session.actualStartAt ? new Date(session.actualStartAt).toLocaleTimeString() : 'Not started'}
                              </p>
                              <p>
                                <span className="font-medium">Topic:</span> {session.topic || 'N/A'}
                              </p>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-3">
                            {!session && (
                              <>
                                <button
                                  onClick={() => {
                                    const topic = prompt('Enter session topic (optional):');
                                    startSessionMutation.mutate({ batchId: batchItem.batch.id, topicValue: topic || undefined });
                                  }}
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

                          {/* Batch History Button */}
                          <button
                            onClick={() => setSelectedBatchForHistory(batchItem.batch.id)}
                            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors text-sm"
                          >
                            View History
                          </button>
                        </div>
                      );
                      });
                    })()}
                  </div>
                )}

                {/* Student List for Attendance */}
                {showStudentList && selectedBatch && (
                  <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{selectedBatch.batch.title} - Attendance</h2>
                        {activeSession && (
                          <p className="text-sm text-gray-500">
                            Session started at {activeSession.actualStartAt ? new Date(activeSession.actualStartAt).toLocaleTimeString() : 'N/A'}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setShowStudentList(false);
                          setSelectedBatch(null);
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ✕ Close
                      </button>
                    </div>

                    {isFetchingStudents ? (
                      <div className="flex items-center justify-center py-12 text-gray-500">Loading students...</div>
                    ) : students.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">No students enrolled in this batch.</div>
                    ) : (
                      <>
                        <div className="overflow-x-auto mb-4">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {students.map((student) => (
                                <tr key={student.studentId} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.email}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <div className="flex items-center justify-center gap-4">
                                      {ATTENDANCE_OPTIONS.map((option) => (
                                        <label key={option} className="flex items-center space-x-1 text-sm cursor-pointer">
                                          <input
                                            type="radio"
                                            name={`attendance-${student.studentId}`}
                                            value={option}
                                            checked={(attendanceState[student.studentId] ?? 'present') === option}
                                            onChange={() => handleStudentStatusChange(student.studentId, option)}
                                            className="text-orange-600 focus:ring-orange-500"
                                          />
                                          <span className="capitalize">{option}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {activeSession && (
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => endSessionMutation.mutate(activeSession.id)}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                            >
                              End Session
                            </button>
                            <button
                              onClick={() =>
                                submitAttendanceMutation.mutate({
                                  sessionId: activeSession.id,
                                  payload: attendanceState,
                                })
                              }
                              disabled={submitAttendanceMutation.isPending}
                              className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              {submitAttendanceMutation.isPending ? 'Saving...' : 'Save Attendance'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Batch History Modal */}
                {selectedBatchForHistory && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Batch History</h2>
                        <button
                          onClick={() => {
                            setSelectedBatchForHistory(null);
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ✕ Close
                        </button>
                      </div>

                      {isLoadingHistory ? (
                        <div className="flex justify-center py-12">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                        </div>
                      ) : !batchHistory || batchHistory.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No session history available</div>
                      ) : (
                        <div className="space-y-4">
                          {batchHistory.map((session: any) => (
                            <div key={session.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {formatDateDDMMYYYY(session.date)}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {session.topic && `Topic: ${session.topic}`}
                                  </p>
                                </div>
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    session.status === 'ongoing'
                                      ? 'bg-green-100 text-green-700'
                                      : session.status === 'completed'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {session.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                                <div>
                                  <span className="font-medium">Start:</span>{' '}
                                  {session.actualStartAt ? new Date(session.actualStartAt).toLocaleString() : 'N/A'}
                                </div>
                                <div>
                                  <span className="font-medium">End:</span>{' '}
                                  {session.actualEndAt ? new Date(session.actualEndAt).toLocaleString() : 'N/A'}
                                </div>
                              </div>
                              <div className="border-t border-gray-200 pt-3">
                                <p className="text-sm font-medium text-gray-700 mb-2">
                                  Attendance: {session.attendance.present} Present, {session.attendance.absent} Absent
                                  {session.attendance.total > 0 && ` (Total: ${session.attendance.total})`}
                                </p>
                                {session.attendance.students.length > 0 && (
                                  <div className="max-h-40 overflow-y-auto">
                                    <table className="min-w-full text-xs">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-2 py-1 text-left">Student</th>
                                          <th className="px-2 py-1 text-center">Status</th>
                                          <th className="px-2 py-1 text-left">Marked At</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {session.attendance.students.map((student: any, idx: number) => (
                                          <tr key={idx}>
                                            <td className="px-2 py-1">{student.studentName}</td>
                                            <td className="px-2 py-1 text-center">
                                              <span
                                                className={`px-2 py-0.5 rounded ${
                                                  student.status === 'present'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                }`}
                                              >
                                                {student.status}
                                              </span>
                                            </td>
                                            <td className="px-2 py-1 text-gray-500">
                                              {student.markedAt ? new Date(student.markedAt).toLocaleTimeString() : '-'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Punch In/Out Tab */}
            {activeTab === 'punch' && (
              <div className="space-y-6">
                {/* Today's Status */}
                <div>
                  <h2 className="text-xl font-bold mb-4">Today's Status</h2>
                  {todayPunchError ? (
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-red-800 text-sm">Error loading today's status. Please try again.</p>
                    </div>
                  ) : isLoadingPunch ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    </div>
                  ) : todayPunch ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <p className="text-sm text-gray-600">Punch In</p>
                        <p className="text-lg font-semibold text-green-700">
                          {todayPunch.punchInAt ? new Date(todayPunch.punchInAt).toLocaleTimeString() : 'Not punched in'}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg border ${hasPunchedOut ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                        <p className="text-sm text-gray-600">Punch Out</p>
                        <p className={`text-lg font-semibold ${hasPunchedOut ? 'text-blue-700' : 'text-gray-500'}`}>
                          {todayPunch.punchOutAt ? new Date(todayPunch.punchOutAt).toLocaleTimeString() : 'Not punched out'}
                        </p>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <p className="text-sm text-gray-600">Total Break Time</p>
                        <p className="text-lg font-semibold text-yellow-700">
                          {breaks.length > 0 ? `${Math.floor(totalBreakTime / 60)}h ${Math.round(totalBreakTime % 60)}m` : '0m'}
                        </p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                        <p className="text-sm text-gray-600">Working Hours</p>
                        <p className="text-lg font-semibold text-orange-700">
                          {(() => {
                            const hours = todayPunch.effectiveWorkingHours ?? todayPunch.effectiveHours;
                            if (hours == null) return '-';
                            const numHours = typeof hours === 'number' ? hours : parseFloat(String(hours));
                            return isNaN(numHours) ? '-' : `${numHours.toFixed(2)} hrs`;
                          })()}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <p className="text-gray-600">No punch record for today</p>
                    </div>
                  )}
                </div>

                {/* Photo Capture (Optional) */}
                <div>
                  <h2 className="text-xl font-bold mb-4">Capture Photo (Optional)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                        {isCapturing ? (
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <div className="text-center">
                              <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <p>Camera not active</p>
                            </div>
                          </div>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                      <div className="flex gap-2">
                        {!isCapturing ? (
                          <button
                            onClick={startWebcam}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                          >
                            📷 Start Camera
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={capturePhoto}
                              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                            >
                              📸 Capture
                            </button>
                            <button
                              onClick={stopWebcam}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                            >
                              Stop
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                        {capturedPhoto ? (
                          <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <p>No photo captured</p>
                          </div>
                        )}
                      </div>
                      {capturedPhoto && (
                        <button
                          onClick={() => {
                            setCapturedPhoto(null);
                            setCapturedFile(null);
                          }}
                          className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                        >
                          Clear Photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fingerprint (Optional) */}
                <div>
                  <h2 className="text-xl font-bold mb-4">Fingerprint (Optional)</h2>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Fingerprint Status</p>
                        <p className="text-sm font-medium">
                          {fingerprintData ? '✓ Fingerprint captured' : 'No fingerprint captured'}
                        </p>
                      </div>
                      <button
                        onClick={captureFingerprint}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                      >
                        👆 Capture
                      </button>
                    </div>
                  </div>
                </div>

                {/* Break Management */}
                {hasPunchedIn && !hasPunchedOut && (
                  <div>
                    <h2 className="text-xl font-bold mb-4">Break Management</h2>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                      {/* Break Status */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Break Status</p>
                          <p className="text-sm font-medium">
                            {activeBreak ? (
                              <span className="text-orange-600">
                                On Break since {new Date(activeBreak.startTime).toLocaleTimeString()}
                              </span>
                            ) : (
                              <span className="text-gray-500">Not on break</span>
                            )}
                          </p>
                          {breaks.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Total Break Time Today: {Math.floor(totalBreakTime / 60)}h {Math.round(totalBreakTime % 60)}m
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!activeBreak ? (
                            <button
                              onClick={() => setShowBreakReasonModal(true)}
                              disabled={breakInMutation.isPending}
                              className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50"
                            >
                              {breakInMutation.isPending ? 'Starting...' : '☕ Break In'}
                            </button>
                          ) : (
                            <button
                              onClick={() => breakOutMutation.mutate()}
                              disabled={breakOutMutation.isPending}
                              className="px-4 py-2 bg-yellow-700 text-white rounded-lg font-semibold hover:bg-yellow-800 transition-colors disabled:opacity-50"
                            >
                              {breakOutMutation.isPending ? 'Ending...' : '✅ Break Out'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Break History */}
                      {breaks.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Today's Breaks:</p>
                          <div className="space-y-2">
                            {breaks.map((breakItem: any, index: number) => (
                              <div key={index} className="bg-white p-3 rounded border border-gray-200">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-sm text-gray-900">
                                      <span className="font-medium">Break {index + 1}:</span>{' '}
                                      {breakItem.startTime ? new Date(breakItem.startTime).toLocaleTimeString() : '-'}
                                      {breakItem.endTime ? ` - ${new Date(breakItem.endTime).toLocaleTimeString()}` : ' (Active)'}
                                    </p>
                                    {breakItem.reason && (
                                      <p className="text-xs text-gray-500 mt-1">Reason: {breakItem.reason}</p>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {breakItem.startTime && breakItem.endTime ? (
                                      (() => {
                                        const start = new Date(breakItem.startTime);
                                        const end = new Date(breakItem.endTime);
                                        const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
                                        return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
                                      })()
                                    ) : activeBreak && breakItem.startTime ? (
                                      (() => {
                                        const start = new Date(breakItem.startTime);
                                        const now = new Date();
                                        const minutes = Math.round((now.getTime() - start.getTime()) / (1000 * 60));
                                        return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
                                      })()
                                    ) : '-'}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Break Reason Modal */}
                {showBreakReasonModal && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                      <h3 className="text-xl font-bold mb-4">Start Break</h3>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Break Reason (Optional)
                        </label>
                        <input
                          type="text"
                          value={breakReason}
                          onChange={(e) => setBreakReason(e.target.value)}
                          placeholder="e.g., Lunch, Tea Break, Personal"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              breakInMutation.mutate(breakReason || undefined);
                            } else if (e.key === 'Escape') {
                              setShowBreakReasonModal(false);
                              setBreakReason('');
                            }
                          }}
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => {
                            setShowBreakReasonModal(false);
                            setBreakReason('');
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => breakInMutation.mutate(breakReason || undefined)}
                          disabled={breakInMutation.isPending}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50"
                        >
                          Start Break
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Punch In/Out Buttons */}
                <div>
                  <h2 className="text-xl font-bold mb-4">Actions</h2>
                  <div className="flex gap-4">
                    <button
                      onClick={handlePunchIn}
                      disabled={hasPunchedIn || punchInMutation.isPending}
                      className="flex-1 px-6 py-4 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {punchInMutation.isPending ? 'Punching In...' : hasPunchedIn ? '✓ Already Punched In' : '🟢 Punch In'}
                    </button>
                    <button
                      onClick={handlePunchOut}
                      disabled={!hasPunchedIn || hasPunchedOut || punchOutMutation.isPending}
                      className="flex-1 px-6 py-4 bg-red-600 text-white rounded-lg font-semibold text-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {punchOutMutation.isPending ? 'Punching Out...' : hasPunchedOut ? '✓ Already Punched Out' : '🔴 Punch Out'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                <h2 className="text-xl font-bold mb-4">Attendance History</h2>
                {historyError ? (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-red-800 text-sm">Error loading attendance history. Please try again.</p>
                  </div>
                ) : punches.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No attendance history available</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Punch In</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Punch Out</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Break Time</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {punches.map((punch) => {
                          // Calculate break time for each punch
                          const punchBreaks = (() => {
                            if (!punch.breaks) return [];
                            try {
                              const breaksData = typeof punch.breaks === 'string' ? JSON.parse(punch.breaks) : punch.breaks;
                              return Array.isArray(breaksData) ? breaksData : [];
                            } catch {
                              return [];
                            }
                          })();
                          
                          const punchBreakMinutes = punchBreaks.reduce((total: number, b: any) => {
                            if (b.startTime && b.endTime) {
                              const breakStart = new Date(b.startTime);
                              const breakEnd = new Date(b.endTime);
                              return total + (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
                            }
                            return total;
                          }, 0);

                          return (
                            <tr key={punch.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDateDDMMYYYY(punch.date)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {punch.punchInAt ? new Date(punch.punchInAt).toLocaleTimeString() : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {punch.punchOutAt ? new Date(punch.punchOutAt).toLocaleTimeString() : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {punchBreakMinutes > 0 ? `${Math.floor(punchBreakMinutes / 60)}h ${Math.round(punchBreakMinutes % 60)}m` : '0m'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {(() => {
                                  const hours = punch.effectiveWorkingHours ?? punch.effectiveHours;
                                  if (hours == null) return '-';
                                  const numHours = typeof hours === 'number' ? hours : parseFloat(String(hours));
                                  return isNaN(numHours) ? '-' : `${numHours.toFixed(2)} hrs`;
                                })()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

