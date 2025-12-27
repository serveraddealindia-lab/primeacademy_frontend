import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { batchAPI, UpdateBatchRequest, SuggestedCandidate } from '../api/batch.api';
import { studentAPI } from '../api/student.api';
import { facultyAPI } from '../api/faculty.api';
import { courseAPI } from '../api/course.api';
import { formatDateInputToDDMMYYYY } from '../utils/dateUtils';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface DaySchedule {
  startTime: string;
  endTime: string;
}

export const BatchEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const batchId = id ? parseInt(id, 10) : null;
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [daySchedules, setDaySchedules] = useState<Record<string, DaySchedule>>({});
  const [applyToAll, setApplyToAll] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [exceptionStudentIds, setExceptionStudentIds] = useState<number[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<number[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestedCandidates, setSuggestedCandidates] = useState<SuggestedCandidate[]>([]);
  const [showOtherSoftwareInput, setShowOtherSoftwareInput] = useState(false);
  const [otherSoftware, setOtherSoftware] = useState('');
  const [selectedSoftwares, setSelectedSoftwares] = useState<string[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [startDateDisplay, setStartDateDisplay] = useState('');
  const [endDateDisplay, setEndDateDisplay] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [batchStatus, setBatchStatus] = useState<string>('active');
  const [isLoadingBatch, setIsLoadingBatch] = useState(true);

  // Fetch batch details
  const { data: batchData, isLoading: isLoadingBatchData } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => batchAPI.getBatchById(batchId!),
    enabled: !!batchId,
  });

  // Fetch all students
  const { data: studentsData } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  // Fetch all faculty (with high limit to get all)
  const { data: facultyData, isLoading: isLoadingFaculty } = useQuery({
    queryKey: ['faculty'],
    queryFn: () => facultyAPI.getAllFaculty(1000),
  });

  // Fetch all courses
  const { data: coursesData, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseAPI.getAllCourses(),
  });

  // Initialize form data when batch is loaded
  useEffect(() => {
    if (batchData?.data?.batch) {
      const batch = batchData.data.batch;
      
      // Set basic fields
      setBatchStatus(batch.status || 'active');
      setSelectedCourseId(batch.courseId || null);
      
      // Set schedule
      if (batch.schedule) {
        setDaySchedules(batch.schedule as Record<string, DaySchedule>);
      }
      
      // Set faculty
      if (batch.assignedFaculty && batch.assignedFaculty.length > 0) {
        setSelectedFaculty(batch.assignedFaculty.map(f => f.id));
      }
      
      // Set students and exceptions
      if (batch.enrollments && batch.enrollments.length > 0) {
        const studentIds: number[] = [];
        const exceptionIds: number[] = [];
        
        batch.enrollments.forEach((enrollment: any) => {
          const studentId = enrollment.student?.id ?? enrollment.id;
          if (studentId) {
            studentIds.push(studentId);
            // Check if enrollment status is 'exception'
            if (enrollment.status === 'exception' || enrollment.enrollmentStatus === 'exception') {
              exceptionIds.push(studentId);
            }
          }
        });
        
        setSelectedStudents(studentIds);
        setExceptionStudentIds(exceptionIds);
      }
      
      // Set software
      if (batch.software) {
        const softwareList = batch.software.split(',').map(s => s.trim()).filter(s => s);
        const standardSoftwares = [
          'Photoshop', 'Illustrator', 'InDesign', 'After Effects', 'Premiere Pro',
          'Figma', 'Sketch', 'Blender', 'Maya', '3ds Max', 'Cinema 4D', 'Lightroom',
          'CorelDRAW', 'AutoCAD', 'SolidWorks', 'Revit', 'SketchUp', 'Unity',
          'Unreal Engine', 'DaVinci Resolve', 'Final Cut Pro', 'Procreate',
          'Affinity Designer', 'Affinity Photo', 'Canva Pro'
        ];
        const selectedStandard = softwareList.filter(s => standardSoftwares.includes(s));
        const otherSoftwares = softwareList.filter(s => !standardSoftwares.includes(s));
        
        setSelectedSoftwares(selectedStandard);
        if (otherSoftwares.length > 0) {
          setOtherSoftware(otherSoftwares.join(', '));
          setShowOtherSoftwareInput(true);
        }
      }
      
      setIsLoadingBatch(false);
    }
  }, [batchData]);

  const updateBatchMutation = useMutation({
    mutationFn: async (data: UpdateBatchRequest) => batchAPI.updateBatch(batchId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      alert('Batch updated successfully!');
      navigate('/batches');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update batch');
    },
  });

  const handleDayToggle = (day: string) => {
    setDaySchedules(prev => {
      if (prev[day]) {
        const newSchedules = { ...prev };
        delete newSchedules[day];
        return newSchedules;
      } else {
        return {
          ...prev,
          [day]: { startTime: '', endTime: '' }
        };
      }
    });
  };

  const handleTimeChange = (day: string, field: 'startTime' | 'endTime', value: string) => {
    setDaySchedules(prev => {
      const updated = { ...prev };
      
      if (applyToAll) {
        Object.keys(prev).forEach(d => {
          updated[d] = {
            ...prev[d],
            [field]: value
          };
        });
      } else {
        updated[day] = {
          ...prev[day],
          [field]: value
        };
      }
      
      return updated;
    });
  };

  const handleUpdateBatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Get software from selected softwares - REQUIRED
    const softwareValue = selectedSoftwares.length > 0 
      ? selectedSoftwares.join(', ')
      : '';
    
    if (!softwareValue || softwareValue.trim() === '') {
      alert('Please select at least one software for this batch.');
      return;
    }
    
    // Validate faculty selection
    if (selectedFaculty.length === 0) {
      alert('Please select at least one faculty member to assign to this batch.');
      return;
    }

    // Get status - use state value as fallback if FormData doesn't have it
    let statusValue = (formData.get('status') as string) || batchStatus;
    const finalStatus = statusValue && statusValue.trim() ? statusValue.trim() : 'active';

    const data: UpdateBatchRequest = {
      title: (formData.get('title') as string)?.trim() || undefined,
      software: softwareValue.trim(),
      mode: (formData.get('mode') as string) || undefined,
      startDate: (formData.get('startDate') as string) || undefined,
      endDate: (formData.get('endDate') as string) || undefined,
      maxCapacity: formData.get('maxCapacity') ? parseInt(formData.get('maxCapacity') as string) : undefined,
      status: finalStatus,
      schedule: Object.keys(daySchedules).length > 0 ? 
        Object.fromEntries(
          Object.entries(daySchedules).filter(([_, times]) => times.startTime && times.endTime)
        ) : undefined,
      facultyIds: selectedFaculty,
      studentIds: selectedStudents, // Always send array, even if empty, so backend can process removals
      exceptionStudentIds: exceptionStudentIds.length > 0 ? exceptionStudentIds : undefined,
      courseId: selectedCourseId || null,
    };
    
    updateBatchMutation.mutate(data);
  };

  const handleGetSuggestions = async () => {
    const form = document.querySelector('form') as HTMLFormElement;
    if (!form) return;
    
    const formData = new FormData(form);
    const software = selectedSoftwares.length > 0 ? selectedSoftwares.join(', ') : undefined;
    const startDate = formData.get('startDate') as string;
    
    if (!software || !startDate) {
      alert('Please select software and enter start date first to get suggestions');
      return;
    }

    // Get at least one faculty ID for the temporary batch
    let tempFacultyIds: number[] = [];
    if (selectedFaculty.length > 0) {
      tempFacultyIds = selectedFaculty;
    } else if (facultyData?.data?.users && facultyData.data.users.length > 0) {
      tempFacultyIds = [facultyData.data.users[0].id];
    } else {
      alert('Please select at least one faculty member first, or ensure faculty data is loaded');
      return;
    }

    // Create a temporary batch to get suggestions
    try {
      const statusValue = (formData.get('status') as string) || batchStatus || 'active';
      
      const tempData = {
        title: 'TEMP_FOR_SUGGESTIONS',
        software,
        mode: formData.get('mode') as string || 'online',
        startDate,
        endDate: formData.get('endDate') as string || startDate,
        maxCapacity: 100,
        status: statusValue,
        facultyIds: tempFacultyIds,
      };
      
      const tempBatch = await batchAPI.createBatch(tempData);
      if (tempBatch.data.batch) {
        const suggestions = await batchAPI.suggestCandidates(tempBatch.data.batch.id);
        if (suggestions.data && suggestions.data.candidates) {
          setSuggestedCandidates(suggestions.data.candidates);
          setShowSuggestions(true);
        } else {
          setSuggestedCandidates([]);
          setShowSuggestions(true);
        }
        // Delete temporary batch
        try {
          await batchAPI.deleteBatch(tempBatch.data.batch.id);
        } catch (err) {
          console.error('Failed to delete temp batch:', err);
        }
      } else {
        alert('Failed to create temporary batch for suggestions');
      }
    } catch (error: any) {
      console.error('Error getting suggestions:', error);
      alert(error.response?.data?.message || 'Failed to get suggestions. Please check console for details.');
    }
  };

  const handleToggleStudent = (studentId: number) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleToggleFaculty = (facultyId: number) => {
    setSelectedFaculty(prev => 
      prev.includes(facultyId) 
        ? prev.filter(id => id !== facultyId)
        : [...prev, facultyId]
    );
  };

  const handleSelectSuggested = (candidate: SuggestedCandidate) => {
    if (candidate.status === 'available' || candidate.status === 'fees_overdue' || candidate.status === 'pending_fees' || candidate.status === 'no_orientation') {
      handleToggleStudent(candidate.studentId);
    }
  };

  const handleToggleException = (studentId: number, isException: boolean) => {
    if (isException) {
      setExceptionStudentIds(prev => [...prev, studentId]);
      if (!selectedStudents.includes(studentId)) {
        setSelectedStudents(prev => [...prev, studentId]);
      }
    } else {
      setExceptionStudentIds(prev => prev.filter(id => id !== studentId));
    }
  };

  const students = studentsData?.data.students || [];
  const faculty = facultyData?.data?.users || [];
  const batch = batchData?.data?.batch;

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600">You don't have permission to edit batches.</p>
            <button
              onClick={() => navigate('/batches')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Back to Batches
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoadingBatchData || isLoadingBatch || !batch) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              <span className="ml-3 text-gray-600">Loading batch details...</span>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Edit Batch</h1>
                <p className="mt-2 text-orange-100">Update batch details and settings</p>
              </div>
              <button
                onClick={() => navigate('/batches')}
                className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>

          <div className="p-8 max-h-[calc(100vh-12rem)] overflow-y-auto">
            <form onSubmit={handleUpdateBatch} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batch Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    defaultValue={batch.title}
                    placeholder="e.g., Digital Art Fundamentals - Batch 1"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course (Optional)
                  </label>
                  <select
                    value={selectedCourseId || ''}
                    onChange={(e) => setSelectedCourseId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select a course (optional)</option>
                    {isLoadingCourses ? (
                      <option disabled>Loading courses...</option>
                    ) : (
                      coursesData?.data?.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))
                    )}
                  </select>
                  {selectedCourseId && coursesData?.data?.find(c => c.id === selectedCourseId) && (
                    <p className="mt-1 text-xs text-gray-600">
                      Software: {Array.isArray(coursesData.data.find(c => c.id === selectedCourseId)?.software) 
                        ? coursesData.data.find(c => c.id === selectedCourseId)?.software.join(', ')
                        : 'N/A'}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Software
                  </label>
                  <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        'Photoshop',
                        'Illustrator',
                        'InDesign',
                        'After Effects',
                        'Premiere Pro',
                        'Figma',
                        'Sketch',
                        'Blender',
                        'Maya',
                        '3ds Max',
                        'Cinema 4D',
                        'Lightroom',
                        'CorelDRAW',
                        'AutoCAD',
                        'SolidWorks',
                        'Revit',
                        'SketchUp',
                        'Unity',
                        'Unreal Engine',
                        'DaVinci Resolve',
                        'Final Cut Pro',
                        'Procreate',
                        'Affinity Designer',
                        'Affinity Photo',
                        'Canva Pro',
                        'Other',
                      ].map((software) => (
                        <label 
                          key={software} 
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={software === 'Other' ? showOtherSoftwareInput : selectedSoftwares.includes(software)}
                            onChange={(e) => {
                              if (software === 'Other') {
                                setShowOtherSoftwareInput(e.target.checked);
                              } else {
                                if (e.target.checked) {
                                  setSelectedSoftwares(prev => [...prev, software]);
                                } else {
                                  setSelectedSoftwares(prev => prev.filter(s => s !== software));
                                }
                              }
                            }}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-700">{software}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {showOtherSoftwareInput && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Specify Other Software
                      </label>
                      <input
                        type="text"
                        value={otherSoftware}
                        onChange={(e) => {
                          const value = e.target.value;
                          setOtherSoftware(value);
                          if (value.trim()) {
                            const newSoftwares = value.split(',').map(s => s.trim()).filter(s => s);
                            setSelectedSoftwares(prev => {
                              const standardSoftwares = prev.filter(s => 
                                ['Photoshop', 'Illustrator', 'InDesign', 'After Effects', 'Premiere Pro', 
                                 'Figma', 'Sketch', 'Blender', 'Maya', '3ds Max', 'Cinema 4D', 'Lightroom',
                                 'CorelDRAW', 'AutoCAD', 'SolidWorks', 'Revit', 'SketchUp', 'Unity',
                                 'Unreal Engine', 'DaVinci Resolve', 'Final Cut Pro', 'Procreate',
                                 'Affinity Designer', 'Affinity Photo', 'Canva Pro'].includes(s)
                              );
                              return [...standardSoftwares, ...newSoftwares];
                            });
                          } else {
                            setSelectedSoftwares(prev => prev.filter(s => 
                              ['Photoshop', 'Illustrator', 'InDesign', 'After Effects', 'Premiere Pro', 
                               'Figma', 'Sketch', 'Blender', 'Maya', '3ds Max', 'Cinema 4D', 'Lightroom',
                               'CorelDRAW', 'AutoCAD', 'SolidWorks', 'Revit', 'SketchUp', 'Unity',
                               'Unreal Engine', 'DaVinci Resolve', 'Final Cut Pro', 'Procreate',
                               'Affinity Designer', 'Affinity Photo', 'Canva Pro'].includes(s)
                            ));
                          }
                        }}
                        placeholder="Enter software names (comma separated)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  )}
                  {selectedSoftwares.length > 0 && (
                    <p className="mt-2 text-xs text-gray-600">
                      Selected: {selectedSoftwares.join(', ')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="mode"
                    required
                    defaultValue={batch.mode}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select mode</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    required
                    defaultValue={batch.startDate.split('T')[0]}
                    onChange={(e) => {
                      setStartDateDisplay(formatDateInputToDDMMYYYY(e.target.value));
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  {startDateDisplay && (
                    <p className="mt-1 text-sm text-gray-600">Selected: {startDateDisplay}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    required
                    defaultValue={batch.endDate.split('T')[0]}
                    onChange={(e) => {
                      setEndDateDisplay(formatDateInputToDDMMYYYY(e.target.value));
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  {endDateDisplay && (
                    <p className="mt-1 text-sm text-gray-600">Selected: {endDateDisplay}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    name="maxCapacity"
                    min="1"
                    defaultValue={batch.maxCapacity || ''}
                    placeholder="e.g., 30"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">Maximum number of students allowed in this batch</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="status"
                    required
                    value={batchStatus}
                    onChange={(e) => setBatchStatus(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Faculty Assignment Section */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Assign Faculty <span className="text-red-500">*</span>
                </h3>
                <p className="text-sm text-gray-600 mb-4">Select at least one faculty member to assign to this batch</p>
                {facultyData?.data?.users && facultyData.data.users.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      No faculty members found. Please create faculty users first.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                      {isLoadingFaculty ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                          <span className="ml-2 text-sm text-gray-500">Loading faculty...</span>
                        </div>
                      ) : faculty.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No active faculty members found</p>
                      ) : (
                        faculty
                          .filter((fac) => fac.isActive !== false)
                          .map((fac) => (
                            <label key={fac.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedFaculty.includes(fac.id)}
                                onChange={() => handleToggleFaculty(fac.id)}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 mr-3"
                              />
                              <div>
                                <span className="font-medium">{fac.name}</span>
                                <span className="text-sm text-gray-600 ml-2">({fac.email})</span>
                                {fac.phone && (
                                  <span className="text-xs text-gray-500 ml-2">• {fac.phone}</span>
                                )}
                              </div>
                            </label>
                          ))
                      )}
                    </div>
                    {selectedFaculty.length > 0 ? (
                      <p className="mt-2 text-sm text-green-600 font-medium">
                        ✓ {selectedFaculty.length} faculty member(s) selected
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-red-600">
                        ⚠ Please select at least one faculty member
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Student Selection Section */}
              <div className="pt-6 border-t border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Add Students (Optional)</h3>
                  <button
                    type="button"
                    onClick={handleGetSuggestions}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Get Suggested Students
                  </button>
                </div>
                
                {showSuggestions && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Suggested Students (based on software)</h4>
                    {suggestedCandidates.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {suggestedCandidates.map((candidate) => (
                          <div
                            key={candidate.studentId}
                            className={`p-2 rounded border cursor-pointer ${
                              candidate.status === 'available' 
                                ? 'bg-green-50 border-green-300 hover:bg-green-100' 
                                : candidate.status === 'fees_overdue'
                                ? 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100'
                                : candidate.status === 'pending_fees'
                                ? 'bg-amber-50 border-amber-300 hover:bg-amber-100'
                                : candidate.status === 'no_orientation'
                                ? 'bg-orange-50 border-orange-300 hover:bg-orange-100'
                                : 'bg-gray-50 border-gray-300 opacity-50'
                            }`}
                            onClick={() => handleSelectSuggested(candidate)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <span className="font-medium">{candidate.name || `Student #${candidate.studentId}`}</span>
                                {candidate.email && (
                                  <span className="text-xs text-gray-600 ml-2">({candidate.email})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  candidate.status === 'available' 
                                    ? 'bg-green-200 text-green-800'
                                    : candidate.status === 'fees_overdue'
                                    ? 'bg-yellow-200 text-yellow-800'
                                    : candidate.status === 'pending_fees'
                                    ? 'bg-amber-200 text-amber-800'
                                    : candidate.status === 'no_orientation'
                                    ? 'bg-orange-200 text-orange-800'
                                    : 'bg-gray-200 text-gray-800'
                                }`}>
                                  {candidate.statusMessage || candidate.status}
                                </span>
                                {(candidate.status === 'pending_fees' || candidate.status === 'fees_overdue') && (
                                  <label className="flex items-center gap-1 text-xs cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={exceptionStudentIds.includes(candidate.studentId)}
                                      onChange={(e) => {
                                        handleToggleException(candidate.studentId, e.target.checked);
                                        if (e.target.checked && !selectedStudents.includes(candidate.studentId)) {
                                          handleToggleStudent(candidate.studentId);
                                        }
                                      }}
                                      className="w-3 h-3 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                    />
                                    <span className="text-amber-700 font-medium">Add as Exception</span>
                                  </label>
                                )}
                                <input
                                  type="checkbox"
                                  checked={selectedStudents.includes(candidate.studentId)}
                                  onChange={() => handleToggleStudent(candidate.studentId)}
                                  disabled={candidate.status === 'busy'}
                                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-white border border-blue-200 rounded">
                        <p className="text-sm text-gray-600">
                          No students found with matching software "{selectedSoftwares.join(', ')}".
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          Students need to have the software selected in their profile to appear here.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Students to Enroll
                  </label>
                  <div className="mb-3 relative">
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
                  <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                    {students
                      .filter((student) => {
                        if (!studentSearchQuery.trim()) return true;
                        const query = studentSearchQuery.toLowerCase();
                        return (
                          student.name.toLowerCase().includes(query) ||
                          student.email.toLowerCase().includes(query)
                        );
                      })
                      .map((student) => (
                        <label key={student.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.id)}
                            onChange={() => handleToggleStudent(student.id)}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 mr-3"
                          />
                          <div>
                            <span className="font-medium">{student.name}</span>
                            <span className="text-sm text-gray-600 ml-2">({student.email})</span>
                            {exceptionStudentIds.includes(student.id) && (
                              <span className="ml-2 text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded">
                                Exception
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                    {students.filter((student) => {
                      if (!studentSearchQuery.trim()) return false;
                      const query = studentSearchQuery.toLowerCase();
                      return (
                        student.name.toLowerCase().includes(query) ||
                        student.email.toLowerCase().includes(query)
                      );
                    }).length === 0 && studentSearchQuery.trim() && (
                      <p className="text-sm text-gray-500 text-center py-4">No students found matching your search</p>
                    )}
                  </div>
                  {selectedStudents.length > 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      {selectedStudents.length} student(s) selected
                      {exceptionStudentIds.length > 0 && (
                        <span className="ml-2 text-amber-600">
                          ({exceptionStudentIds.length} as exception{exceptionStudentIds.length > 1 ? 's' : ''})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Schedule Section */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule (Optional)</h3>
                <p className="text-sm text-gray-600 mb-4">Select days and set start/end times for each day</p>
                
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToAll}
                      onChange={(e) => setApplyToAll(e.target.checked)}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      Apply same time to all selected days
                    </span>
                  </label>
                  <p className="ml-6 mt-1 text-xs text-gray-600">
                    When enabled, changing time on any day will update all selected days
                  </p>
                </div>
                
                <div className="space-y-4">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = !!daySchedules[day];
                    const schedule = daySchedules[day] || { startTime: '', endTime: '' };
                    
                    return (
                      <div key={day} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleDayToggle(day)}
                              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">{day}</span>
                          </label>
                        </div>
                        
                        {isSelected && (
                          <div className="grid grid-cols-2 gap-4 mt-3 pl-6">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                                value={schedule.startTime}
                                onChange={(e) => handleTimeChange(day, 'startTime', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                End Time
                              </label>
                              <input
                                type="time"
                                value={schedule.endTime}
                                onChange={(e) => handleTimeChange(day, 'endTime', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={updateBatchMutation.isPending}
                  className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateBatchMutation.isPending ? 'Updating...' : 'Update Batch'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/batches')}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

