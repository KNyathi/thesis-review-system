import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

const ProtectedRoute = ({ children, role }) => {
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

  // Reviewer approval logic
  if (user.role === "reviewer") {
    if (!user.isApproved) {
      // If trying to access reviewer dashboard but not approved
      if (role === "reviewer") {
        return <Navigate to="/pending" replace />
      }
      if (window.location.pathname === "/pending") {
        return children
      }
      return <Navigate to="/pending" replace />
    } else {
      // If approved reviewer tries to access pending page, redirect to dashboard
      if (window.location.pathname === "/pending") {
        return <Navigate to="/reviewer" replace />
      }
    }
  }

  if (role && user.role !== role) {
    return <Navigate to={`/${user.role}`} replace />
  }

  return children
}

export default ProtectedRoute