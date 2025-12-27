import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { paymentAPI, PaymentTransaction, CreatePaymentRequest, UpdatePaymentRequest, PaymentsResponse } from '../api/payment.api';
import { studentAPI } from '../api/student.api';
import { formatDateDDMMYYYY, formatDateInputToDDMMYYYY } from '../utils/dateUtils';

export const PaymentManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentTransaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<{ success: number; failed: number; errors: Array<{ row: number; error: string }> } | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'byStudent'>('all');

  // Fetch payments - for students, automatically filter to their own payments
  const { data: paymentsData, isLoading, error: paymentsError } = useQuery({
    queryKey: ['payments', user?.id || user?.userId],
    queryFn: async () => {
      try {
        // If user is a student, fetch only their payments
        if (user?.role === 'student') {
          const studentId = user.id || user.userId;
          if (!studentId) {
            throw new Error('Student ID not found');
          }
          console.log('Fetching payments for student:', studentId);
          return await paymentAPI.getAllPayments({ studentId });
        }
        // For admins, fetch all payments
        return await paymentAPI.getAllPayments();
      } catch (error: any) {
        console.error('Payment fetch error details:', {
          error,
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status,
          user: user ? { id: user.id, userId: user.userId, role: user.role } : null,
        });
        throw error;
      }
    },
    retry: 2,
    enabled: !!user, // Only fetch when user is available
  });

  // Handle errors separately with better logging
  if (paymentsError) {
    console.error('Error fetching payments:', {
      error: paymentsError,
      message: (paymentsError as any)?.message,
      response: (paymentsError as any)?.response?.data,
      status: (paymentsError as any)?.response?.status,
      user: user ? { id: user.id, userId: user.userId, role: user.role } : null,
    });
  }

  // Fetch students for form
  const { data: studentsData } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  // State for enrollment selection
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | ''>('');

  // Fetch enrollments for selected student
  const { data: enrollmentsData } = useQuery({
    queryKey: ['enrollments', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return { data: [], studentProfile: null };
      try {
        // Fetch enrollments
        const enrollmentsResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/enrollments?studentId=${selectedStudentId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        
        let enrollments: any[] = [];
        if (enrollmentsResponse.ok) {
          const enrollmentsData = await enrollmentsResponse.json();
          enrollments = Array.isArray(enrollmentsData.data) ? enrollmentsData.data : (enrollmentsData.data?.enrollments || []);
        }

        // Always try to get fees from student profile (even if enrollments exist, to show all fees)
        let studentProfile: any = null;
        try {
          const studentResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/attendance-reports/students/${selectedStudentId}/details`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (studentResponse.ok) {
            const studentData = await studentResponse.json();
            studentProfile = studentData.data?.student?.studentProfile;
            
            // Parse documents if it's a string (MySQL JSON fields sometimes come as strings)
            if (studentProfile?.documents && typeof studentProfile.documents === 'string') {
              try {
                studentProfile.documents = JSON.parse(studentProfile.documents);
                console.log('Parsed student profile documents:', studentProfile.documents);
              } catch (e) {
                console.error('Error parsing student profile documents:', e);
              }
            }
            
            // Debug log
            if (studentProfile?.documents?.enrollmentMetadata) {
              console.log('Found enrollmentMetadata:', studentProfile.documents.enrollmentMetadata);
            } else {
              console.log('No enrollmentMetadata found in student profile documents:', studentProfile?.documents);
            }
          }
        } catch (profileError) {
          console.error('Error fetching student profile:', profileError);
        }

        return { 
          data: enrollments,
          studentProfile: studentProfile,
        };
      } catch (error: any) {
        console.error('Error fetching enrollments:', error);
        return { data: [], studentProfile: null };
      }
    },
    enabled: !!selectedStudentId,
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: CreatePaymentRequest) => paymentAPI.createPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['student-payments'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      setIsCreateModalOpen(false);
      alert('Payment created successfully!');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create payment';
      console.error('Payment creation error:', error);
      alert(`Error: ${errorMessage}\n\nPlease check:\n1. All required fields are filled\n2. Database migrations are up to date\n3. Backend server logs for details`);
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePaymentRequest }) => paymentAPI.updatePayment(id, data),
    onSuccess: () => {
      // Invalidate all payment-related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['student-payments'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      // Force refetch to get latest data
      queryClient.refetchQueries({ queryKey: ['payments'] });
      setIsUpdateModalOpen(false);
      setSelectedPayment(null);
      alert('Payment updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update payment');
    },
  });

  const generateReceiptMutation = useMutation({
    mutationFn: (id: number) => paymentAPI.generateReceipt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      alert('Receipt generated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to generate receipt');
    },
  });

  const allPayments = (paymentsData as PaymentsResponse | undefined)?.data?.payments || [];
  const students = studentsData?.data?.students || [];

  // Filter payments based on search query
  const payments = allPayments.filter((payment: any) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const studentName = payment.student?.name?.toLowerCase() || '';
    const studentEmail = payment.student?.email?.toLowerCase() || '';
    return (
      studentName.includes(query) ||
      studentEmail.includes(query) ||
      payment.amount?.toString().includes(query) ||
      payment.status?.toLowerCase().includes(query)
    );
  });

  // Group payments by student
  const paymentsByStudent = payments.reduce((acc: any, payment: any) => {
    const studentId = payment.studentId;
    if (!acc[studentId]) {
      acc[studentId] = {
        student: payment.student,
        payments: [],
        totalAmount: 0,
        totalPaid: 0,
        totalPending: 0,
        paymentPlan: null,
      };
    }
    acc[studentId].payments.push(payment);
    acc[studentId].totalAmount += Number(payment.amount) || 0;
    // Count paidAmount: prioritize paidAmount field, fallback to amount if status is 'paid'
    const paidAmount = payment.paidAmount !== undefined && payment.paidAmount !== null 
      ? Number(payment.paidAmount) 
      : 0;
    const paymentAmount = Number(payment.amount) || 0;
    
    // Debug log for each payment
    if (payment.id === 10) {
      console.log('Payment #10 details:', {
        id: payment.id,
        amount: paymentAmount,
        paidAmount: paidAmount,
        paidAmountRaw: payment.paidAmount,
        status: payment.status,
        willBeCounted: paidAmount > 0 || (payment.status === 'paid' && paymentAmount > 0)
      });
    }
    
    if (paidAmount > 0) {
      // If paidAmount is set and greater than 0, use it (regardless of status)
      acc[studentId].totalPaid += paidAmount;
    } else if (payment.status === 'paid' && paymentAmount > 0) {
      // If status is 'paid' but paidAmount is 0/missing, use the full amount
      acc[studentId].totalPaid += paymentAmount;
    } else if (payment.status === 'partial' && paymentAmount > 0 && paidAmount === 0) {
      // If status is 'partial' but paidAmount is 0, this is an inconsistent state
      // Log a warning but don't count it - the payment needs to be updated
      console.warn(`Payment #${payment.id} has status 'partial' but paidAmount is 0. Please update the payment with the correct paidAmount.`);
    }
    // Note: If status is 'partial' but paidAmount is 0, don't count it (inconsistent state)
    // The payment should be updated with the correct paidAmount
    
    acc[studentId].totalPending += paymentAmount - paidAmount;
    
    // Get paymentPlan from payment, enrollment, or studentProfile
    if (!acc[studentId].paymentPlan) {
      // First try payment-level paymentPlan (extracted from backend)
      if (payment.paymentPlan) {
        acc[studentId].paymentPlan = payment.paymentPlan;
      }
      // Then try enrollment paymentPlan
      else if (payment.enrollment?.paymentPlan) {
        acc[studentId].paymentPlan = payment.enrollment.paymentPlan;
      }
    }
    
    return acc;
  }, {});
  
  const studentGroups = Object.values(paymentsByStudent);

  const bulkUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/payments/bulk-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload payments');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setBulkUploadResult(data.data);
      if (data.data.success > 0) {
        alert(`Successfully uploaded ${data.data.success} payment(s)!${data.data.failed > 0 ? ` ${data.data.failed} failed.` : ''}`);
      } else {
        alert(`Upload failed: ${data.data.errors.length > 0 ? data.data.errors[0].error : 'Unknown error'}`);
      }
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to upload payments');
    },
  });

  const handleBulkUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    
    if (!file) {
      alert('Please select a file');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Only Excel files (.xlsx, .xls) and CSV files are allowed.');
      return;
    }

    setUploadingBulk(true);
    setBulkUploadResult(null);
    bulkUploadMutation.mutate(file);
    setUploadingBulk(false);
  };

  const handleDownloadTemplate = () => {
    // Available software options (matching the enrollment form)
    const availableSoftware = [
      'Photoshop', 'Illustrator', 'InDesign', 'After Effects', 'Premiere Pro',
      'Figma', 'Sketch', 'Blender', 'Maya', '3ds Max', 'Cinema 4D', 'Lightroom',
      'CorelDRAW', 'AutoCAD', 'SolidWorks', 'Revit', 'SketchUp', 'Unity',
      'Unreal Engine', 'DaVinci Resolve', 'Final Cut Pro', 'Procreate',
      'Affinity Designer', 'Affinity Photo', 'Canva Pro'
    ];
    
    const headers = [
      'Email', 
      'Phone', 
      'Software List (Comma-separated)', 
      'Amount', 
      'Due Date', 
      'Enrollment ID (Optional)', 
      'Payment Method (Optional)', 
      'Transaction ID (Optional)', 
      'Notes (Optional)'
    ];
    
    const exampleRow = [
      'student@example.com', 
      '+1234567890', 
      'Photoshop, Illustrator, Figma', 
      '5000.00', 
      '31/12/2025', 
      '', 
      'cash', 
      '', 
      'Payment notes'
    ];
    
    const csvContent = [
      headers.join(','),
      exampleRow.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      '',
      '=== INSTRUCTIONS ===',
      '1. Due Date should be in DD/MM/YYYY format (e.g., 31/12/2025)',
      '2. Software List: Enter comma-separated software names (e.g., "Photoshop, Illustrator, Figma")',
      '3. Available Software Options:',
      ...availableSoftware.map(sw => `   - ${sw}`),
      '4. You can use any combination of the above software or add custom software names',
      '5. Email OR Phone is required to identify the student',
      '6. Amount and Due Date are required fields',
      '7. All other fields are optional',
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payment_upload_template_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCSV = () => {
    const headers = ['Student Name', 'Student Email', 'Student Phone', 'Total Amount', 'Paid Amount', 'Balance', 'Due Date', 'Paid Date', 'Status', 'Payment Method', 'Transaction ID', 'Notes'];
    
    const rows = payments.map((payment: any) => {
      const paidAmount = (payment.paidAmount !== undefined && payment.paidAmount !== null) ? Number(payment.paidAmount) : 0;
      const balance = payment.amount - paidAmount;
      
      return [
        payment.student?.name || `Student ${payment.studentId}`,
        payment.student?.email || '-',
        payment.student?.phone || '-',
        payment.amount.toFixed(2),
        paidAmount.toFixed(2),
        balance.toFixed(2),
        payment.dueDate ? formatDateDDMMYYYY(payment.dueDate) : '-',
        payment.paidDate ? formatDateDDMMYYYY(payment.paidDate) : '-',
        payment.status,
        payment.paymentMethod || '-',
        payment.transactionId || '-',
        payment.notes || '-',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payments_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreatePayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const studentId = parseInt(formData.get('studentId') as string);
    const enrollmentIdValue = formData.get('enrollmentId') as string;
    const enrollmentId = enrollmentIdValue ? parseInt(enrollmentIdValue) : undefined;
    const amount = parseFloat(formData.get('amount') as string);
    const dueDate = formData.get('dueDate') as string;
    const paymentMethod = formData.get('paymentMethod') as string | null;
    const transactionId = formData.get('transactionId') as string | null;
    
    // Validation
    if (!studentId || isNaN(studentId)) {
      alert('Please select a valid student');
      return;
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }
    if (!dueDate) {
      alert('Please select a due date');
      return;
    }
    
    const data: CreatePaymentRequest = {
      studentId,
      enrollmentId,
      amount,
      dueDate,
      notes: formData.get('notes') as string || undefined,
      paymentMethod: paymentMethod || undefined,
      transactionId: transactionId || undefined,
    };
    
    console.log('Creating payment with data:', data);
    createPaymentMutation.mutate(data);
  };

  // Handle student selection change
  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const studentId = e.target.value ? parseInt(e.target.value) : '';
    setSelectedStudentId(studentId);
    setSelectedEnrollmentId(''); // Reset enrollment when student changes
  };

    // Handle enrollment selection change and auto-populate amount
  const handleEnrollmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const enrollmentId = e.target.value ? parseInt(e.target.value) : '';
    setSelectedEnrollmentId(enrollmentId);
    
    // Auto-populate amount from enrollment
    if (enrollmentId && enrollmentsData?.data && Array.isArray(enrollmentsData.data)) {
      const enrollment = enrollmentsData.data.find((e: any) => e.id === enrollmentId);
      if (enrollment?.paymentPlan) {
        const paymentPlan = enrollment.paymentPlan as any;
        // Try to get balanceAmount first (outstanding), then totalDeal (total), then bookingAmount
        const amount = paymentPlan.balanceAmount || paymentPlan.totalDeal || paymentPlan.bookingAmount || 0;
        if (amount > 0) {
          // Use setTimeout to ensure the input is rendered
          setTimeout(() => {
            const amountInput = document.querySelector('input[name="amount"]') as HTMLInputElement;
            if (amountInput) {
              amountInput.value = amount.toString();
              // Trigger input event to update React state if needed
              amountInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, 100);
        }
      }
    }
  };

  // Auto-populate amount from student profile if no enrollment but profile has fees
  React.useEffect(() => {
    if (selectedStudentId && !selectedEnrollmentId && enrollmentsData?.studentProfile?.documents?.enrollmentMetadata) {
      const metadata = enrollmentsData.studentProfile.documents.enrollmentMetadata;
      // Calculate balanceAmount if not provided
      let balanceAmount = metadata.balanceAmount;
      if (balanceAmount === null || balanceAmount === undefined || balanceAmount === 0) {
        const totalDeal = metadata.totalDeal;
        const bookingAmount = metadata.bookingAmount;
        if (totalDeal !== null && totalDeal !== undefined) {
          balanceAmount = bookingAmount !== null && bookingAmount !== undefined 
            ? totalDeal - bookingAmount 
            : totalDeal;
        }
      }
      
      if (balanceAmount && balanceAmount > 0) {
        // Auto-fill balance amount as a suggestion
        setTimeout(() => {
          const amountInput = document.querySelector('input[name="amount"]') as HTMLInputElement;
          if (amountInput && !amountInput.value) {
            amountInput.value = balanceAmount.toString();
            amountInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 200);
      }
    }
  }, [selectedStudentId, selectedEnrollmentId, enrollmentsData]);

  const handleUpdatePayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPayment) return;
    const formData = new FormData(e.currentTarget);
    const paidAmountInput = formData.get('paidAmount') as string;
    const paidAmountValue = paidAmountInput && paidAmountInput.trim() !== ''
      ? parseFloat(paidAmountInput)
      : undefined;
    const statusValue = formData.get('status') as 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled' || undefined;
    
    // Auto-set status based on paidAmount if status is not explicitly set
    let finalStatus = statusValue;
    let finalPaidAmount = paidAmountValue;
    
    // Validate and set paidAmount based on status
    if (statusValue === 'partial') {
      // If status is 'partial', paidAmount is REQUIRED
      if (paidAmountValue === undefined || paidAmountValue === null || isNaN(paidAmountValue) || paidAmountValue <= 0) {
        alert('Please enter a Paid Amount greater than 0 when status is set to Partial');
        return;
      }
      if (paidAmountValue >= selectedPayment.amount) {
        // If paidAmount equals or exceeds amount, auto-set status to 'paid'
        finalStatus = 'paid';
        finalPaidAmount = selectedPayment.amount;
      } else {
        finalPaidAmount = paidAmountValue;
      }
    } else if (statusValue === 'paid') {
      // If status is 'paid', set paidAmount to full amount if not provided
      if (paidAmountValue === undefined || paidAmountValue === null || isNaN(paidAmountValue) || paidAmountValue === 0) {
        finalPaidAmount = selectedPayment.amount;
      } else {
        finalPaidAmount = Math.min(paidAmountValue, selectedPayment.amount); // Cap at payment amount
      }
    } else if (paidAmountValue !== undefined && paidAmountValue !== null && !isNaN(paidAmountValue) && paidAmountValue > 0) {
      // If paidAmount is provided but status is not set, auto-set status
      if (paidAmountValue >= selectedPayment.amount) {
        finalStatus = 'paid';
        finalPaidAmount = selectedPayment.amount;
      } else {
        finalStatus = 'partial';
        finalPaidAmount = paidAmountValue;
      }
    }
    
    const data: UpdatePaymentRequest = {
      status: finalStatus,
      paidDate: formData.get('paidDate') as string || undefined,
      paymentMethod: formData.get('paymentMethod') as string || undefined,
      transactionId: formData.get('transactionId') as string || undefined,
      notes: formData.get('notes') as string || undefined,
      paidAmount: finalPaidAmount,
    };
    
    console.log('Updating payment:', { id: selectedPayment.id, data });
    updatePaymentMutation.mutate({ id: selectedPayment.id, data });
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

  if (paymentsError) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Payments</h2>
            <p className="text-red-600 mb-4">
              {paymentsError instanceof Error ? paymentsError.message : 'Failed to load payments. Please try again.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
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
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  {user?.role === 'student' ? 'My Payments' : 'Payment Management'}
                </h1>
                <p className="mt-2 text-sm md:text-base text-orange-100">
                  {user?.role === 'student' ? 'View your payment details' : 'Manage payments'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:gap-3 w-full sm:w-auto">
                <button
                  onClick={handleDownloadCSV}
                  className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors flex items-center gap-2 text-sm md:text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download CSV
                </button>
                {(user?.role === 'admin' || user?.role === 'superadmin') && (
                  <>
                    <button
                      onClick={() => setIsUploadModalOpen(true)}
                      className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors flex items-center gap-2 text-sm md:text-base"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload Excel
                    </button>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors text-sm md:text-base whitespace-nowrap"
                    >
                      + Create Payment
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6">
            <div className="mb-4">
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('all')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'all'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    All Payments
                  </button>
                  <button
                    onClick={() => setViewMode('byStudent')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'byStudent'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    By Student
                  </button>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search payments by student name, email, amount, or status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="mt-2 text-sm text-gray-600">
                  Showing {payments.length} of {allPayments.length} payments
                </p>
              )}
            </div>
            {paymentsError ? (
              <div className="text-center py-12">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
                  <p className="text-red-600 text-lg font-semibold mb-2">Error Loading Payments</p>
                  <p className="text-red-500 text-sm mb-4">
                    {(paymentsError as any)?.response?.data?.message || 
                     (paymentsError as any)?.message || 
                     'Request failed with status code ' + ((paymentsError as any)?.response?.status || 'unknown')}
                  </p>
                  <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['payments'] })}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Retry
                  </button>
                  {(paymentsError as any)?.response?.status === 403 && (
                    <p className="text-xs text-gray-500 mt-4">
                      If you're a student, make sure you're logged in with your student account.
                    </p>
                  )}
                </div>
              </div>
            ) : !(paymentsData as PaymentsResponse | undefined)?.data?.payments ? (
              <div className="text-center py-12">
                <p className="text-red-500 text-lg">Error: Unable to load payments data</p>
                <p className="text-gray-500 text-sm mt-2">Please check your connection and try again</p>
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No payments found</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                {/* Payment Summary */}
                {(() => {
                  // Calculate totals from all payments (not filtered)
                  const totalAmount = allPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
                  const totalPaid = allPayments.reduce((sum: number, p: any) => {
                    const paidAmount = p.paidAmount !== undefined && p.paidAmount !== null 
                      ? Number(p.paidAmount) 
                      : 0;
                    const paymentAmount = Number(p.amount) || 0;
                    // Count paidAmount: prioritize paidAmount field, fallback to amount if status is 'paid'
                    if (paidAmount > 0) {
                      return sum + paidAmount;
                    } else if (p.status === 'paid' && paymentAmount > 0) {
                      return sum + paymentAmount;
                    } else if (p.status === 'partial' && paymentAmount > 0 && paidAmount === 0) {
                      // If status is 'partial' but paidAmount is 0, this is an inconsistent state
                      console.warn(`Payment #${p.id} has status 'partial' but paidAmount is 0. Please update the payment with the correct paidAmount.`);
                    }
                    return sum;
                  }, 0);
                  const totalPending = allPayments.reduce((sum: number, p: any) => {
                    const amount = Number(p.amount) || 0;
                    const paid = Number(p.paidAmount) || 0;
                    return sum + (amount - paid);
                  }, 0);

                  // Try to get total deal amount from first payment's enrollment (if available)
                  const firstPaymentWithEnrollment = allPayments.find((p: any) => (p.enrollment as any)?.paymentPlan);
                  const paymentPlan = (firstPaymentWithEnrollment?.enrollment as any)?.paymentPlan as Record<string, unknown> | undefined;
                  const totalDeal = paymentPlan?.totalDeal !== null && paymentPlan?.totalDeal !== undefined ? Number(paymentPlan.totalDeal) : null;
                  const bookingAmount = paymentPlan?.bookingAmount !== null && paymentPlan?.bookingAmount !== undefined ? Number(paymentPlan.bookingAmount) : 0;
                  
                  // Calculate overall balance: use balanceAmount from paymentPlan if available, otherwise calculate
                  const balanceAmount = paymentPlan?.balanceAmount !== null && paymentPlan?.balanceAmount !== undefined 
                    ? Number(paymentPlan.balanceAmount)
                    : null;
                  const overallBalance = balanceAmount !== null 
                    ? balanceAmount
                    : (totalDeal !== null && totalDeal !== undefined 
                      ? Math.max(0, totalDeal - bookingAmount - totalPaid)
                      : null);

                  return (
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
                      {totalDeal !== null && totalDeal !== undefined && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Total Deal Amount</p>
                          <p className="text-lg font-semibold text-blue-600">
                            ₹{totalDeal.toFixed(2)}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Payments</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {allPayments.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Amount</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ₹{totalAmount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Paid</p>
                        <p className="text-lg font-semibold text-green-600">
                          ₹{totalPaid.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Pending</p>
                        <p className="text-lg font-semibold text-orange-600">
                          ₹{totalPending.toFixed(2)}
                        </p>
                        {overallBalance !== null && overallBalance !== totalPending && (
                          <p className="text-xs text-gray-500 mt-1">
                            Balance: ₹{overallBalance.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {viewMode === 'byStudent' ? (
                  // Student-wise grouped view
                  <div className="space-y-6 overflow-x-auto" style={{ minWidth: '1200px' }}>
                    {studentGroups.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">No payments found</p>
                      </div>
                    ) : (
                      studentGroups.map((group: any) => {
                        const paymentPlan = group.paymentPlan;
                        const totalDeal = paymentPlan?.totalDeal !== null && paymentPlan?.totalDeal !== undefined ? Number(paymentPlan.totalDeal) : null;
                        const bookingAmount = paymentPlan?.bookingAmount !== null && paymentPlan?.bookingAmount !== undefined ? Number(paymentPlan.bookingAmount) : 0;
                        const balanceAmount = paymentPlan?.balanceAmount !== null && paymentPlan?.balanceAmount !== undefined ? Number(paymentPlan.balanceAmount) : null;
                        
                        // Debug: Log payment details for troubleshooting
                        console.log('Payment Group Calculation:', {
                          studentId: group.student?.id,
                          totalDeal,
                          bookingAmount,
                          totalPaid: group.totalPaid,
                          payments: group.payments.map((p: any) => ({
                            id: p.id,
                            amount: p.amount,
                            paidAmount: p.paidAmount,
                            status: p.status
                          }))
                        });
                        
                        // Calculate remaining balance from actual payments (always use current totalPaid)
                        const overallBalance = totalDeal !== null && totalDeal !== undefined 
                          ? Math.max(0, totalDeal - bookingAmount - group.totalPaid)
                          : null;

                        return (
                          <div key={group.student?.id || 'unknown'} className="border border-gray-200 rounded-lg overflow-hidden">
                            {/* Student Header */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900">{group.student?.name || `Student ${group.student?.id || 'Unknown'}`}</h3>
                                  <p className="text-sm text-gray-600">{group.student?.email || '-'}</p>
                                  {group.student?.phone && (
                                    <p className="text-xs text-gray-500">Phone: {group.student.phone}</p>
                                  )}
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3">
                                  {/* Payment Plan Summary */}
                                  {totalDeal !== null && (
                                    <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium">
                                        Total Deal: ₹{totalDeal.toFixed(2)}
                                      </span>
                                      {bookingAmount > 0 && (
                                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded font-medium">
                                          Booking: ₹{bookingAmount.toFixed(2)}
                                        </span>
                                      )}
                                      {balanceAmount !== null && (
                                        <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded font-medium">
                                          Balance: ₹{balanceAmount.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {/* Payment Summary */}
                                  <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded font-medium">
                                      Payments: {group.payments.length}
                                    </span>
                                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded font-medium">
                                      Total: ₹{group.totalAmount.toFixed(2)}
                                    </span>
                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-medium">
                                      Paid: ₹{group.totalPaid.toFixed(2)}
                                    </span>
                                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded font-medium">
                                      Pending: ₹{group.totalPending.toFixed(2)}
                                    </span>
                                    {overallBalance !== null && (
                                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded font-medium">
                                        Remaining: ₹{overallBalance.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Payment Plan Summary Card */}
                            {totalDeal !== null && (
                              <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Payment Plan Summary</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Total Deal Amount (₹)</label>
                                    <p className="text-lg font-semibold text-gray-900">₹{totalDeal.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Booking Amount (₹)</label>
                                    <p className="text-lg font-semibold text-gray-900">₹{bookingAmount.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Initial Balance Amount (₹)</label>
                                    <p className="text-lg font-semibold text-orange-600">₹{(balanceAmount !== null ? balanceAmount : (totalDeal - bookingAmount)).toFixed(2)}</p>
                                    <p className="text-xs text-gray-500 mt-1">Initial Balance = Total Deal - Booking Amount</p>
                                  </div>
                                </div>
                                {/* Always show remaining balance if there are payments or if it differs from initial balance */}
                                {overallBalance !== null && (
                                  <div className="mt-3 pt-3 border-t border-blue-200">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">Total Paid (₹)</label>
                                        <p className="text-lg font-semibold text-green-600">₹{group.totalPaid.toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">Remaining Balance (₹)</label>
                                        <p className={`text-lg font-semibold ${overallBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                          ₹{overallBalance.toFixed(2)}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                          Remaining = Total Deal ({totalDeal.toFixed(2)}) - Booking ({bookingAmount.toFixed(2)}) - Paid ({group.totalPaid.toFixed(2)})
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* EMI Details Section */}
                            {paymentPlan?.emiPlan && paymentPlan.emiInstallments && Array.isArray(paymentPlan.emiInstallments) && paymentPlan.emiInstallments.length > 0 && (
                              <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-200">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">EMI Plan Details</h4>
                                <div className="mb-3">
                                  <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
                                    <div>
                                      <span className="text-gray-600">EMI Plan:</span>
                                      <span className="ml-2 font-semibold text-indigo-800">Active</span>
                                    </div>
                                    {paymentPlan.emiPlanDate && (
                                      <div>
                                        <span className="text-gray-600">EMI Plan Date:</span>
                                        <span className="ml-2 font-semibold text-indigo-800">{formatDateDDMMYYYY(paymentPlan.emiPlanDate)}</span>
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-gray-600">Total Installments:</span>
                                      <span className="ml-2 font-semibold text-indigo-800">{paymentPlan.emiInstallments.length}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Total EMI Amount:</span>
                                      <span className="ml-2 font-semibold text-indigo-800">
                                        ₹{paymentPlan.emiInstallments.reduce((sum: number, inst: any) => sum + (Number(inst.amount) || 0), 0).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="overflow-x-auto min-w-max" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e0 #f7fafc' }}>
                                  <table className="min-w-full divide-y divide-gray-200 border border-gray-300" style={{ minWidth: '800px' }}>
                                    <thead className="bg-indigo-100">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Month</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Amount (₹)</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Due Date</th>
                                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {paymentPlan.emiInstallments.map((installment: any, index: number) => {
                                        // Check if this installment has a corresponding payment
                                        const installmentPayment = group.payments.find((p: any) => {
                                          const pDueDate = p.dueDate ? new Date(p.dueDate).toISOString().split('T')[0] : null;
                                          const instDueDate = installment.dueDate ? new Date(installment.dueDate).toISOString().split('T')[0] : null;
                                          return pDueDate === instDueDate && Math.abs(Number(p.amount) - Number(installment.amount)) < 0.01;
                                        });
                                        const isPaid = installmentPayment && (installmentPayment.status === 'paid' || installmentPayment.status === 'partial');
                                        const isOverdue = installment.dueDate && new Date(installment.dueDate) < new Date() && !isPaid;
                                        
                                        return (
                                          <tr key={index} className={isPaid ? 'bg-green-50' : isOverdue ? 'bg-red-50' : ''}>
                                            <td className="px-4 py-2 text-sm text-gray-900 font-medium">{installment.month || index + 1}</td>
                                            <td className="px-4 py-2 text-sm font-semibold text-indigo-900">₹{Number(installment.amount).toFixed(2)}</td>
                                            <td className="px-4 py-2 text-sm text-gray-900">
                                              {installment.dueDate ? formatDateDDMMYYYY(installment.dueDate) : '-'}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                              {isPaid ? (
                                                <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                                                  {installmentPayment.status === 'partial' ? 'Partial' : 'Paid'}
                                                </span>
                                              ) : isOverdue ? (
                                                <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800">Overdue</span>
                                              ) : (
                                                <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">Pending</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot className="bg-indigo-100">
                                      <tr>
                                        <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-gray-900">
                                          Total EMI Amount
                                        </td>
                                        <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-indigo-900 text-right">
                                          ₹{paymentPlan.emiInstallments.reduce((sum: number, inst: any) => sum + (Number(inst.amount) || 0), 0).toFixed(2)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Student Payment Details */}
                            <div className="overflow-x-auto min-w-max" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e0 #f7fafc' }}>
                              <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '1200px' }}>
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment ID</th>
                                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Batch/Enrollment</th>
                                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Due Date</th>
                                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Paid Date</th>
                                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {group.payments.map((payment: any) => (
                                    <tr key={payment.id} className="hover:bg-gray-50">
                                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                        <div className="text-xs sm:text-sm font-medium text-gray-900">#{payment.id}</div>
                                      </td>
                                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                                        {payment.enrollment?.batch ? (
                                          <div className="text-xs sm:text-sm">
                                            <div className="font-medium text-gray-900">{payment.enrollment.batch.title}</div>
                                            <div className="text-xs text-gray-500">Enrollment #{payment.enrollmentId}</div>
                                          </div>
                                        ) : (
                                          <div className="text-xs sm:text-sm text-gray-400 italic">No enrollment linked</div>
                                        )}
                                      </td>
                                      <td className="px-3 sm:px-6 py-4">
                                        {payment.status === 'partial' || (payment.paidAmount && payment.paidAmount > 0 && payment.paidAmount < payment.amount) ? (
                                          <div className="text-xs sm:text-sm space-y-1">
                                            <div className="text-gray-900 font-semibold">Total: ₹{payment.amount.toFixed(2)}</div>
                                            <div className="text-green-600 font-medium">
                                              Paid: ₹{((payment.paidAmount !== undefined && payment.paidAmount !== null) ? Number(payment.paidAmount) : 0).toFixed(2)}
                                            </div>
                                            <div className="text-red-600 font-medium">
                                              Balance: ₹{(payment.amount - ((payment.paidAmount !== undefined && payment.paidAmount !== null) ? Number(payment.paidAmount) : 0)).toFixed(2)}
                                            </div>
                                          </div>
                                        ) : payment.status === 'paid' ? (
                                          <div className="text-xs sm:text-sm text-gray-900 font-semibold">₹{payment.amount.toFixed(2)}</div>
                                        ) : (
                                          <div className="text-xs sm:text-sm text-gray-900">₹{payment.amount.toFixed(2)}</div>
                                        )}
                                        <div className="text-xs text-gray-500 lg:hidden mt-1">
                                          Due: {formatDateDDMMYYYY(payment.dueDate)}
                                        </div>
                                      </td>
                                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                                        <div className="text-xs sm:text-sm text-gray-500">
                                          {formatDateDDMMYYYY(payment.dueDate)}
                                        </div>
                                      </td>
                                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                                        <div className="text-xs sm:text-sm text-gray-500">
                                          {formatDateDDMMYYYY(payment.paidDate)}
                                        </div>
                                      </td>
                                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                          payment.status === 'paid'
                                            ? 'bg-green-100 text-green-800'
                                            : payment.status === 'partial'
                                            ? 'bg-blue-100 text-blue-800'
                                            : payment.status === 'overdue'
                                            ? 'bg-red-100 text-red-800'
                                            : payment.status === 'cancelled'
                                            ? 'bg-gray-100 text-gray-800'
                                            : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                          {payment.status}
                                        </span>
                                      </td>
                                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center">
                                          {payment.receiptUrl ? (
                                            <>
                                              <button
                                                onClick={async () => {
                                                  try {
                                                    const blob = await paymentAPI.downloadReceipt(payment.id);
                                                    const url = window.URL.createObjectURL(blob);
                                                    const link = document.createElement('a');
                                                    link.href = url;
                                                    link.download = `receipt_${payment.id}_${new Date().toISOString().split('T')[0]}.pdf`;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                    window.URL.revokeObjectURL(url);
                                                  } catch (error: any) {
                                                    alert(error.response?.data?.message || 'Failed to download receipt');
                                                  }
                                                }}
                                                className="text-blue-600 hover:text-blue-900 font-medium"
                                                title="Download Receipt"
                                              >
                                                📥 Receipt
                                              </button>
                                              <a
                                                href={payment.receiptUrl.startsWith('http') 
                                                  ? payment.receiptUrl 
                                                  : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${payment.receiptUrl.split('/').map((part: string, index: number) => {
                                                    if (index === 0 || part === '') return part;
                                                    return encodeURIComponent(part);
                                                  }).join('/')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-green-600 hover:text-green-900 font-medium"
                                                title="View Receipt"
                                              >
                                                👁️ View
                                              </a>
                                            </>
                                          ) : (payment.status === 'paid' || payment.status === 'partial') && (user?.role === 'admin' || user?.role === 'superadmin') ? (
                                            <button
                                              onClick={() => {
                                                if (confirm('Generate receipt for this payment?')) {
                                                  generateReceiptMutation.mutate(payment.id);
                                                }
                                              }}
                                              disabled={generateReceiptMutation.isPending}
                                              className="text-purple-600 hover:text-purple-900 font-medium disabled:opacity-50"
                                              title="Generate Receipt"
                                            >
                                              {generateReceiptMutation.isPending ? 'Generating...' : '📄 Generate Receipt'}
                                            </button>
                                          ) : null}
                                          {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                            <button
                                              onClick={() => {
                                                setSelectedPayment(payment);
                                                setIsUpdateModalOpen(true);
                                              }}
                                              className="text-orange-600 hover:text-orange-900 text-xs sm:text-sm"
                                            >
                                              Update
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  // All payments table view
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle sm:px-0">
                    <table className="divide-y divide-gray-200" style={{ minWidth: '1200px' }}>
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Batch/Enrollment</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Due Date</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Paid Date</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {payments.map((payment: any) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-6 py-4">
                            <div className="text-xs sm:text-sm font-medium text-gray-900">{payment.student?.name || `Student ${payment.studentId}`}</div>
                            <div className="text-xs sm:text-sm text-gray-500">{payment.student?.email || '-'}</div>
                            <div className="text-xs text-gray-500 md:hidden mt-1">
                              {payment.enrollment?.batch?.title || 'No enrollment'}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                            {payment.enrollment?.batch ? (
                              <div className="text-xs sm:text-sm">
                                <div className="font-medium text-gray-900">{payment.enrollment.batch.title}</div>
                                <div className="text-xs text-gray-500">Enrollment #{payment.enrollmentId}</div>
                              </div>
                            ) : (
                              <div className="text-xs sm:text-sm text-gray-400 italic">No enrollment linked</div>
                            )}
                          </td>
                          <td className="px-3 sm:px-6 py-4">
                            {payment.status === 'partial' || (payment.paidAmount && payment.paidAmount > 0 && payment.paidAmount < payment.amount) ? (
                              <div className="text-xs sm:text-sm space-y-1">
                                <div className="text-gray-900 font-semibold">Total: ₹{payment.amount.toFixed(2)}</div>
                                <div className="text-green-600 font-medium">
                                  Paid: ₹{((payment.paidAmount !== undefined && payment.paidAmount !== null) ? Number(payment.paidAmount) : 0).toFixed(2)}
                                </div>
                                <div className="text-red-600 font-medium">
                                  Balance: ₹{(payment.amount - ((payment.paidAmount !== undefined && payment.paidAmount !== null) ? Number(payment.paidAmount) : 0)).toFixed(2)}
                                </div>
                              </div>
                            ) : payment.status === 'paid' ? (
                              <div className="text-xs sm:text-sm text-gray-900 font-semibold">₹{payment.amount.toFixed(2)}</div>
                            ) : (
                              <div className="text-xs sm:text-sm text-gray-900">₹{payment.amount.toFixed(2)}</div>
                            )}
                            <div className="text-xs text-gray-500 lg:hidden mt-1">
                              Due: {formatDateDDMMYYYY(payment.dueDate)}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                            <div className="text-xs sm:text-sm text-gray-500">
                              {formatDateDDMMYYYY(payment.dueDate)}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                            <div className="text-xs sm:text-sm text-gray-500">
                              {formatDateDDMMYYYY(payment.paidDate)}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              payment.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : payment.status === 'partial'
                                ? 'bg-blue-100 text-blue-800'
                                : payment.status === 'overdue'
                                ? 'bg-red-100 text-red-800'
                                : payment.status === 'cancelled'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {payment.status}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center">
                            {payment.receiptUrl ? (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      const blob = await paymentAPI.downloadReceipt(payment.id);
                                      const url = window.URL.createObjectURL(blob);
                                      const link = document.createElement('a');
                                      link.href = url;
                                      link.download = `receipt_${payment.id}_${new Date().toISOString().split('T')[0]}.pdf`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      window.URL.revokeObjectURL(url);
                                    } catch (error: any) {
                                      alert(error.response?.data?.message || 'Failed to download receipt');
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-900 font-medium"
                                  title="Download Receipt"
                                >
                                  📥 Receipt
                                </button>
                                <a
                                  href={payment.receiptUrl.startsWith('http') 
                                    ? payment.receiptUrl 
                                    : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${payment.receiptUrl.split('/').map((part: string, index: number) => {
                                      // Keep the first part (empty string or '/receipts') as-is, encode the rest
                                      if (index === 0 || part === '') return part;
                                      return encodeURIComponent(part);
                                    }).join('/')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-600 hover:text-green-900 font-medium"
                                  title="View Receipt"
                                >
                                  👁️ View
                                </a>
                              </>
                            ) : (payment.status === 'paid' || payment.status === 'partial') && (user?.role === 'admin' || user?.role === 'superadmin') ? (
                              <button
                                onClick={() => {
                                  if (confirm('Generate receipt for this payment?')) {
                                    generateReceiptMutation.mutate(payment.id);
                                  }
                                }}
                                disabled={generateReceiptMutation.isPending}
                                className="text-purple-600 hover:text-purple-900 font-medium disabled:opacity-50"
                                title="Generate Receipt"
                              >
                                {generateReceiptMutation.isPending ? 'Generating...' : '📄 Generate Receipt'}
                              </button>
                            ) : null}
                              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                <button
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setIsUpdateModalOpen(true);
                                  }}
                                  className="text-orange-600 hover:text-orange-900 text-xs sm:text-sm"
                                >
                                  Update
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
                )}
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Payment Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create Payment</h2>
            <form onSubmit={handleCreatePayment}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                <select
                  name="studentId"
                  required
                  value={selectedStudentId}
                  onChange={handleStudentChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.email})
                    </option>
                  ))}
                </select>
              </div>
              {selectedStudentId && (
                <>
                  {/* Payment Plan Information */}
                  {(() => {
                    // Try to get payment plan from enrollment first
                    let paymentPlan: any = null;
                    if (enrollmentsData?.data && Array.isArray(enrollmentsData.data) && enrollmentsData.data.length > 0) {
                      const enrollment = enrollmentsData.data.find((e: any) => e.paymentPlan) || enrollmentsData.data[0];
                      paymentPlan = enrollment?.paymentPlan;
                    }
                    
                    // If no payment plan in enrollment, get from student profile
                    if (!paymentPlan && enrollmentsData?.studentProfile?.documents) {
                      let documents = enrollmentsData.studentProfile.documents;
                      // Parse if it's a string
                      if (typeof documents === 'string') {
                        try {
                          documents = JSON.parse(documents);
                        } catch (e) {
                          console.error('Failed to parse documents:', e);
                          documents = null;
                        }
                      }
                      
                      if (documents && typeof documents === 'object' && documents.enrollmentMetadata) {
                        const metadata = documents.enrollmentMetadata;
                        paymentPlan = {
                          totalDeal: metadata.totalDeal ?? null,
                          bookingAmount: metadata.bookingAmount ?? null,
                          balanceAmount: metadata.balanceAmount ?? null,
                          emiPlan: metadata.emiPlan ?? null,
                          emiPlanDate: metadata.emiPlanDate ?? null,
                          emiInstallments: metadata.emiInstallments ?? null,
                        };
                      }
                    }
                    
                    // Show payment plan if we have any data
                    if (paymentPlan && (paymentPlan.totalDeal !== null || paymentPlan.bookingAmount !== null || paymentPlan.balanceAmount !== null)) {
                      const totalDeal = paymentPlan.totalDeal ?? null;
                      const bookingAmount = paymentPlan.bookingAmount ?? null;
                      const balanceAmount = paymentPlan.balanceAmount ?? null;
                      
                      return (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h3 className="text-sm font-semibold text-blue-900 mb-3">Payment Plan Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-blue-700 mb-1">Total Deal Amount</label>
                              <p className="text-sm font-semibold text-blue-900">
                                {totalDeal !== null && totalDeal !== undefined ? `₹${Number(totalDeal).toFixed(2)}` : 'Not set'}
                              </p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-blue-700 mb-1">Booking Amount</label>
                              <p className="text-sm font-semibold text-blue-900">
                                {bookingAmount !== null && bookingAmount !== undefined ? `₹${Number(bookingAmount).toFixed(2)}` : 'Not set'}
                              </p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-blue-700 mb-1">Balance Amount</label>
                              <p className={`text-sm font-semibold ${balanceAmount !== null && balanceAmount !== undefined && balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {balanceAmount !== null && balanceAmount !== undefined ? `₹${Number(balanceAmount).toFixed(2)}` : 'Not set'}
                              </p>
                            </div>
                          </div>
                          {/* EMI Installments Table */}
                          {paymentPlan.emiPlan && paymentPlan.emiInstallments && Array.isArray(paymentPlan.emiInstallments) && paymentPlan.emiInstallments.length > 0 && (
                            <div className="mt-4">
                              <h4 className="text-sm font-semibold text-blue-900 mb-2">EMI Installments</h4>
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 border border-blue-200">
                                  <thead className="bg-blue-100">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-blue-700 uppercase">Month</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-blue-700 uppercase">Amount (₹)</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-blue-700 uppercase">Due Date</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {paymentPlan.emiInstallments.map((installment: any, index: number) => (
                                      <tr key={index}>
                                        <td className="px-4 py-2 text-sm text-blue-900">{installment.month}</td>
                                        <td className="px-4 py-2 text-sm font-semibold text-blue-900">₹{Number(installment.amount).toFixed(2)}</td>
                                        <td className="px-4 py-2 text-sm text-blue-900">
                                          {installment.dueDate ? formatDateDDMMYYYY(installment.dueDate) : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment (Optional - Links payment to enrollment fees)</label>
                  <select
                    name="enrollmentId"
                    value={selectedEnrollmentId}
                    onChange={handleEnrollmentChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">No enrollment (manual payment)</option>
                    {enrollmentsData?.data && Array.isArray(enrollmentsData.data) && enrollmentsData.data.length > 0 ? (
                      enrollmentsData.data.map((enrollment: any) => {
                        const paymentPlan = enrollment.paymentPlan as any;
                        const totalAmount = paymentPlan?.totalDeal || paymentPlan?.balanceAmount || paymentPlan?.bookingAmount || 0;
                        const batchTitle = enrollment.batch?.title || 'Unknown Batch';
                        return (
                          <option key={enrollment.id} value={enrollment.id}>
                            {batchTitle} - {totalAmount > 0 ? `₹${totalAmount.toFixed(2)}` : 'No fees set'}
                          </option>
                        );
                      })
                    ) : enrollmentsData?.studentProfile?.documents?.enrollmentMetadata ? (
                      // Show fees from student profile if no enrollments but profile has fees
                      (() => {
                        const metadata = enrollmentsData.studentProfile.documents.enrollmentMetadata;
                        const balanceAmount = metadata.balanceAmount || metadata.totalDeal || metadata.bookingAmount || 0;
                        return (
                          <option value="profile_fees" disabled>
                            Fees available in profile: ₹{balanceAmount > 0 ? balanceAmount.toFixed(2) : '0.00'} (Create enrollment first or use manual payment)
                          </option>
                        );
                      })()
                    ) : (
                      <option value="" disabled>No enrollments found for this student</option>
                    )}
                  </select>
                  {selectedEnrollmentId && (
                    <p className="mt-1 text-xs text-gray-500">
                      Amount will be auto-filled from enrollment fees
                    </p>
                  )}
                  {!selectedEnrollmentId && (() => {
                    let documents = enrollmentsData?.studentProfile?.documents;
                    if (!documents) return null;
                    
                    // Parse if it's a string
                    if (typeof documents === 'string') {
                      try {
                        documents = JSON.parse(documents);
                      } catch (e) {
                        console.error('Failed to parse documents:', e);
                        return null;
                      }
                    }
                    
                    if (documents && typeof documents === 'object' && documents.enrollmentMetadata) {
                      const metadata = documents.enrollmentMetadata;
                      const totalDeal = metadata.totalDeal ?? null;
                      const bookingAmount = metadata.bookingAmount ?? null;
                      // Calculate balanceAmount if not provided
                      let balanceAmount = metadata.balanceAmount;
                      if (balanceAmount === null || balanceAmount === undefined) {
                        if (totalDeal !== null && totalDeal !== undefined) {
                          balanceAmount = bookingAmount !== null && bookingAmount !== undefined 
                            ? totalDeal - bookingAmount 
                            : totalDeal;
                        }
                      }
                      return (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                          <p className="font-semibold">Fees found in student profile:</p>
                          <p>Total Deal: ₹{totalDeal !== null && totalDeal !== undefined ? Number(totalDeal).toFixed(2) : '0.00'}</p>
                          <p>Booking Amount: ₹{bookingAmount !== null && bookingAmount !== undefined ? Number(bookingAmount).toFixed(2) : '0.00'}</p>
                          <p>Balance Amount: ₹{balanceAmount !== null && balanceAmount !== undefined ? Number(balanceAmount).toFixed(2) : '0.00'}</p>
                          <p className="mt-1 italic">You can manually enter the amount above, or create an enrollment first to link it automatically.</p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  </div>
                </>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  type="number"
                  name="amount"
                  required
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  name="dueDate"
                  required
                  onChange={(e) => {
                    const displayElement = document.getElementById('dueDateDisplay');
                    if (displayElement) {
                      displayElement.textContent = e.target.value ? formatDateInputToDDMMYYYY(e.target.value) : '';
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p id="dueDateDisplay" className="mt-1 text-sm text-gray-600"></p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  name="paymentMethod"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  defaultValue=""
                >
                  <option value="">Select method</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="emi">EMI</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID</label>
                <input
                  type="text"
                  name="transactionId"
                  placeholder="Optional transaction reference"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={createPaymentMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
                >
                  {createPaymentMutation.isPending ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Payment Modal */}
      {isUpdateModalOpen && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Update Payment</h2>
            <form onSubmit={handleUpdatePayment}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue={selectedPayment.status}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid Date</label>
                <input
                  type="date"
                  name="paidDate"
                  defaultValue={selectedPayment.paidDate ? new Date(selectedPayment.paidDate).toISOString().split('T')[0] : ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paid Amount {selectedPayment.status === 'partial' || selectedPayment.status === 'paid' ? <span className="text-red-500">*</span> : ''}
                </label>
                <input
                  type="number"
                  name="paidAmount"
                  step="0.01"
                  min="0"
                  max={selectedPayment.amount}
                  required={selectedPayment.status === 'partial' || selectedPayment.status === 'paid'}
                  defaultValue={
                    selectedPayment.paidAmount !== undefined && selectedPayment.paidAmount !== null && selectedPayment.paidAmount > 0
                      ? Number(selectedPayment.paidAmount).toFixed(2)
                      : ''
                  }
                  placeholder="Enter collected amount"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Payment Amount: ₹{Number(selectedPayment.amount).toFixed(2)}
                  {selectedPayment.status === 'partial' && (
                    <span className="text-red-600 ml-2 font-semibold">⚠️ Required when status is Partial</span>
                  )}
                  {selectedPayment.status === 'paid' && (
                    <span className="text-blue-600 ml-2">Will auto-set to full amount if left empty</span>
                  )}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  name="paymentMethod"
                  defaultValue={selectedPayment.paymentMethod || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select method</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="emi">EMI</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID</label>
                <input
                  type="text"
                  name="transactionId"
                  defaultValue={selectedPayment.transactionId || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={selectedPayment.notes || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={updatePaymentMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
                >
                  {updatePaymentMutation.isPending ? 'Updating...' : 'Update'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUpdateModalOpen(false);
                    setSelectedPayment(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Excel Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Upload Payments from Excel</h2>
            <form onSubmit={handleBulkUpload}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Excel File (Student-wise payments)
                </label>
                <input
                  type="file"
                  name="file"
                  accept=".xlsx,.xls,.csv"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Supported formats: .xlsx, .xls, .csv
                </p>
              </div>
              
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-blue-900 mb-2">Required Columns:</p>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>Email or Phone (to identify student)</li>
                  <li>Amount</li>
                  <li>Due Date (DD/MM/YYYY format, e.g., 31/12/2025)</li>
                </ul>
                <p className="text-sm font-semibold text-blue-900 mt-2 mb-1">Optional Columns:</p>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>Software List (comma-separated, e.g., "Photoshop, Illustrator, Figma") - Updates student profile</li>
                  <li>Enrollment ID</li>
                  <li>Payment Method</li>
                  <li>Transaction ID</li>
                  <li>Notes</li>
                </ul>
                <p className="text-xs text-blue-700 mt-2 italic">
                  Available Software: Photoshop, Illustrator, InDesign, After Effects, Premiere Pro, Figma, Sketch, Blender, Maya, 3ds Max, Cinema 4D, Lightroom, CorelDRAW, AutoCAD, SolidWorks, Revit, SketchUp, Unity, Unreal Engine, DaVinci Resolve, Final Cut Pro, Procreate, Affinity Designer, Affinity Photo, Canva Pro, and custom software names.
                </p>
              </div>

              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="text-sm text-orange-600 hover:text-orange-800 underline"
                >
                  Download Template CSV
                </button>
              </div>

              {bulkUploadResult && (
                <div className={`mb-4 p-3 rounded-lg ${bulkUploadResult.failed > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                  <p className={`text-sm font-semibold ${bulkUploadResult.failed > 0 ? 'text-yellow-900' : 'text-green-900'}`}>
                    Upload Result: {bulkUploadResult.success} succeeded, {bulkUploadResult.failed} failed
                  </p>
                  {bulkUploadResult.errors.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      <p className="text-xs font-semibold text-red-800">Errors:</p>
                      <ul className="text-xs text-red-700 space-y-1 mt-1">
                        {bulkUploadResult.errors.slice(0, 10).map((error, idx) => (
                          <li key={idx}>Row {error.row}: {error.error}</li>
                        ))}
                        {bulkUploadResult.errors.length > 10 && (
                          <li className="text-gray-600">... and {bulkUploadResult.errors.length - 10} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={uploadingBulk || bulkUploadMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
                >
                  {uploadingBulk || bulkUploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setBulkUploadResult(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors text-sm sm:text-base"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

