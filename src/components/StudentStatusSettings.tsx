import React, { useState, useEffect } from 'react';

interface StudentStatusSettingsProps {
  onSettingsChange: (settings: { includeActive: boolean; includeActivePlus: boolean; includeDropped: boolean; includeDeactive: boolean }) => void;
}

const StudentStatusSettings: React.FC<StudentStatusSettingsProps> = ({ onSettingsChange }) => {
  const [includeActive, setIncludeActive] = useState(true);
  const [includeActivePlus, setIncludeActivePlus] = useState(false);
  const [includeDropped, setIncludeDropped] = useState(false);
  const [includeDeactive, setIncludeDeactive] = useState(false);

  useEffect(() => {
    // Load settings from localStorage on component mount
    const savedSettings = localStorage.getItem('studentStatusSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setIncludeActive(settings.includeActive ?? true);
        setIncludeActivePlus(settings.includeActivePlus ?? false);
        setIncludeDropped(settings.includeDropped ?? false);
        setIncludeDeactive(settings.includeDeactive ?? false);
      } catch (error) {
        console.error('Error loading student status settings:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Notify parent component of changes
    onSettingsChange({
      includeActive,
      includeActivePlus,
      includeDropped,
      includeDeactive
    });

    // Save settings to localStorage
    const settings = {
      includeActive,
      includeActivePlus,
      includeDropped,
      includeDeactive
    };
    localStorage.setItem('studentStatusSettings', JSON.stringify(settings));
  }, [includeActive, includeActivePlus, includeDropped, includeDeactive, onSettingsChange]);

  const handleToggle = (setting: string) => {
    switch (setting) {
      case 'includeActive':
        setIncludeActive(!includeActive);
        break;
      case 'includeActivePlus':
        setIncludeActivePlus(!includeActivePlus);
        break;
      case 'includeDropped':
        setIncludeDropped(!includeDropped);
        break;
      case 'includeDeactive':
        setIncludeDeactive(!includeDeactive);
        break;
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Status Settings</h3>
      <p className="text-sm text-gray-600 mb-4">Select which student statuses to include in batch suggestions:</p>
      
      <div className="space-y-3">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeActive}
            onChange={() => handleToggle('includeActive')}
            className="h-5 w-5 text-orange-600 rounded focus:ring-orange-500"
          />
          <span className="text-gray-700">Active (default)</span>
        </label>
        
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeActivePlus}
            onChange={() => handleToggle('includeActivePlus')}
            className="h-5 w-5 text-orange-600 rounded focus:ring-orange-500"
          />
          <span className="text-gray-700">Active Plus</span>
        </label>
        
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeDropped}
            onChange={() => handleToggle('includeDropped')}
            className="h-5 w-5 text-orange-600 rounded focus:ring-orange-500"
          />
          <span className="text-gray-700">Dropped</span>
        </label>
        
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeDeactive}
            onChange={() => handleToggle('includeDeactive')}
            className="h-5 w-5 text-orange-600 rounded focus:ring-orange-500"
          />
          <span className="text-gray-700">Deactive</span>
        </label>
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Only 'Active' students are shown by default. Changes will affect student suggestions in batch creation and editing.
        </p>
      </div>
    </div>
  );
};

export default StudentStatusSettings;