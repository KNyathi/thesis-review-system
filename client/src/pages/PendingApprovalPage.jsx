import { useNavigate } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { FiClock, FiLogOut, FiMail, FiUser, FiRefreshCw } from "react-icons/fi"
import { useAuth } from "../context/AuthContext"

const PendingApprovalPage = () => {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const hasCheckedOnMount = useRef(false)

  // Check approval status only ONCE when component mounts
  useEffect(() => {
    if (hasCheckedOnMount.current) return

    const checkApprovalStatus = async () => {
      try {
        hasCheckedOnMount.current = true
        const updatedUser = await refreshUser()
        // If user is now approved, redirect to reviewer dashboard
        if (updatedUser && updatedUser.role === "reviewer" && updatedUser.isApproved) {
          navigate("/reviewer", { replace: true })
        }
      } catch (error) {
        console.error("Failed to check approval status:", error)
      }
    }

    // Only check if we have a user and they're a reviewer
    if (user && user.role === "reviewer" && !user.isApproved) {
      checkApprovalStatus()
    }
  }, [])

  // Separate effect to handle navigation when user status changes
  useEffect(() => {
    if (user && user.role === "reviewer" && user.isApproved) {
      navigate("/reviewer", { replace: true })
    }
  }, [user, navigate])

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const handleRefreshStatus = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      const updatedUser = await refreshUser()
      if (updatedUser && updatedUser.role === "reviewer" && updatedUser.isApproved) {
        navigate("/reviewer", { replace: true })
      }
    } catch (error) {
      console.error("Failed to refresh status:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Show loading state while user data is being fetched
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  // Redirect non-reviewers
  if (user.role !== "reviewer") {
    navigate("/login", { replace: true })
    return null
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* User Info Header */}
        <div className="mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-semibold text-lg">
              {user?.fullName
                ?.split(" ")
                .map((name) => name[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "U"}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">{user?.fullName || "User"}</h2>
          <p className="text-gray-400 text-sm">{user?.email || "No email available"}</p>
        </div>

        {/* Pending Status */}
        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
          <FiClock className="w-8 h-8 text-yellow-400" />
        </div>

        <h1 className="text-2xl font-semibold text-white mb-4">Account Pending Approval</h1>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-8">
          <div className="space-y-4 text-left">
            <div className="flex items-start gap-3">
              <FiUser className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div>
                <p className="text-white font-medium text-sm">Reviewer Account Status</p>
                <p className="text-gray-400 text-sm">
                  Your reviewer account is currently under review by our administrators.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FiMail className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <p className="text-white font-medium text-sm">Email Notification</p>
                <p className="text-gray-400 text-sm">
                  You will receive an email notification once your account has been approved.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FiClock className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <p className="text-white font-medium text-sm">Review Process</p>
                <p className="text-gray-400 text-sm">Account reviews typically take 1-3 business days to complete.</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-gray-400 mb-8 leading-relaxed">
          Thank you for your patience. Our administrators will review your credentials and approve your reviewer account
          shortly.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
            className="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiRefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Checking..." : "Check Approval Status"}
          </button>

          <button
            onClick={handleLogout}
            className="w-full bg-gray-900 text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition-all flex items-center justify-center gap-2 border border-gray-800"
          >
            <FiLogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export default PendingApprovalPage
