import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { batchAPI, Batch } from '../api/batch.api';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

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

  // Software to session count mapping
  const softwareSessionMap: Record<string, number> = {
    'Photoshop': 23,
    'Illustrator': 16,
    'InDesign': 16,
    'After Effects': 16,
    'Premiere Pro': 14,
    'Figma': 12,
    'XD': 6,
    'Animate CC': 32,
    'Premiere Audition': 14,
    'HTML Java DW CSS': 24,
    'Ar. MAX + Vray': 48,
    'MAX': 89,
    'Fusion': 10,
    'Real Flow': 10,
    'Fume FX': 8,
    'Nuke': 24,
    'Thinking Particle': 10,
    'Ray Fire': 6,
    'Mocha': 6,
    'Silhouette': 6,
    'PF Track': 6,
    'Vue': 13,
    'Houdni': 12,
    'FCP': 11,
    'Maya': 92,
    'CAD UNITY': 12,
    'Mudbox': 7,
    'Unity Game Design': 24,
    'Z-Brush': 12,
    'Lumion': 6,
    'SketchUp': 12,
    'Unreal': 33,
    'Blender Pro': 72,
    'Cinema 4D': 72,
    'Substance Painter': 6,
    '3D Equalizer': 6,
    'Photography': 10,
    'Auto-Cad': 15,
    'Davinci': 10,
    'Corel': 14,
    'CorelDRAW': 14,
  };
  
  // Calculate total number of lectures based on software
  const calculateTotalLectures = (softwareString: string): number => {
    if (!softwareString) return 0;
    
    // Split software string by comma and calculate total sessions
    const softwareList = softwareString.split(',').map(s => s.trim()).filter(s => s);
    
    let totalLectures = 0;
    softwareList.forEach(sw => {
      const cleanSoftware = sw.trim();
      // Check for exact matches first
      if (softwareSessionMap[cleanSoftware]) {
        totalLectures += softwareSessionMap[cleanSoftware];
      } else {
        // Check for partial matches (case insensitive)
        const foundSoftware = Object.keys(softwareSessionMap).find(key => 
          key.toLowerCase().includes(cleanSoftware.toLowerCase()) || 
          cleanSoftware.toLowerCase().includes(key.toLowerCase())
        );
        if (foundSoftware) {
          totalLectures += softwareSessionMap[foundSoftware];
        }
      }
    });
    
    return totalLectures;
  };
  
  // Calculate expected end date based on schedule
  const calculateExpectedEndDate = (startDate: string, softwareString: string, schedule?: Record<string, any>): string => {
    if (!startDate || !softwareString) return '';
    
    const totalLectures = calculateTotalLectures(softwareString);
    
    if (totalLectures === 0) return startDate;
    
    // If schedule is provided, calculate based on days per week
    if (schedule && Object.keys(schedule).length > 0) {
      const daysPerWeek = Object.keys(schedule).length;
      
      if (daysPerWeek > 0) {
        // Calculate end date by adding the actual number of days needed
        // based on the scheduled days
        const start = new Date(startDate);
        // Set to start of day to avoid timezone issues
        start.setHours(0, 0, 0, 0);
        let currentDate = new Date(start);
        let sessionsScheduled = 0;
        
        // We need to count actual calendar days based on the scheduled days
        // First, make sure we start from a scheduled day
        // If the start date is not a scheduled day, move to the next scheduled day
        let startDayName = DAYS_OF_WEEK[currentDate.getDay()];
        let isStartDayScheduled = false;
        
        // Check if start date is scheduled
        const startDayMatches = [
          startDayName, // Full day name (e.g., "Monday")
          startDayName.substring(0, 3), // Abbreviated day (e.g., "Mon")
          startDayName.toLowerCase(),
          startDayName.substring(0, 3).toLowerCase(),
          currentDate.getDay().toString(), // Numeric day (0-6 where 0 is Sunday)
          (currentDate.getDay() === 0 ? 7 : currentDate.getDay()).toString() // Monday as 1, Sunday as 7
        ];
        isStartDayScheduled = startDayMatches.some(match => match in schedule);
        
        // If start date is not scheduled, find the next scheduled day
        if (!isStartDayScheduled) {
          while (!isStartDayScheduled) {
            currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000); // Add one day
            startDayName = DAYS_OF_WEEK[currentDate.getDay()];
            
            const nextDayMatches = [
              startDayName, // Full day name (e.g., "Monday")
              startDayName.substring(0, 3), // Abbreviated day (e.g., "Mon")
              startDayName.toLowerCase(),
              startDayName.substring(0, 3).toLowerCase(),
              currentDate.getDay().toString(), // Numeric day (0-6 where 0 is Sunday)
              (currentDate.getDay() === 0 ? 7 : currentDate.getDay()).toString() // Monday as 1, Sunday as 7
            ];
            isStartDayScheduled = nextDayMatches.some(match => match in schedule);
          }
        }
        
        // Now start counting from the first scheduled day
        sessionsScheduled = 1; // Count the first scheduled day as the first session
        
        // Continue until we reach the required number of sessions
        while (sessionsScheduled < totalLectures) {
          // Move to next day
          currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000); // Add one day in milliseconds
          
          // Check if this day is in the schedule
          const dayName = DAYS_OF_WEEK[currentDate.getDay()];
          // Check if this day is scheduled (comprehensive matching)
          const dayMatches = [
            dayName, // Full day name (e.g., "Monday")
            dayName.substring(0, 3), // Abbreviated day (e.g., "Mon")
            dayName.toLowerCase(),
            dayName.substring(0, 3).toLowerCase(),
            currentDate.getDay().toString(), // Numeric day (0-6 where 0 is Sunday)
            (currentDate.getDay() === 0 ? 7 : currentDate.getDay()).toString() // Monday as 1, Sunday as 7
          ];
          
          const isDayScheduled = dayMatches.some(match => match in schedule);
          
          if (isDayScheduled) {
            sessionsScheduled++;
          }
        }
        
        return currentDate.toISOString().split('T')[0];
      }
    }
    
    // Fallback: assume 1 lecture per day
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + totalLectures);
    
    return end.toISOString().split('T')[0];
  };

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
      ['Batch', 'Start Date', formatDateDDMMYYYY(batch.startDate)],
      ['Batch', 'End Date', formatDateDDMMYYYY(batch.endDate)],
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
                    <p className="font-medium">{formatDateDDMMYYYY(batch.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">End Date</p>
                    <p className="font-medium">{formatDateDDMMYYYY(batch.endDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">Software</p>
                    <p className="font-medium">{batch.software || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">Total Lectures</p>
                    <p className="font-medium">{calculateTotalLectures(batch.software || '')} lectures</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">Expected End Date</p>
                    <p className="font-medium">{batch.startDate && batch.software ? formatDateDDMMYYYY(calculateExpectedEndDate(batch.startDate, batch.software || '', batch.schedule) || '') : 'N/A'}</p>
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
                {(() => {
                  // Handle null, undefined, or empty schedule
                  if (!batch.schedule) {
                    return (
                      <div className="text-sm text-gray-500">
                        <p>No schedule defined.</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Edit this batch to add a schedule.
                        </p>
                      </div>
                    );
                  }

                  // Handle empty object or empty array
                  const isEmpty = Array.isArray(batch.schedule) 
                    ? batch.schedule.length === 0
                    : Object.keys(batch.schedule).length === 0;
                  
                  if (isEmpty) {
                    return (
                      <div className="text-sm text-gray-500">
                        <p>No schedule defined.</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Edit this batch to add a schedule.
                        </p>
                      </div>
                    );
                  }

                  let scheduleEntries: Array<{ day: string; times: { startTime: string; endTime: string } }> = [];

                  // Handle array format (numeric indices)
                  if (Array.isArray(batch.schedule)) {
                    scheduleEntries = batch.schedule
                      .map((item: any, index: number) => {
                        // If item is an object with day and times
                        if (item && typeof item === 'object' && (item.day || item.startTime)) {
                          return {
                            day: item.day || DAYS_OF_WEEK[index] || `Day ${index + 1}`,
                            times: item.startTime ? { startTime: item.startTime, endTime: item.endTime } : item
                          };
                        }
                        // If item is just times object
                        if (item && item.startTime) {
                          return {
                            day: DAYS_OF_WEEK[index] || `Day ${index + 1}`,
                            times: item
                          };
                        }
                        return null;
                      })
                      .filter((item: any) => item !== null && item.times && item.times.startTime) as Array<{ day: string; times: { startTime: string; endTime: string } }>;
                  } else {
                    // Handle object format with day names as keys
                    const scheduleObj = batch.schedule as Record<string, any>;
                    
                    // Sort schedule by day order (Monday through Sunday)
                    const sortedSchedule = DAYS_OF_WEEK
                      .filter(day => scheduleObj[day] && scheduleObj[day].startTime)
                      .map(day => ({
                        day,
                        times: scheduleObj[day]
                      }));
                    
                    // If no matches with standard day names, try to map numeric keys to days
                    if (sortedSchedule.length > 0) {
                      scheduleEntries = sortedSchedule;
                    } else {
                      const entries = Object.entries(scheduleObj);
                      scheduleEntries = entries
                        .filter(([_, times]) => {
                          // Handle different time formats
                          if (!times) return false;
                          if (typeof times === 'object' && times.startTime) return true;
                          return false;
                        })
                        .map(([day, times]) => {
                          // If key is numeric, map to day name
                          const dayIndex = parseInt(day);
                          if (!isNaN(dayIndex) && dayIndex >= 0 && dayIndex < DAYS_OF_WEEK.length) {
                            return {
                              day: DAYS_OF_WEEK[dayIndex],
                              times: typeof times === 'object' && times.startTime ? times : { startTime: '', endTime: '' }
                            };
                          }
                          // Otherwise use the key as day name
                          return {
                            day: day,
                            times: typeof times === 'object' && times.startTime ? times : { startTime: '', endTime: '' }
                          };
                        })
                        .filter(item => item.times.startTime); // Only include entries with valid startTime
                    }
                  }

                  if (scheduleEntries.length === 0) {
                    return (
                      <div className="text-sm text-gray-500">
                        <p>No valid schedule entries found.</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Edit this batch to add or update the schedule.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {scheduleEntries.map(({ day, times }) => (
                        <div key={day} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm hover:bg-gray-100 transition-colors">
                          <span className="font-medium text-gray-700 capitalize">{day}</span>
                          <span className="text-gray-600 font-mono">
                            {times?.startTime || '-'} - {times?.endTime || '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
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
                      const isException = enrollment.enrollmentStatus === 'exception';
                      return (
                        <div key={studentId} className={`flex flex-col rounded-lg border px-3 py-2 text-sm ${
                          isException ? 'border-amber-300 bg-amber-50' : 'border-gray-100'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <span className="font-semibold text-gray-900">{studentName}</span>
                              <span className="text-gray-600 ml-2">({studentEmail})</span>
                              {studentPhone && <span className="text-gray-500 block text-xs">{studentPhone}</span>}
                            </div>
                            {isException && (
                              <span className="ml-2 px-2 py-1 text-xs font-semibold bg-amber-200 text-amber-800 rounded">
                                Exception
                              </span>
                            )}
                          </div>
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

