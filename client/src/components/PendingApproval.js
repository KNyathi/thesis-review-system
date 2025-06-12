import React from 'react';
import { useAuth } from '../context/AuthContext';
import { FiClock, FiLogOut } from 'react-icons/fi';

const PendingApproval = () => {
  const { logout } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg text-center">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-blue-100 text-blue-600">
            <FiClock className="w-12 h-12" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900">Pending Approval</h2>
        
        <p className="text-gray-600">
          Your reviewer account is pending approval from an administrator.
          You will receive an email notification once your account has been approved.
        </p>
        
        <button
          onClick={logout}
          className="flex items-center justify-center w-full px-4 py-2 mt-6 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FiLogOut className="w-5 h-5 mr-2" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default PendingApproval;