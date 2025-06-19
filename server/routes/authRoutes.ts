import express from "express"
import {
  register,
  login,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword,
  forgotPassword,
  deleteAccount,
} from "../controllers/authController"
import { authenticate } from "../middleware/auth"

const authRouter = express.Router()

// Public routes
authRouter.post("/register", register)
authRouter.post("/login", login) //add token on client
authRouter.post("/forgot-password", forgotPassword)

// Authenticated routes
authRouter.get("/me", authenticate, getCurrentUser)
authRouter.post("/logout", authenticate, logout) //remove token on client

// Authenticated user routes
authRouter.patch("/profile", authenticate, updateProfile)
authRouter.patch("/password", authenticate, changePassword)
authRouter.delete("/profile", authenticate, deleteAccount)

export default authRouter
