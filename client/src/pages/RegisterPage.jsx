import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { FiUser, FiMail, FiLock, FiBook, FiEye, FiEyeOff } from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    institution: "",
    role: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const { register, loading, user } = useAuth()
  const navigate = useNavigate()
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    if (user) {
      if (user.role === "reviewer")
        navigate(`/${user.role}`, { replace: true })
      }
 
  }, [user, navigate])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.role) {
      showToast("Please select a role", "error")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      showToast("Passwords do not match", "error")
      return
    }

    const { confirmPassword, ...userData } = formData
    const result = await register(userData)

    if (result.success) {
      showToast("Account created successfully!", "success")
      // Navigation will be handled by useEffect
    } else {
      showToast(result.error || "Registration failed", "error")
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Toast {...toast} onClose={hideToast} />

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-black font-bold text-xl">T</span>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Create your account</h1>
          <p className="text-gray-400">Join our thesis review platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Select your role</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, role: "student" }))}
                className={`p-4 rounded-lg border transition-all flex flex-col items-center gap-2 ${
                  formData.role === "student"
                    ? "bg-white text-black border-white"
                    : "bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-600"
                }`}
              >
                <FiUser className="w-6 h-6" />
                <span className="font-medium">Student</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, role: "reviewer" }))}
                className={`p-4 rounded-lg border transition-all flex flex-col items-center gap-2 ${
                  formData.role === "reviewer"
                    ? "bg-white text-black border-white"
                    : "bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-600"
                }`}
              >
                <FiBook className="w-6 h-6" />
                <span className="font-medium">Reviewer</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="fullName" className="sr-only">
              Full Name
            </label>
            <div className="relative">
              <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Full Name"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

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
            <label htmlFor="institution" className="sr-only">
              Institution
            </label>
            <div className="relative">
              <FiBook className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                id="institution"
                name="institution"
                value={formData.institution}
                onChange={handleChange}
                placeholder="Institution"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password"
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
              Confirm Password
            </label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm Password"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-10 py-3 pr-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-medium py-3 px-4 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-gray-400">Already have an account? </span>
          <button onClick={() => navigate("/login")} className="text-white hover:underline font-medium">
            Sign in
          </button>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
