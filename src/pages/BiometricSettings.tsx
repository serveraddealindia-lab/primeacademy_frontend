import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { biometricAPI, BiometricDevice, CreateDeviceRequest, UpdateDeviceRequest, DeviceType, DeviceStatus } from '../api/biometric.api';

export const BiometricSettings: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<BiometricDevice | null>(null);
  const [testingDeviceId, setTestingDeviceId] = useState<number | null>(null);
  const [syncingDeviceId, setSyncingDeviceId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateDeviceRequest>({
    deviceName: '',
    deviceType: 'pull-api',
    ipAddress: '',
    port: undefined,
    apiUrl: '',
    authKey: '',
  });

  // Fetch devices
  const { data: devicesData, isLoading } = useQuery({
    queryKey: ['biometric-devices'],
    queryFn: () => biometricAPI.getAllDevices(),
    enabled: user?.role === 'admin' || user?.role === 'superadmin',
  });

  // Create device mutation
  const createDeviceMutation = useMutation({
    mutationFn: (data: CreateDeviceRequest) => biometricAPI.registerDevice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biometric-devices'] });
      setIsCreateModalOpen(false);
      setFormData({
        deviceName: '',
        deviceType: 'pull-api',
        ipAddress: '',
        port: undefined,
        apiUrl: '',
        authKey: '',
      });
      alert('Device registered successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to register device');
    },
  });

  // Update device mutation
  const updateDeviceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDeviceRequest }) =>
      biometricAPI.updateDevice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biometric-devices'] });
      setIsEditModalOpen(false);
      setSelectedDevice(null);
      alert('Device updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update device');
    },
  });

  // Delete device mutation
  const deleteDeviceMutation = useMutation({
    mutationFn: (id: number) => biometricAPI.deleteDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biometric-devices'] });
      setIsDeleteModalOpen(false);
      setSelectedDevice(null);
      alert('Device deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete device');
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: (id: number) => biometricAPI.testConnection(id),
    onSuccess: (data) => {
      setTestingDeviceId(null);
      if (data.data.connected) {
        alert('Connection successful!');
      } else {
        alert('Connection failed. Please check device settings.');
      }
    },
    onError: (error: any) => {
      setTestingDeviceId(null);
      alert(error.response?.data?.message || 'Connection test failed');
    },
  });

  // Sync now mutation
  const syncNowMutation = useMutation({
    mutationFn: (id: number) => biometricAPI.syncNow(id),
    onSuccess: (data) => {
      setSyncingDeviceId(null);
      alert(`Sync completed! ${data.data.count} logs processed.`);
      queryClient.invalidateQueries({ queryKey: ['biometric-devices'] });
    },
    onError: (error: any) => {
      setSyncingDeviceId(null);
      alert(error.response?.data?.message || 'Sync failed');
    },
  });

  const handleCreate = () => {
    createDeviceMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedDevice) return;
    updateDeviceMutation.mutate({
      id: selectedDevice.id,
      data: {
        deviceName: formData.deviceName,
        ipAddress: formData.ipAddress,
        port: formData.port,
        apiUrl: formData.apiUrl,
        authKey: formData.authKey,
      },
    });
  };

  const handleDelete = () => {
    if (!selectedDevice) return;
    deleteDeviceMutation.mutate(selectedDevice.id);
  };

  const handleTestConnection = (deviceId: number) => {
    setTestingDeviceId(deviceId);
    testConnectionMutation.mutate(deviceId);
  };

  const handleSyncNow = (deviceId: number) => {
    setSyncingDeviceId(deviceId);
    syncNowMutation.mutate(deviceId);
  };

  const openEditModal = (device: BiometricDevice) => {
    setSelectedDevice(device);
    setFormData({
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      ipAddress: device.ipAddress || '',
      port: device.port || undefined,
      apiUrl: device.apiUrl || '',
      authKey: device.authKey || '',
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (device: BiometricDevice) => {
    setSelectedDevice(device);
    setIsDeleteModalOpen(true);
  };

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-500 px-8 py-6">
              <h1 className="text-3xl font-bold text-white">Access Denied</h1>
            </div>
            <div className="p-6">
              <p className="text-gray-700">You do not have permission to access this page.</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const devices = devicesData?.data || [];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Biometric Device Settings</h1>
                <p className="mt-2 text-orange-100">Manage biometric devices and attendance integration</p>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(true);
                  setFormData({
                    deviceName: '',
                    deviceType: 'pull-api',
                    ipAddress: '',
                    port: undefined,
                    apiUrl: '',
                    authKey: '',
                  });
                }}
                className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
              >
                + Add Device
              </button>
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No biometric devices registered yet.</p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                >
                  Add Your First Device
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Device Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Connection
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Sync
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Logs
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {devices.map((device) => (
                      <tr key={device.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{device.deviceName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {device.deviceType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {device.apiUrl ? (
                            <div className="truncate max-w-xs" title={device.apiUrl}>
                              {device.apiUrl}
                            </div>
                          ) : device.ipAddress ? (
                            <div>
                              {device.ipAddress}:{device.port}
                            </div>
                          ) : (
                            <span className="text-gray-400">Not configured</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              device.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {device.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {device.lastSyncAt
                            ? new Date(device.lastSyncAt).toLocaleString()
                            : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {device.logCount || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            {device.deviceType === 'pull-api' && (
                              <>
                                <button
                                  onClick={() => handleTestConnection(device.id)}
                                  disabled={testingDeviceId === device.id}
                                  className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                                  title="Test Connection"
                                >
                                  {testingDeviceId === device.id ? 'Testing...' : '🔌'}
                                </button>
                                <button
                                  onClick={() => handleSyncNow(device.id)}
                                  disabled={syncingDeviceId === device.id}
                                  className="text-green-600 hover:text-green-900 disabled:opacity-50"
                                  title="Sync Now"
                                >
                                  {syncingDeviceId === device.id ? 'Syncing...' : '🔄'}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => openEditModal(device)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Edit"
                            >
                              ✏️
                            </button>
                            {user?.role === 'superadmin' && (
                              <button
                                onClick={() => openDeleteModal(device)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete"
                              >
                                🗑️
                              </button>
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

        {/* Create Device Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">Register New Device</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Device Name</label>
                  <input
                    type="text"
                    value={formData.deviceName}
                    onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., ZKTeco Main Entrance"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Device Type</label>
                  <select
                    value={formData.deviceType}
                    onChange={(e) => setFormData({ ...formData, deviceType: e.target.value as DeviceType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="pull-api">Pull API (Fetch logs from device)</option>
                    <option value="push-api">Push API (Device sends logs to us)</option>
                  </select>
                </div>
                {formData.deviceType === 'pull-api' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API URL (or leave blank to use IP/Port)
                      </label>
                      <input
                        type="text"
                        value={formData.apiUrl || ''}
                        onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="https://device.example.com/api"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                        <input
                          type="text"
                          value={formData.ipAddress || ''}
                          onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="192.168.1.100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                        <input
                          type="number"
                          value={formData.port || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, port: e.target.value ? parseInt(e.target.value) : undefined })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="4370"
                        />
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auth Key (Optional)</label>
                  <input
                    type="text"
                    value={formData.authKey || ''}
                    onChange={(e) => setFormData({ ...formData, authKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Device authentication key"
                  />
                </div>
                {formData.deviceType === 'push-api' && (
                  <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800">
                    <p className="font-semibold mb-1">Push API Setup:</p>
                    <p>
                      Configure your device to send logs to:{' '}
                      <code className="bg-blue-100 px-1 rounded">
                        {window.location.origin}/api/biometric/push-log
                      </code>
                    </p>
                    <p className="mt-2">Include deviceId or deviceAuthKey in the request payload.</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!formData.deviceName || createDeviceMutation.isPending}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                >
                  {createDeviceMutation.isPending ? 'Registering...' : 'Register Device'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Device Modal */}
        {isEditModalOpen && selectedDevice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">Edit Device</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Device Name</label>
                  <input
                    type="text"
                    value={formData.deviceName}
                    onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                {selectedDevice.deviceType === 'pull-api' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
                      <input
                        type="text"
                        value={formData.apiUrl || ''}
                        onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                        <input
                          type="text"
                          value={formData.ipAddress || ''}
                          onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                        <input
                          type="number"
                          value={formData.port || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, port: e.target.value ? parseInt(e.target.value) : undefined })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auth Key</label>
                  <input
                    type="text"
                    value={formData.authKey || ''}
                    onChange={(e) => setFormData({ ...formData, authKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={selectedDevice.status}
                    onChange={(e) =>
                      updateDeviceMutation.mutate({
                        id: selectedDevice.id,
                        data: { status: e.target.value as DeviceStatus },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedDevice(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={updateDeviceMutation.isPending}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                >
                  {updateDeviceMutation.isPending ? 'Updating...' : 'Update Device'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Device Modal */}
        {isDeleteModalOpen && selectedDevice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">Delete Device</h2>
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete <strong>{selectedDevice.deviceName}</strong>? This action cannot be
                undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedDevice(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteDeviceMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteDeviceMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

