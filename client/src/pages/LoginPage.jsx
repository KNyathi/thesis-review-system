import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { FiLogIn, FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"

const LoginPage = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const { login, loading, user } = useAuth()
  const navigate = useNavigate()
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    if (user) {
      if (user.role === "reviewer" && !user.isApproved) {
        navigate("/pending", { replace: true })
      } else {
        navigate(`/${user.role}`, { replace: true })
      }
    }
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(email, password)

    if (result.success) {
      showToast("Successfully logged in!", "success")
      // Navigation will be handled by useEffect
    } else {
      showToast(result.error || "Login failed", "error")
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
          <h1 className="text-2xl font-semibold text-white mb-2">Welcome back</h1>
          <p className="text-gray-400">Sign in to your account</p>
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-10 py-3 pr-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
                required
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

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center text-gray-400">
              <input type="checkbox" className="mr-2 rounded border-gray-600 bg-gray-900 text-white focus:ring-white" />
              Remember me
            </label>
            <button type="button" className="text-gray-400 hover:text-white transition-colors">
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-medium py-3 px-4 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <FiLogIn className="w-5 h-5" />
                Sign in
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-gray-400">Don't have an account? </span>
          <button onClick={() => navigate("/register")} className="text-white hover:underline font-medium">
            Sign up
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
