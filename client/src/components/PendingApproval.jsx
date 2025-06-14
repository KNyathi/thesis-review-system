"use client"
import { useAuth } from "../context/AuthContext"
import { FiClock, FiLogOut } from "react-icons/fi"

const PendingApproval = () => {
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
          <FiClock className="w-8 h-8 text-gray-400" />
        </div>

        <h1 className="text-2xl font-semibold text-white mb-4">Pending Approval</h1>

        <p className="text-gray-400 mb-8 leading-relaxed">
          Your reviewer account is pending approval from an administrator. You will receive an email notification once
          your account has been approved.
        </p>

        <button
          onClick={logout}
          className="w-full bg-gray-900 text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition-all flex items-center justify-center gap-2"
        >
          <FiLogOut className="w-5 h-5" />
          Sign out
        </button>
      </div>
    </div>
  )
}

export default PendingApproval
