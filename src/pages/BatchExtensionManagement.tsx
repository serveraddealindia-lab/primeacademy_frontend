import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { batchExtensionAPI, BatchExtension, ExtensionStatus, CreateExtensionRequest } from '../api/batchExtension.api';
import { batchAPI } from '../api/batch.api';

export const BatchExtensionManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState<BatchExtension | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  // Fetch extensions
  const { data: extensionsData, isLoading } = useQuery({
    queryKey: ['batch-extensions'],
    queryFn: () => batchExtensionAPI.getExtensions(),
  });

  // Fetch batches for dropdown
  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });

  const createExtensionMutation = useMutation({
    mutationFn: (data: CreateExtensionRequest) => batchExtensionAPI.createExtension(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-extensions'] });
      setIsCreateModalOpen(false);
      alert('Extension request created successfully!');
    },
  });

  const approveExtensionMutation = useMutation({
    mutationFn: ({ id, approve, rejectionReason }: { id: number; approve: boolean; rejectionReason?: string }) =>
      batchExtensionAPI.approveExtension(id, { approve, rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-extensions'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setIsApproveModalOpen(false);
      setSelectedExtension(null);
      alert('Extension request processed successfully!');
    },
  });

  const extensions = extensionsData?.data.extensions || [];
  const batches = batchesData?.data || [];

  const getStatusBadge = (status: ExtensionStatus) => {
    const colors = {
      [ExtensionStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
      [ExtensionStatus.APPROVED]: 'bg-green-100 text-green-800',
      [ExtensionStatus.REJECTED]: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const handleApprove = (extension: BatchExtension, _approve: boolean) => {
    setSelectedExtension(extension);
    setIsApproveModalOpen(true);
  };

  const handleSubmitApprove = (approve: boolean, rejectionReason?: string) => {
    if (selectedExtension) {
      approveExtensionMutation.mutate({ id: selectedExtension.id, approve, rejectionReason });
    }
  };

  const canApprove = (extension: BatchExtension) => {
    if (user?.role === 'superadmin') return true;
    if (user?.role === 'admin' && extension.numberOfSessions <= 3) return true;
    return false;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Batch Extension Management</h1>
                <p className="mt-2 text-orange-100">Request and manage batch time extensions</p>
              </div>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                >
                  + Request Extension
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Extensions up to 3 sessions can be approved by Admin. Extensions for more than 3 sessions require SuperAdmin approval.
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Batch
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sessions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requested By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {extensions.map((extension) => (
                      <tr key={extension.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{extension.batch?.title}</div>
                          <div className="text-sm text-gray-500">{extension.batch?.software}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-semibold ${
                            extension.numberOfSessions > 3 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {extension.numberOfSessions} {extension.numberOfSessions > 3 && '(Requires SuperAdmin)'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {extension.requester?.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {extension.reason || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(extension.status)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          {extension.status === ExtensionStatus.PENDING && canApprove(extension) && (
                            <>
                              <button
                                onClick={() => handleApprove(extension, true)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleApprove(extension, false)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {extension.status === ExtensionStatus.PENDING && !canApprove(extension) && (
                            <span className="text-gray-400">Requires SuperAdmin</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {extensions.length === 0 && (
                  <div className="text-center py-12 text-gray-500">No extension requests found</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Extension Modal */}
      {isCreateModalOpen && (
        <CreateExtensionModal
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={(data) => createExtensionMutation.mutate(data)}
          batches={batches}
        />
      )}

      {/* Approve/Reject Modal */}
      {isApproveModalOpen && selectedExtension && (
        <ApproveExtensionModal
          extension={selectedExtension}
          onClose={() => {
            setIsApproveModalOpen(false);
            setSelectedExtension(null);
          }}
          onSubmit={handleSubmitApprove}
        />
      )}
    </Layout>
  );
};

// Create Extension Modal Component
const CreateExtensionModal: React.FC<{
  onClose: () => void;
  onSubmit: (data: CreateExtensionRequest) => void;
  batches: any[];
}> = ({ onClose, onSubmit, batches }) => {
  const [formData, setFormData] = useState<CreateExtensionRequest>({
    batchId: 0,
    numberOfSessions: 1,
    reason: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.batchId && formData.numberOfSessions > 0) {
      onSubmit(formData);
    } else {
      alert('Please fill in all required fields');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Request Batch Extension</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
            <select
              value={formData.batchId}
              onChange={(e) => setFormData({ ...formData, batchId: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="">Select Batch</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Sessions</label>
            <input
              type="number"
              min="1"
              value={formData.numberOfSessions}
              onChange={(e) => setFormData({ ...formData, numberOfSessions: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
            {formData.numberOfSessions > 3 && (
              <p className="text-sm text-red-600 mt-1">This will require SuperAdmin approval</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Approve Extension Modal Component
const ApproveExtensionModal: React.FC<{
  extension: BatchExtension;
  onClose: () => void;
  onSubmit: (approve: boolean, rejectionReason?: string) => void;
}> = ({ extension, onClose, onSubmit }) => {
  const [approve, setApprove] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(approve, approve ? undefined : rejectionReason);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {approve ? 'Approve' : 'Reject'} Extension Request
        </h2>
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            <strong>Batch:</strong> {extension.batch?.title}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Sessions:</strong> {extension.numberOfSessions}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Reason:</strong> {extension.reason || '-'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                checked={approve}
                onChange={() => setApprove(true)}
              />
              <span>Approve</span>
            </label>
            <label className="flex items-center space-x-2 mt-2">
              <input
                type="radio"
                checked={!approve}
                onChange={() => setApprove(false)}
              />
              <span>Reject</span>
            </label>
          </div>
          {!approve && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                required={!approve}
              />
            </div>
          )}
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-lg text-white ${
                approve ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {approve ? 'Approve' : 'Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};






