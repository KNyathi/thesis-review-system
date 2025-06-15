import { createContext, useContext, useState, useEffect } from "react"
import axios from "axios"

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

const API_BASE_URL = "http://localhost:8000/api/v1"

// Create axios instance
const authAPI = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Auth functions
const realLogin = async (email, password) => {
  try {
    const response = await authAPI.post("/login", { email, password })
    const { token, user } = response.data

    // Store token in localStorage
    localStorage.setItem("token", token)

    return {
      success: true,
      user: user,
      token: token,
    }
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || "Login failed",
    }
  }
}

const realRegister = async (userData) => {
  try {
    const response = await authAPI.post("/register", userData)
    const { token } = response.data

    // Store token in localStorage
    localStorage.setItem("token", token)

    // Get user info after registration
    const userResponse = await authAPI.get("/me", {
      headers: { Authorization: `Bearer ${token}` },
    })

    return {
      success: true,
      user: userResponse.data,
      token: token,
    }
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || "Registration failed",
    }
  }
}

const getCurrentUser = async (token) => {
  try {
    const response = await authAPI.get("/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.data
  } catch (error) {
    localStorage.removeItem("token")
    return null
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check for existing token on app load
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token")
      if (token) {
        const userData = await getCurrentUser(token)
        setUser(userData)
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  const login = async (email, password) => {
    setLoading(true)
    try {
      const result = await realLogin(email, password)
      if (result.success) {
        setUser(result.user)
      }
      return result
    } finally {
      setLoading(false)
    }
  }

  const register = async (userData) => {
    setLoading(true)
    try {
      const result = await realRegister(userData)
      if (result.success) {
        setUser(result.user)
      }
      return result
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem("token")
    setUser(null)
  }

  const value = {
    user,
    login,
    register,
    logout,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
