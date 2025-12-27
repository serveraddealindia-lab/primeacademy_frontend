import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentSoftwareProgressAPI, StudentSoftwareProgress, CreateStudentSoftwareProgressRequest, UpdateStudentSoftwareProgressRequest } from '../api/studentSoftwareProgress.api';
import { studentAPI } from '../api/student.api';

interface SoftwareItem {
  name: string;
  status: 'XX' | 'IP' | 'NO' | 'Finished';
  startDate?: string;
  endDate?: string;
  progressId?: number;
}

export const StudentSoftware: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  // Fetch all students
  const { data: studentsData } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  // Fetch student details including profile and enrollments
  const { data: studentDetailsData } = useQuery({
    queryKey: ['student-details', selectedStudentId],
    queryFn: () => {
      if (!selectedStudentId) return null;
      return studentAPI.getStudentDetails(selectedStudentId);
    },
    enabled: !!selectedStudentId,
  });

  // Fetch existing software progress for selected student
  const { data: progressData } = useQuery({
    queryKey: ['student-software-progress', selectedStudentId],
    queryFn: () => {
      if (!selectedStudentId) return { status: 'success', data: { records: [] } };
      return studentSoftwareProgressAPI.getAll({ studentId: selectedStudentId });
    },
    enabled: !!selectedStudentId,
  });

  // Collect all software from various sources
  const allStudentSoftware = useMemo(() => {
    if (!selectedStudentId) {
      return [];
    }

    const softwareSet = new Set<string>();

    // 1. Software from ALL enrollments (all batches the student is enrolled in)
    const enrollments = studentDetailsData?.data?.student?.enrollments || [];
    
    enrollments.forEach((enrollment: any) => {
      if (enrollment.batch) {
        // Get software from course if available
        if (enrollment.batch.course?.software) {
          let courseSoftware: string[] = [];
          const courseSoftwareData = enrollment.batch.course.software;
          
          if (Array.isArray(courseSoftwareData)) {
            // Already an array - use directly
            courseSoftware = courseSoftwareData.filter((s: any) => s && typeof s === 'string');
          } else if (typeof courseSoftwareData === 'string') {
            // Try to parse as JSON first
            try {
              const parsed = JSON.parse(courseSoftwareData);
              if (Array.isArray(parsed)) {
                courseSoftware = parsed.filter((s: any) => s && typeof s === 'string');
              } else if (typeof parsed === 'string') {
                // Single string value
                courseSoftware = [parsed];
              } else {
                // Fallback to original string
                courseSoftware = [courseSoftwareData];
              }
            } catch {
              // If not JSON, try comma-separated
              courseSoftware = courseSoftwareData.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
          }
          
          courseSoftware.forEach(s => {
            if (s && typeof s === 'string' && s.trim()) {
              softwareSet.add(s.trim());
            }
          });
        }
        
        // Also check batch software (don't skip if course has software - collect both)
        if (enrollment.batch.software) {
          let batchSoftware: string[] = [];
          if (Array.isArray(enrollment.batch.software)) {
            batchSoftware = enrollment.batch.software.filter((s: any) => s && typeof s === 'string');
          } else if (typeof enrollment.batch.software === 'string') {
            try {
              const parsed = JSON.parse(enrollment.batch.software);
              if (Array.isArray(parsed)) {
                batchSoftware = parsed.filter((s: any) => s && typeof s === 'string');
              } else {
                batchSoftware = [enrollment.batch.software];
              }
            } catch {
              batchSoftware = enrollment.batch.software.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
          }
          batchSoftware.forEach(s => {
            if (s && typeof s === 'string' && s.trim()) {
              softwareSet.add(s.trim());
            }
          });
        }
      }
    });

    // 2. Software from student profile
    const studentProfile = studentDetailsData?.data?.student?.studentProfile;
    if (studentProfile?.softwareList) {
      const softwareListData = studentProfile.softwareList;
      
      // softwareList is typed as string[] | undefined, but handle both array and string formats
      // (backend might return it as JSON string or comma-separated string)
      if (Array.isArray(softwareListData)) {
        // Already an array - use directly
        softwareListData.forEach((s) => {
          if (s && typeof s === 'string' && s.trim()) {
            softwareSet.add(s.trim());
          }
        });
      } else {
        // Handle as string (type assertion needed as TypeScript types it as string[])
        const strValue = String(softwareListData as unknown as string);
        try {
          const parsed = JSON.parse(strValue);
          if (Array.isArray(parsed)) {
            parsed.forEach((s: any) => {
              if (s && typeof s === 'string' && s.trim()) {
                softwareSet.add(s.trim());
              }
            });
          } else if (typeof parsed === 'string' && parsed.trim()) {
            softwareSet.add(parsed.trim());
          }
        } catch {
          // If not JSON, treat as comma-separated string
          strValue.split(',').forEach((s: string) => {
            const trimmed = s.trim();
            if (trimmed) {
              softwareSet.add(trimmed);
            }
          });
        }
      }
    }

    // 3. Complimentary software from student profile documents
    if (studentProfile?.documents) {
      let documents = studentProfile.documents;
      // Handle documents as string (JSON) or object
      if (typeof documents === 'string') {
        try {
          documents = JSON.parse(documents);
        } catch {
          documents = {};
        }
      }
      
      const enrollmentMetadata = documents?.enrollmentMetadata || documents;
      if (enrollmentMetadata?.complimentarySoftware) {
        const compSoftware = typeof enrollmentMetadata.complimentarySoftware === 'string'
          ? enrollmentMetadata.complimentarySoftware.split(',').map((s: string) => s.trim()).filter(Boolean)
          : Array.isArray(enrollmentMetadata.complimentarySoftware)
          ? enrollmentMetadata.complimentarySoftware
          : [];
        compSoftware.forEach((s: string) => {
          if (s && typeof s === 'string' && s.trim()) {
            softwareSet.add(s.trim());
          }
        });
      }
    }

    // Note: Software from batch arrays in profile removed as these properties don't exist on StudentProfile
    // Software is already collected from enrollments and profile.softwareList above

    // 5. Software from existing progress records (to catch any tracked software)
    const existingProgress = progressData?.data?.records || [];
    existingProgress.forEach((p: StudentSoftwareProgress) => {
      if (p.softwareName && p.softwareName.trim()) {
        softwareSet.add(p.softwareName.trim());
      }
    });

    const allSoftware = Array.from(softwareSet).sort();
    
    // Debug logging (remove in production if needed)
    if (process.env.NODE_ENV === 'development') {
      console.log('Student Software Collection Debug:', {
        studentId: selectedStudentId,
        enrollmentsCount: enrollments.length,
        enrollments: enrollments.map((e: any) => ({
          batchId: e.batch?.id,
          batchTitle: e.batch?.title,
          course: e.batch?.course,
          batchSoftware: e.batch?.software,
        })),
        studentProfile: studentProfile ? {
          softwareList: studentProfile.softwareList,
          documents: studentProfile.documents ? 'exists' : null,
        } : null,
        progressRecords: progressData?.data?.records?.length || 0,
        collectedSoftware: allSoftware,
        totalCount: allSoftware.length,
      });
    }
    
    // Debug logging (remove in production if needed)
    if (process.env.NODE_ENV === 'development') {
      console.log('Student Software Collection Debug:', {
        studentId: selectedStudentId,
        enrollmentsCount: enrollments.length,
        enrollments: enrollments.map((e: any) => ({
          batchId: e.batch?.id,
          batchTitle: e.batch?.title,
          course: e.batch?.course,
          batchSoftware: e.batch?.software,
        })),
        studentProfile: studentProfile ? {
          softwareList: studentProfile.softwareList,
          documents: studentProfile.documents ? 'exists' : null,
        } : null,
        progressRecords: progressData?.data?.records?.length || 0,
        collectedSoftware: allSoftware,
        totalCount: allSoftware.length,
      });
    }
    
    return allSoftware;
  }, [selectedStudentId, studentDetailsData, progressData]);

  // Organize software by status
  const softwareByStatus = useMemo(() => {
    const notStarted: SoftwareItem[] = [];
    const running: SoftwareItem[] = [];
    const completed: SoftwareItem[] = [];

    const existingProgress = progressData?.data?.records || [];
    const progressMap = new Map<string, StudentSoftwareProgress>();
    
    // Map progress by software name
    existingProgress.forEach((p: StudentSoftwareProgress) => {
      progressMap.set(p.softwareName, p);
    });

    allStudentSoftware.forEach((softwareName) => {
      const progress = progressMap.get(softwareName);

      // Ensure status is one of the valid values
      const getValidStatus = (status: 'XX' | 'IP' | 'NO' | 'Finished' | undefined): 'XX' | 'IP' | 'NO' | 'Finished' => {
        if (status === 'XX' || status === 'IP' || status === 'NO' || status === 'Finished') {
          return status;
        }
        return 'XX';
      };

      const item: SoftwareItem = {
        name: softwareName,
        status: getValidStatus(progress?.status),
        startDate: progress?.batchStartDate ? new Date(progress.batchStartDate).toISOString().split('T')[0] : undefined,
        endDate: progress?.batchEndDate ? new Date(progress.batchEndDate).toISOString().split('T')[0] : undefined,
        progressId: progress?.id,
      };

      if (item.status === 'XX') {
        notStarted.push(item);
      } else if (item.status === 'IP') {
        running.push(item);
      } else if (item.status === 'NO') {
        // 'NO' status can be treated as not started or in a separate category
        notStarted.push(item);
      } else if (item.status === 'Finished') {
        completed.push(item);
      }
    });

    return { notStarted, running, completed };
  }, [allStudentSoftware, progressData]);

  // Create/Update mutation
  const saveProgressMutation = useMutation({
    mutationFn: async ({ studentId, softwareName, status, startDate, endDate, progressId }: {
      studentId: number;
      softwareName: string;
      status: 'XX' | 'IP' | 'NO' | 'Finished';
      startDate?: string;
      endDate?: string;
      progressId?: number;
    }) => {
      const data: CreateStudentSoftwareProgressRequest | UpdateStudentSoftwareProgressRequest = {
        studentId,
        softwareName,
        status,
        batchStartDate: startDate ? new Date(startDate).toISOString() : undefined,
        batchEndDate: endDate ? new Date(endDate).toISOString() : undefined,
      };

      if (progressId) {
        return studentSoftwareProgressAPI.update(progressId, data as UpdateStudentSoftwareProgressRequest);
      } else {
        return studentSoftwareProgressAPI.create(data as CreateStudentSoftwareProgressRequest);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-software-progress', selectedStudentId] });
      queryClient.invalidateQueries({ queryKey: ['student-details', selectedStudentId] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to save software progress');
    },
  });

  const handleStatusChange = (software: SoftwareItem, newStatus: 'XX' | 'IP' | 'NO' | 'Finished') => {
    if (!selectedStudentId) {
      alert('Please select a student first.');
      return;
    }
    saveProgressMutation.mutate({
      studentId: selectedStudentId,
      softwareName: software.name,
      status: newStatus,
      startDate: software.startDate,
      endDate: software.endDate,
      progressId: software.progressId,
    });
  };

  const handleDateChange = (software: SoftwareItem, type: 'start' | 'end', date: string) => {
    if (!selectedStudentId) {
      alert('Please select a student first.');
      return;
    }
    saveProgressMutation.mutate({
      studentId: selectedStudentId,
      softwareName: software.name,
      status: software.status,
      startDate: type === 'start' ? date : software.startDate,
      endDate: type === 'end' ? date : software.endDate,
      progressId: software.progressId,
    });
  };

  const getStatusColor = (status: 'XX' | 'IP' | 'NO' | 'Finished') => {
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

  const students = studentsData?.data?.students || [];

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Student Software Tracking</h2>

      {/* Student Selection */}
      <div className="mb-6">
        <label htmlFor="student-select" className="block text-sm font-medium text-gray-700 mb-2">
          Select Student <span className="text-red-500">*</span>
        </label>
        <select
          id="student-select"
          value={selectedStudentId || ''}
          onChange={(e) => setSelectedStudentId(e.target.value ? parseInt(e.target.value) : null)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          required
        >
          <option value="">-- Select Student --</option>
          {students.map((student: any) => (
            <option key={student.id} value={student.id}>
              {student.name} ({student.email})
            </option>
          ))}
        </select>
      </div>

      {selectedStudentId && allStudentSoftware.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            Software Progress ({allStudentSoftware.length} software)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Not Started Column */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-yellow-800 mb-3">
                Not Started ({softwareByStatus.notStarted.length})
              </h4>
              <div className="space-y-3">
                {softwareByStatus.notStarted.map((software) => (
                  <div key={software.name} className="bg-white p-3 rounded-md shadow-sm border border-yellow-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{software.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(software.status)}`}>
                        Not Started
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <label className="block text-gray-600">Start Date (Optional)</label>
                        <input
                          type="date"
                          value={software.startDate || ''}
                          onChange={(e) => handleDateChange(software, 'start', e.target.value)}
                          className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600">End Date (Optional)</label>
                        <input
                          type="date"
                          value={software.endDate || ''}
                          onChange={(e) => handleDateChange(software, 'end', e.target.value)}
                          className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleStatusChange(software, 'IP')}
                        className="flex-1 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                      >
                        Start
                      </button>
                      <button
                        onClick={() => handleStatusChange(software, 'Finished')}
                        className="flex-1 px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                ))}
                {softwareByStatus.notStarted.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No software</p>
                )}
              </div>
            </div>

            {/* Running Column */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-blue-800 mb-3">
                Running ({softwareByStatus.running.length})
              </h4>
              <div className="space-y-3">
                {softwareByStatus.running.map((software) => (
                  <div key={software.name} className="bg-white p-3 rounded-md shadow-sm border border-blue-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{software.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(software.status)}`}>
                        In Progress
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <label className="block text-gray-600">Start Date (Optional)</label>
                        <input
                          type="date"
                          value={software.startDate || ''}
                          onChange={(e) => handleDateChange(software, 'start', e.target.value)}
                          className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600">End Date (Optional)</label>
                        <input
                          type="date"
                          value={software.endDate || ''}
                          onChange={(e) => handleDateChange(software, 'end', e.target.value)}
                          className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleStatusChange(software, 'XX')}
                        className="flex-1 px-3 py-1 bg-yellow-600 text-white rounded-md text-sm hover:bg-yellow-700"
                      >
                        Mark Not Started
                      </button>
                      <button
                        onClick={() => handleStatusChange(software, 'Finished')}
                        className="flex-1 px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                ))}
                {softwareByStatus.running.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No software</p>
                )}
              </div>
            </div>

            {/* Completed Column */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-green-800 mb-3">
                Completed ({softwareByStatus.completed.length})
              </h4>
              <div className="space-y-3">
                {softwareByStatus.completed.map((software) => (
                  <div key={software.name} className="bg-white p-3 rounded-md shadow-sm border border-green-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{software.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(software.status)}`}>
                        Completed
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <label className="block text-gray-600">Start Date (Optional)</label>
                        <input
                          type="date"
                          value={software.startDate || ''}
                          onChange={(e) => handleDateChange(software, 'start', e.target.value)}
                          className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600">End Date (Optional)</label>
                        <input
                          type="date"
                          value={software.endDate || ''}
                          onChange={(e) => handleDateChange(software, 'end', e.target.value)}
                          className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <button
                        onClick={() => handleStatusChange(software, 'IP')}
                        className="w-full px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                      >
                        Mark In Progress
                      </button>
                    </div>
                  </div>
                ))}
                {softwareByStatus.completed.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No software</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedStudentId && allStudentSoftware.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No software found for this student.</p>
          <p className="text-sm mt-2">Please ensure the student is enrolled in a course or has software listed in their profile.</p>
        </div>
      )}

      {!selectedStudentId && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Please select a student to view their software progress.</p>
        </div>
      )}
    </div>
  );
};
