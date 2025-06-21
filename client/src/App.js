import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"

// Import existing pages
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import ForgotPasswordPage from "./pages/ForgotPasswordPage"
import PendingApprovalPage from "./pages/PendingApprovalPage"
import ProfilePage from "./pages/ProfilePage"
import StudentDashboard from "./pages/StudentDashboard"
import ReviewerDashboard from "./pages/ReviewerDashboard"
import AdminDashboard from "./pages/AdminDashboard"
import SignReviewPage from "./pages/SignReviewPage"

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/pending-approval" element={<PendingApprovalPage />} />

            {/* Protected routes */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Student routes */}
            <Route
              path="/student"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />

            {/* Reviewer routes */}
            <Route
              path="/reviewer"
              element={
                <ProtectedRoute allowedRoles={["reviewer"]}>
                  <ReviewerDashboard />
                </ProtectedRoute>
              }
            />

            {/* Sign review route */}
            <Route
              path="/sign/:thesisId"
              element={
                <ProtectedRoute allowedRoles={["reviewer"]}>
                  <SignReviewPage />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
