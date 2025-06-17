import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowLeft, FiCheck } from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import axios from "axios"

const ForgotPasswordPage = () => {
  const [formData, setFormData] = useState({
    email: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { toast, showToast, hideToast } = useToast()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (formData.newPassword !== formData.confirmPassword) {
      showToast("Passwords do not match", "error")
      return
    }

    if (formData.newPassword.length < 6) {
      showToast("Password must be at least 6 characters long", "error")
      return
    }

    try {
      setIsLoading(true)

      await axios.post("http://localhost:8000/api/v1/forgot-password", {
        email: formData.email,
        newPassword: formData.newPassword,
      })

      showToast("Password reset successful! Redirecting to login page...", "success")

      // Clear form
      setFormData({
        email: "",
        newPassword: "",
        confirmPassword: "",
      })

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login")
      }, 3000)
    } catch (error) {
      if (error.response?.status === 404) {
        showToast("User with this email address was not found. Please check your email and try again.", "error")
      } else {
        showToast(error.response?.data?.error || "Password reset failed. Please try again.", "error")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Toast {...toast} onClose={hideToast} />

      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={() => navigate("/login")}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <FiArrowLeft className="w-4 h-4" />
          Back to Login
        </button>

        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-black font-bold text-xl">T</span>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Reset Password</h1>
          <p className="text-gray-400">Enter your email and new password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="sr-only">
              Email Address
            </label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email Address"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="newPassword" className="sr-only">
              New Password
            </label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                placeholder="New Password"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-10 py-3 pr-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="sr-only">
              Confirm New Password
            </label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm New Password"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-10 py-3 pr-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showConfirmPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-400">
            <p>Password requirements:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>At least 6 characters long</li>
              <li>Must match confirmation password</li>
            </ul>
          </div>

          {/* Add information about the process */}
          <div className="text-xs text-gray-500 text-center">
            <p>We'll verify your email address and update your password if the account exists.</p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-white text-black font-medium py-3 px-4 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <FiCheck className="w-5 h-5" />
                Reset Password
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-gray-400">Remember your password? </span>
          <button onClick={() => navigate("/login")} className="text-white hover:underline font-medium">
            Sign in
          </button>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
