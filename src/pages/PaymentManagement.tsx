import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { paymentAPI, PaymentTransaction, CreatePaymentRequest, UpdatePaymentRequest } from '../api/payment.api';
import { studentAPI } from '../api/student.api';

export const PaymentManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentTransaction | null>(null);

  // Fetch payments
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentAPI.getAllPayments(),
  });

  // Fetch students for form
  const { data: studentsData } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: CreatePaymentRequest) => paymentAPI.createPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
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
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setIsUpdateModalOpen(false);
      setSelectedPayment(null);
      alert('Payment updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update payment');
    },
  });

  const payments = paymentsData?.data.payments || [];
  const students = studentsData?.data.students || [];

  const handleDownloadCSV = () => {
    const headers = ['Student Name', 'Student Email', 'Student Phone', 'Total Amount', 'Paid Amount', 'Balance', 'Due Date', 'Paid Date', 'Status', 'Payment Method', 'Transaction ID', 'Notes'];
    
    const rows = payments.map((payment) => {
      const paidAmount = (payment.paidAmount !== undefined && payment.paidAmount !== null) ? Number(payment.paidAmount) : 0;
      const balance = payment.amount - paidAmount;
      
      return [
        payment.student?.name || `Student ${payment.studentId}`,
        payment.student?.email || '-',
        payment.student?.phone || '-',
        payment.amount.toFixed(2),
        paidAmount.toFixed(2),
        balance.toFixed(2),
        payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : '-',
        payment.paidDate ? new Date(payment.paidDate).toLocaleDateString() : '-',
        payment.status,
        payment.paymentMethod || '-',
        payment.transactionId || '-',
        payment.notes || '-',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
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
      amount,
      dueDate,
      notes: formData.get('notes') as string || undefined,
      paymentMethod: paymentMethod || undefined,
      transactionId: transactionId || undefined,
    };
    
    console.log('Creating payment with data:', data);
    createPaymentMutation.mutate(data);
  };

  const handleUpdatePayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPayment) return;
    const formData = new FormData(e.currentTarget);
    const paidAmountValue = formData.get('paidAmount')
      ? parseFloat(formData.get('paidAmount') as string)
      : undefined;
    const statusValue = formData.get('status') as 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled' || undefined;
    
    // Auto-set status based on paidAmount if status is not explicitly set
    let finalStatus = statusValue;
    if (paidAmountValue !== undefined && paidAmountValue !== null && !isNaN(paidAmountValue)) {
      if (paidAmountValue >= selectedPayment.amount) {
        finalStatus = 'paid';
      } else if (paidAmountValue > 0) {
        finalStatus = 'partial';
      }
    }
    
    const data: UpdatePaymentRequest = {
      status: finalStatus,
      paidDate: formData.get('paidDate') as string || undefined,
      paymentMethod: formData.get('paymentMethod') as string || undefined,
      transactionId: formData.get('transactionId') as string || undefined,
      notes: formData.get('notes') as string || undefined,
      paidAmount: paidAmountValue,
    };
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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Payment Management</h1>
                <p className="mt-2 text-orange-100">Manage payments</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadCSV}
                  className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download CSV
                </button>
                {(user?.role === 'admin' || user?.role === 'superadmin') && (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                  >
                    + Create Payment
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="p-6">
            {payments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No payments found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{payment.student?.name || `Student ${payment.studentId}`}</div>
                          <div className="text-sm text-gray-500">{payment.student?.email || '-'}</div>
                        </td>
                        <td className="px-6 py-4">
                          {payment.status === 'partial' || (payment.paidAmount && payment.paidAmount > 0 && payment.paidAmount < payment.amount) ? (
                            <div className="text-sm space-y-1">
                              <div className="text-gray-900 font-semibold">Total: ₹{payment.amount.toFixed(2)}</div>
                              <div className="text-green-600 font-medium">
                                Paid: ₹{((payment.paidAmount !== undefined && payment.paidAmount !== null) ? Number(payment.paidAmount) : 0).toFixed(2)}
                              </div>
                              <div className="text-red-600 font-medium">
                                Balance: ₹{(payment.amount - ((payment.paidAmount !== undefined && payment.paidAmount !== null) ? Number(payment.paidAmount) : 0)).toFixed(2)}
                              </div>
                            </div>
                          ) : payment.status === 'paid' ? (
                            <div className="text-sm text-gray-900 font-semibold">₹{payment.amount.toFixed(2)}</div>
                          ) : (
                            <div className="text-sm text-gray-900">₹{payment.amount.toFixed(2)}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {payment.paidDate ? new Date(payment.paidDate).toLocaleDateString() : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {(user?.role === 'admin' || user?.role === 'superadmin') && (
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setIsUpdateModalOpen(true);
                              }}
                              className="text-orange-600 hover:text-orange-900"
                            >
                              Update
                            </button>
                          )}
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

      {/* Create Payment Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create Payment</h2>
            <form onSubmit={handleCreatePayment}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                <select
                  name="studentId"
                  required
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
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
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createPaymentMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {createPaymentMutation.isPending ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid Amount</label>
                <input
                  type="number"
                  name="paidAmount"
                  step="0.01"
                  min="0"
                  defaultValue={
                    selectedPayment.paidAmount !== undefined
                      ? Number(selectedPayment.paidAmount).toString()
                      : ''
                  }
                  placeholder="Enter collected amount"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
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
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={updatePaymentMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {updatePaymentMutation.isPending ? 'Updating...' : 'Update'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUpdateModalOpen(false);
                    setSelectedPayment(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

