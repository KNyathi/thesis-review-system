import { createContext, useContext, useState, useEffect, useCallback } from "react"
import axios from "axios"

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000/api/v1"

// Create axios instance
const authAPI = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Auth functions
const realLogin = async (email, password, rememberMe) => {
  try {
    const response = await authAPI.post("/login", { email, password, rememberMe })
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
    throw error
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
        try {
          const userData = await getCurrentUser(token)
          setUser(userData)
        } catch (error) {
          console.error("Failed to get current user:", error)
          localStorage.removeItem("token")
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  const login = async (email, password, rememberMe) => {
    setLoading(true)
    try {
      const result = await realLogin(email, password, rememberMe)
      if (result.success) {
        // Get fresh user data after login
        const token = localStorage.getItem("token")
        const userData = await getCurrentUser(token)
        setUser(userData)
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

  const logout = useCallback(() => {
    localStorage.removeItem("token")
    setUser(null)
  }, [])

  // Refreshing user data - use useCallback to prevent infinite loops
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (token) {
      try {
        const userData = await getCurrentUser(token)
        setUser(userData)
        return userData
      } catch (error) {
        console.error("Failed to refresh user:", error)
        logout()
        return null
      }
    }
    return null
  }, [logout])

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
