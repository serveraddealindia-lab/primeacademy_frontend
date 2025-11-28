import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { approvalAPI, ChangeRequest, ApproveRequestRequest } from '../api/approval.api';

export const ApprovalManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  // Fetch change requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['change-requests'],
    queryFn: () => approvalAPI.getAllChangeRequests({ status: 'pending' }),
  });

  const approveRequestMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ApproveRequestRequest }) =>
      approvalAPI.approveChangeRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      setIsApproveModalOpen(false);
      setSelectedRequest(null);
      alert('Request processed successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to process request');
    },
  });

  const requests = requestsData?.data.changeRequests || [];

  const handleApproveRequest = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRequest) return;
    const formData = new FormData(e.currentTarget);
    const data: ApproveRequestRequest = {
      approve: formData.get('approve') === 'true',
      rejectionReason: formData.get('rejectionReason') as string || undefined,
    };
    approveRequestMutation.mutate({ id: selectedRequest.id, data });
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
            <div>
              <h1 className="text-3xl font-bold text-white">Approvals</h1>
              <p className="mt-2 text-orange-100">Manage approvals</p>
            </div>
          </div>

          <div className="p-6">
            {requests.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No pending approval requests found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {requests.map((request) => (
                  <div key={request.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 capitalize">{request.type.replace('_', ' ')}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Student: {request.student?.name || `Student ${request.studentId}`}
                        </p>
                        {request.batch && (
                          <p className="text-sm text-gray-600">
                            Batch: {request.batch.title || `Batch ${request.batchId}`}
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        request.status === 'approved' ? 'bg-green-100 text-green-800' :
                        request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {request.status}
                      </span>
                    </div>
                    {request.reason && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Reason:</span> {request.reason}
                        </p>
                      </div>
                    )}
                    {request.requestedData && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">Requested Data:</p>
                        <div className="bg-gray-50 p-2 rounded text-xs">
                          {JSON.stringify(request.requestedData, null, 2)}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mb-4">
                      Created: {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '-'}
                    </p>
                    {(user?.role === 'admin' || user?.role === 'superadmin') && request.status === 'pending' && (
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setIsApproveModalOpen(true);
                        }}
                        className="w-full px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                      >
                        Review
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approve Request Modal */}
      {isApproveModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Review Request</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">Type:</span> {selectedRequest.type.replace('_', ' ')}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">Student:</span> {selectedRequest.student?.name || `Student ${selectedRequest.studentId}`}
              </p>
              {selectedRequest.reason && (
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Reason:</span> {selectedRequest.reason}
                </p>
              )}
            </div>
            <form onSubmit={handleApproveRequest}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Action *</label>
                <select
                  name="approve"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="true">Approve</option>
                  <option value="false">Reject</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason (if rejecting)</label>
                <textarea
                  name="rejectionReason"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={approveRequestMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {approveRequestMutation.isPending ? 'Processing...' : 'Submit'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsApproveModalOpen(false);
                    setSelectedRequest(null);
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







