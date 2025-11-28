import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { batchAPI, CreateBatchRequest, SuggestedCandidate } from '../api/batch.api';
import { studentAPI } from '../api/student.api';
import { facultyAPI } from '../api/faculty.api';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface DaySchedule {
  startTime: string;
  endTime: string;
}

export const BatchCreate: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [daySchedules, setDaySchedules] = useState<Record<string, DaySchedule>>({});
  const [applyToAll, setApplyToAll] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<number[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestedCandidates, setSuggestedCandidates] = useState<SuggestedCandidate[]>([]);
  const [showOtherSoftwareInput, setShowOtherSoftwareInput] = useState(false);
  const [otherSoftware, setOtherSoftware] = useState('');
  const [selectedSoftwares, setSelectedSoftwares] = useState<string[]>([]);

  // Fetch all students
  const { data: studentsData } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  // Fetch all faculty (with high limit to get all)
  const { data: facultyData, isLoading: isLoadingFaculty } = useQuery({
    queryKey: ['faculty'],
    queryFn: () => facultyAPI.getAllFaculty(1000), // Get up to 1000 faculty
  });

  const createBatchMutation = useMutation({
    mutationFn: async (data: CreateBatchRequest) => batchAPI.createBatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      alert('Batch created successfully!');
      navigate('/batches');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to create batch');
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
        // Apply to all selected days
        Object.keys(prev).forEach(d => {
          updated[d] = {
            ...prev[d],
            [field]: value
          };
        });
      } else {
        // Apply only to the current day
        updated[day] = {
          ...prev[day],
          [field]: value
        };
      }
      
      return updated;
    });
  };

  const handleCreateBatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Get software from selected softwares
    const softwareValue = selectedSoftwares.length > 0 
      ? selectedSoftwares.join(', ')
      : undefined;
    
    // Validate faculty selection
    if (selectedFaculty.length === 0) {
      alert('Please select at least one faculty member to assign to this batch.');
      return;
    }

    const data: CreateBatchRequest = {
      title: formData.get('title') as string,
      software: softwareValue,
      mode: formData.get('mode') as string,
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
      maxCapacity: formData.get('maxCapacity') ? parseInt(formData.get('maxCapacity') as string) : undefined,
      status: formData.get('status') as string || 'active',
      schedule: Object.keys(daySchedules).length > 0 ? 
        Object.fromEntries(
          Object.entries(daySchedules).filter(([_, times]) => times.startTime && times.endTime)
        ) : undefined,
      facultyIds: selectedFaculty,
      studentIds: selectedStudents.length > 0 ? selectedStudents : undefined,
    };
    createBatchMutation.mutate(data);
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

    // Create a temporary batch to get suggestions
    try {
      const tempData: CreateBatchRequest = {
        title: 'TEMP_FOR_SUGGESTIONS',
        software,
        mode: formData.get('mode') as string || 'online',
        startDate,
        endDate: formData.get('endDate') as string || startDate,
        maxCapacity: 100,
      };
      
      const tempBatch = await batchAPI.createBatch(tempData);
      if (tempBatch.data.batch) {
        const suggestions = await batchAPI.suggestCandidates(tempBatch.data.batch.id);
        setSuggestedCandidates(suggestions.data.candidates);
        setShowSuggestions(true);
        // Delete temporary batch
        try {
          await batchAPI.deleteBatch(tempBatch.data.batch.id);
        } catch (err) {
          console.error('Failed to delete temp batch:', err);
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to get suggestions');
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
    if (candidate.status === 'available' || candidate.status === 'fees_overdue') {
      handleToggleStudent(candidate.studentId);
    }
  };

  const students = studentsData?.data.students || [];
  const faculty = facultyData?.data?.users || [];

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600">You don't have permission to create batches.</p>
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Create New Batch</h1>
                <p className="mt-2 text-orange-100">Fill in the details to create a new training batch</p>
              </div>
              <button
                onClick={() => navigate('/batches')}
                className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>

          <div className="p-8">
            <form onSubmit={handleCreateBatch} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batch Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="e.g., Digital Art Fundamentals - Batch 1"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
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
                            // Split by comma and add each software
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    name="maxCapacity"
                    min="1"
                    placeholder="e.g., 30"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">Maximum number of students allowed in this batch</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
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
                
                {showSuggestions && suggestedCandidates.length > 0 && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Suggested Students (based on software)</h4>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {suggestedCandidates.map((candidate) => (
                        <div
                          key={candidate.studentId}
                          className={`p-2 rounded border cursor-pointer ${
                            candidate.status === 'available' 
                              ? 'bg-green-50 border-green-300 hover:bg-green-100' 
                              : candidate.status === 'fees_overdue'
                              ? 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100'
                              : 'bg-gray-50 border-gray-300 opacity-50'
                          }`}
                          onClick={() => handleSelectSuggested(candidate)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{candidate.name}</span>
                              <span className="text-xs text-gray-600 ml-2">({candidate.email})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                candidate.status === 'available' 
                                  ? 'bg-green-200 text-green-800'
                                  : candidate.status === 'fees_overdue'
                                  ? 'bg-yellow-200 text-yellow-800'
                                  : 'bg-gray-200 text-gray-800'
                              }`}>
                                {candidate.statusMessage}
                              </span>
                              <input
                                type="checkbox"
                                checked={selectedStudents.includes(candidate.studentId)}
                                onChange={() => handleToggleStudent(candidate.studentId)}
                                disabled={candidate.status === 'busy'}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Students to Enroll
                  </label>
                  <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                    {students.map((student) => (
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
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedStudents.length > 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      {selectedStudents.length} student(s) selected
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
                  disabled={createBatchMutation.isPending}
                  className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createBatchMutation.isPending ? 'Creating...' : 'Create Batch'}
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

