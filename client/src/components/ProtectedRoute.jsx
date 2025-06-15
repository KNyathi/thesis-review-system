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

  if (role && user.role !== role) {
    if (user.role === "reviewer" && !user.isApproved) {
      return <Navigate to="/pending" replace />
    }
    return <Navigate to={`/${user.role}`} replace />
  }

  if (user.role === "reviewer" && !user.isApproved) {
    return <Navigate to="/pending" replace />
  }

  return children
}

export default ProtectedRoute
