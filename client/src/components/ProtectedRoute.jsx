import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth()

  // Show loading spinner while authentication is being processed
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Special handling for reviewers
  if (user.role === "reviewer") {
    if (!user.isApproved) {
      // Allow access to pending page
      if (window.location.pathname === "/pending-approval") {
        return children
      }
      return <Navigate to="/pending-approval" replace />
    } else {
      // If approved reviewer tries to access pending page, redirect to dashboard
      if (window.location.pathname === "/pending-approval") {
        return <Navigate to="/reviewer" replace />
      }
    }
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />
  }

  return children
}

export default ProtectedRoute