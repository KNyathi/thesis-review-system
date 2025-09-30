import type { Request, Response } from "express"
import bcrypt from "bcrypt"
import { UserModel, Student, Reviewer, Admin, IUser, IStudent, IReviewer, IAdmin } from "../models/User.model"
import { generateToken } from "../middleware/auth"
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DB_URL
});

const userModel = new UserModel(pool);

// Define the authenticated user type that includes the database ID
interface AuthenticatedUser {
  id: string;
  role: string;
  email: string;
  // Add other fields that your auth middleware sets
}

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, institution, role, ...roleSpecificData } = req.body

    // Check if user already exists
    const existingUser = await userModel.getUserByEmail(email)
    if (existingUser) {
      res.status(400).json({ error: "User already exists" })
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    let user: IUser
    switch (role) {
      case "student":
        const studentData: Omit<IStudent, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
          email,
          password: hashedPassword,
          fullName,
          institution,
          faculty: roleSpecificData.faculty || "",
          group: roleSpecificData.group || "",
          subjectArea: roleSpecificData.subjectArea || "",
          educationalProgram: roleSpecificData.educationalProgram || "",
          degreeLevel: roleSpecificData.degreeLevel || "bachelors",
          thesisStatus: "not_submitted",
        }
        user = await Student.create(userModel, studentData)
        break
      case "reviewer":
        const reviewerData: Omit<IReviewer, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
          email,
          password: hashedPassword,
          fullName,
          institution,
          positions: roleSpecificData.positions || [],
          assignedTheses: [],
          reviewedTheses: [],
          isApproved: false,
        }
        user = await Reviewer.create(userModel, reviewerData)
        break
      case "admin":
        const adminData: Omit<IAdmin, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
          email,
          password: hashedPassword,
          fullName,
          institution,
          position: roleSpecificData.position || "",
        }
        user = await Admin.create(userModel, adminData)
        break
      default:
        res.status(400).json({ error: "Invalid role" })
        return
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role)

    res.status(201).json({ 
      token,
      user: {
        id: user.id,
        role: user.role,
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Registration failed" })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body

    // Find user by email
    const user = await userModel.getUserByEmail(email)
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" })
      return
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      res.status(401).json({ error: "Invalid credentials" })
      return
    }

    // Generate JWT token with different expiration based on rememberMe
    const tokenExpiration = rememberMe ? "30d" : "7d"
    const token = generateToken(user.id, user.role, tokenExpiration)

    res.setHeader("Authorization", `Bearer ${token}`)

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Login failed" })
  }
}

export const logout = (req: Request, res: Response) => {
  // In a stateless JWT setup, logout is typically handled client-side by removing the token
  res.json({ message: "Logged out successfully" })
}

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthenticatedUser
    if (!user) {
      res.status(401).json({ error: "User not authenticated" })
      return
    }

    // Fetch fresh user data from database
    const userDoc = await userModel.getUserById(user.id)
    if (!userDoc) {
      res.status(404).json({ error: "User not found" })
      return
    }

    res.json(userDoc)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to fetch user" })
  }
}

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthenticatedUser
    if (!user) {
      res.status(401).json({ error: "User not authenticated" })
      return
    }

    const updates = Object.keys(req.body)

    // First, get the current user to check their role
    const currentUser = await userModel.getUserById(user.id)
    if (!currentUser) {
      res.status(404).json({ error: "User not found" })
      return
    }

    const userRole = currentUser.role;

    // Define allowed updates based on user role
    let allowedUpdates: string[] = []

    if (userRole === "student") {
      allowedUpdates = [
        "fullName",
        "institution",
        "faculty",
        "group",
        "subjectArea",
        "educationalProgram",
        "degreeLevel",
        "thesisTopic",
      ]
    } else if (userRole === "reviewer") {
      allowedUpdates = ["fullName", "institution", "positions"]
    } else if (userRole === "admin") {
      allowedUpdates = ["fullName", "institution", "position"]
    }

    const isValidOperation = updates.every((update) => allowedUpdates.includes(update))

    if (!isValidOperation) {
      console.log("Invalid updates:", updates, "Allowed:", allowedUpdates, "Role:", userRole)
      res.status(400).json({
        error: "Invalid updates for this user role!",
        invalidFields: updates.filter((update) => !allowedUpdates.includes(update)),
        allowedFields: allowedUpdates,
      })
      return
    }

    // Apply updates
    const updateData: Partial<Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>> = {}
    updates.forEach((update) => {
      (updateData as any)[update] = req.body[update]
    })

    const updatedUser = await userModel.updateUser(user.id, updateData)

    res.json(updatedUser)
  } catch (error) {
    console.error("Profile update error:", error)
    res.status(500).json({ error: "Profile update failed" })
  }
}

export const changePassword = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthenticatedUser
    if (!user) {
      res.status(401).json({ error: "User not authenticated" })
      return
    }

    const { currentPassword, newPassword } = req.body

    // Fetch the user to verify current password
    const userDoc = await userModel.getUserById(user.id)
    if (!userDoc) {
      res.status(404).json({ error: "User not found" })
      return
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, userDoc.password)
    if (!isMatch) {
      res.status(401).json({ error: "Current password is incorrect" })
      return
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await userModel.updatePassword(user.id, hashedNewPassword)

    res.json({ message: "Password changed successfully" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Password change failed" })
  }
}

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body

    if (!email || !newPassword) {
      res.status(400).json({ error: "Email and new password are required" })
      return
    }

    const userDoc = await userModel.getUserByEmail(email)
    if (!userDoc) {
      res.status(404).json({ error: "User not found" })
      return
    }

    // Hash and update the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10)
    await userModel.updatePassword(userDoc.id, hashedNewPassword)

    res.json({ message: "Password reset successful" })
  } catch (error) {
    console.error("Reset password error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthenticatedUser
    const { password } = req.body

    if (!user) {
      res.status(401).json({ error: "User not authenticated" })
      return
    }

    if (!password) {
      res.status(400).json({ error: "Password is required" })
      return
    }

    // Fetch the user document to verify password
    const userDoc = await userModel.getUserById(user.id)
    if (!userDoc) {
      res.status(404).json({ error: "User not found" })
      return
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, userDoc.password)
    if (!isMatch) {
      res.status(401).json({ error: "Invalid password" })
      return
    }

    // Delete user account
    await userModel.deleteUser(user.id)

    res.json({ message: "Account deleted successfully" })
  } catch (error) {
    console.error("Delete account error:", error)
    res.status(500).json({ error: "Failed to delete account" })
  }
}

// Additional utility function for student registration
export const registerStudent = async (req: Request, res: Response) => {
  try {
    const { 
      email, 
      password, 
      fullName, 
      institution, 
      faculty, 
      group, 
      subjectArea, 
      educationalProgram, 
      degreeLevel 
    } = req.body

    // Check if user already exists
    const existingUser = await userModel.getUserByEmail(email)
    if (existingUser) {
      res.status(400).json({ error: "User already exists" })
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    const studentData: Omit<IStudent, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
      email,
      password: hashedPassword,
      fullName,
      institution,
      faculty,
      group,
      subjectArea,
      educationalProgram,
      degreeLevel: degreeLevel || "bachelors",
      thesisStatus: "not_submitted",
    }

    const user = await Student.create(userModel, studentData)

    // Generate JWT token
    const token = generateToken(user.id, user.role)

    res.status(201).json({ 
      token,
      user: {
        id: user.id,
        role: user.role,
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Student registration failed" })
  }
}

// Additional utility function for reviewer registration
export const registerReviewer = async (req: Request, res: Response) => {
  try {
    const { 
      email, 
      password, 
      fullName, 
      institution, 
      positions 
    } = req.body

    // Check if user already exists
    const existingUser = await userModel.getUserByEmail(email)
    if (existingUser) {
      res.status(400).json({ error: "User already exists" })
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    const reviewerData: Omit<IReviewer, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
      email,
      password: hashedPassword,
      fullName,
      institution,
      positions: positions || [],
      assignedTheses: [],
      reviewedTheses: [],
      isApproved: false,
    }

    const user = await Reviewer.create(userModel, reviewerData)

    // Generate JWT token
    const token = generateToken(user.id, user.role)

    res.status(201).json({ 
      token,
      user: {
        id: user.id,
        role: user.role,
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Reviewer registration failed" })
  }
}