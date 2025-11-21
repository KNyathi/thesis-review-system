import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"

// Pages
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import StudentDashboard from "./pages/StudentDashboard"
import ReviewerDashboard from "./pages/ReviewerDashboard"
import AdminDashboard from "./pages/AdminDashboard"
import ProfilePage from "./pages/ProfilePage"
import SignReviewPage from "./pages/SignReviewPage"
import ConsultantSignReviewPage from "./pages/ConsultantSignReviewPage"

// New role dashboards
import SupervisorDashboard from "./pages/SupervisorDashboard"
import SupervisorSignReviewPage from "./pages/SupervisorSignReviewPage"
import ConsultantDashboard from "./pages/ConsultantDashboard"
import HeadDashboard from "./pages/HeadDashboard"
import DeanDashboard from "./pages/DeanDashboard"

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student"
            element={
              <ProtectedRoute allowed={["student"]}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reviewer"
            element={
              <ProtectedRoute allowed={["reviewer"]}>
                <ReviewerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowed={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/supervisor"
            element={
              <ProtectedRoute allowed={["supervisor"]}>
                <SupervisorDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/supervisor-sign/:thesisId"
            element={
              <ProtectedRoute allowed={["supervisor"]}>
                <SupervisorSignReviewPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/consultant"
            element={
              <ProtectedRoute allowed={["consultant"]}>
                <ConsultantDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/consultant-sign/:thesisId"
            element={
              <ProtectedRoute allowed={["consultant"]}>
                <ConsultantSignReviewPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/head"
            element={
              <ProtectedRoute allowed={["head_of_department", "head"]}>
                <HeadDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dean"
            element={
              <ProtectedRoute allowed={["dean"]}>
                <DeanDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/review/:id"
            element={
              <ProtectedRoute allowed={["reviewer", "head_of_department", "dean", "admin"]}>
                <SignReviewPage />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
