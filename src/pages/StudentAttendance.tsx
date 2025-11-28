import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { attendanceAPI, PunchInRequest, PunchOutRequest } from '../api/attendance.api';

export const StudentAttendance: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Redirect students away from this page
  React.useEffect(() => {
    if (user?.role === 'student') {
      navigate('/attendance');
    }
  }, [user, navigate]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [fingerprintData, setFingerprintData] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude?: number; longitude?: number; address?: string } | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch today's punch status
  const { data: todayPunchData, isLoading: isLoadingPunch } = useQuery({
    queryKey: ['today-punch'],
    queryFn: () => attendanceAPI.getTodayPunch(),
  });

  // Fetch punch history
  const { data: punchHistoryData } = useQuery({
    queryKey: ['punch-history'],
    queryFn: () => attendanceAPI.getStudentPunchHistory(),
  });

  const punchInMutation = useMutation({
    mutationFn: (data: PunchInRequest) => attendanceAPI.punchIn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-punch'] });
      queryClient.invalidateQueries({ queryKey: ['punch-history'] });
      setCapturedPhoto(null);
      setCapturedFile(null);
      setFingerprintData(null);
      alert('Punched in successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to punch in');
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
      alert('Punched out successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to punch out');
    },
  });

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

  // Start webcam
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
      alert('Unable to access webcam. Please check permissions.');
    }
  }, [getLocation]);

  // Stop webcam
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

  // Capture photo
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

  // Capture fingerprint (simulated - in production, use actual fingerprint scanner)
  const captureFingerprint = useCallback(async () => {
    // Simulate fingerprint capture
    // In production, this would interface with a fingerprint scanner
    const simulatedFingerprint = `FP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setFingerprintData(simulatedFingerprint);
    alert('Fingerprint captured! (Simulated - connect actual scanner in production)');
  }, []);

  // Handle punch in
  const handlePunchIn = useCallback(async () => {
    // Try to get location if not already captured
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

  // Handle punch out
  const handlePunchOut = useCallback(async () => {
    // Try to get location if not already captured
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

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  // Show loading or redirect message for students
  if (user?.role === 'student') {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-gray-600">Redirecting...</p>
          </div>
        </div>
      </Layout>
    );
  }

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

  const todayPunch = todayPunchData?.data.punch
    ? {
        ...todayPunchData.data.punch,
        punchInPhoto: resolvePhotoUrl(todayPunchData.data.punch.punchInPhoto),
        punchOutPhoto: resolvePhotoUrl(todayPunchData.data.punch.punchOutPhoto),
      }
    : null;
  const hasPunchedIn = todayPunchData?.data.hasPunchedIn || false;
  const hasPunchedOut = todayPunchData?.data.hasPunchedOut || false;
  const punches =
    punchHistoryData?.data.punches.map((punch) => ({
      ...punch,
      punchInPhoto: resolvePhotoUrl(punch.punchInPhoto),
      punchOutPhoto: resolvePhotoUrl(punch.punchOutPhoto),
    })) || [];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div>
              <h1 className="text-3xl font-bold text-white">My Attendance</h1>
              <p className="mt-2 text-orange-100">Punch in and punch out (photo and fingerprint are optional)</p>
            </div>
          </div>

          <div className="p-6">
            {/* Today's Status */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4">Today's Status</h2>
              {isLoadingPunch ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : todayPunch ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <p className="text-sm text-gray-600">Working Hours</p>
                    <p className="text-lg font-semibold text-orange-700">
                      {todayPunch.effectiveWorkingHours ? `${todayPunch.effectiveWorkingHours.toFixed(2)} hrs` : '-'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-gray-600">No punch record for today</p>
                </div>
              )}
            </div>

            {/* Photo Capture Section */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4">Capture Photo (Optional)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Webcam View */}
                <div className="space-y-4">
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                    {isCapturing ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
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
                          📸 Capture Photo
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

                {/* Captured Photo Preview */}
                <div className="space-y-4">
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                    {capturedPhoto ? (
                      <img
                        src={capturedPhoto}
                        alt="Captured"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <div className="text-center">
                          <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p>No photo captured</p>
                        </div>
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

            {/* Fingerprint Section */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4">Fingerprint Authentication (Optional)</h2>
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
                    👆 Capture Fingerprint
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Note: Connect a fingerprint scanner device for production use
                </p>
              </div>
            </div>

            {/* Location Info */}
            {location && (
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-4">Location</h2>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600">
                    {location.address || `Lat: ${location.latitude}, Lng: ${location.longitude}`}
                  </p>
                </div>
              </div>
            )}

            {/* Punch In/Out Buttons */}
            <div className="mb-6">
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

            {/* Punch History */}
            <div>
              <h2 className="text-xl font-bold mb-4">Punch History</h2>
              {punches.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No punch history available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Punch In</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Punch Out</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photo</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {punches.map((punch) => (
                        <tr key={punch.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(punch.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {punch.punchInAt ? new Date(punch.punchInAt).toLocaleTimeString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {punch.punchOutAt ? new Date(punch.punchOutAt).toLocaleTimeString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {punch.effectiveWorkingHours ? `${punch.effectiveWorkingHours.toFixed(2)} hrs` : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-2">
                              {punch.punchInPhoto && (
                                <img
                                  src={punch.punchInPhoto}
                                  alt="Punch In"
                                  className="w-12 h-12 rounded object-cover cursor-pointer hover:scale-150 transition-transform"
                                  onClick={() => punch.punchInPhoto && window.open(punch.punchInPhoto, '_blank')}
                                />
                              )}
                              {punch.punchOutPhoto && (
                                <img
                                  src={punch.punchOutPhoto}
                                  alt="Punch Out"
                                  className="w-12 h-12 rounded object-cover cursor-pointer hover:scale-150 transition-transform"
                                  onClick={() => punch.punchOutPhoto && window.open(punch.punchOutPhoto, '_blank')}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

