import React from 'react';
import { Layout } from '../components/Layout';
import StudentStatusSettings from '../components/StudentStatusSettings';

const Settings: React.FC = () => {
  const handleSettingsChange = (settings: {
    includeActive: boolean;
    includeActivePlus: boolean;
    includeDropped: boolean;
    includeDeactive: boolean;
  }) => {
    console.log('Settings changed:', settings);
    // Settings are handled via localStorage in the StudentStatusSettings component
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 md:px-8 py-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Settings</h1>
          </div>

          <div className="p-6 md:p-8">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Student Status Settings</h2>
              <p className="text-gray-600 mb-6">
                Configure which student statuses are included in batch suggestions.
              </p>
              
              <StudentStatusSettings onSettingsChange={handleSettingsChange} />
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Other Settings</h2>
              <p className="text-gray-600">
                Additional settings will be available here in future updates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;