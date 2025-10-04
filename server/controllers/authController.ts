import type { Request, Response } from "express"
import bcrypt from "bcrypt"
import {
  UserModel,
  Student,
  Consultant,
  Supervisor,
  Reviewer,
  HeadOfDepartment,
  Dean,
  Admin,
  IUser,
  IStudent,
  IConsultant,
  ISupervisor,
  IReviewer,
  IHeadOfDepartment,
  IDean,
  IAdmin
} from "../models/User.model"
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
          isTopicApproved: false,
          totalReviewAttempts: 0,
          currentReviewIteration: 0,
          roles: []
        }
        user = await Student.create(userModel, studentData)
        break
      case "consultant":
        const consultantData: Omit<IConsultant, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
          email,
          password: hashedPassword,
          fullName,
          institution,
          position: roleSpecificData.position || "",
          assignedStudents: [],
          assignedTheses: [],
          reviewedTheses: [],
          reviewStats: {
            totalReviews: 0,
            approvedTheses: 0,
            averageReviewCount: 0
          },
          faculty: roleSpecificData.faculty || '',
          department: roleSpecificData.department || '',
          roles: []
        }
        user = await Consultant.create(userModel, consultantData)
        break
      case "supervisor":
        const supervisorData: Omit<ISupervisor, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
          email,
          password: hashedPassword,
          fullName,
          institution,
          position: roleSpecificData.position || "",
          department: roleSpecificData.department || "",
          assignedStudents: [],
          assignedTheses: [],
          reviewedTheses: [],
          reviewStats: {
            totalReviews: 0,
            approvedTheses: 0,
            averageReviewCount: 0
          },
          maxStudents: roleSpecificData.maxStudents || 10,
          faculty: roleSpecificData.faculty || '',
          roles: []
        }
        user = await Supervisor.create(userModel, supervisorData)
        break
      case "reviewer":
        const reviewerData: Omit<IReviewer, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
          email,
          password: hashedPassword,
          fullName,
          institution,
          position: roleSpecificData.position || "",
          assignedTheses: [],
          reviewedTheses: [],
          faculty: roleSpecificData.faculty || '',
          department: roleSpecificData.department || '',
          roles: []
        }
        user = await Reviewer.create(userModel, reviewerData)
        break
      case "head_of_department":
        const hodData: Omit<IHeadOfDepartment, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
          email,
          password: hashedPassword,
          fullName,
          institution,
          position: roleSpecificData.position || "",
          department: roleSpecificData.department || "",
          faculty: roleSpecificData.faculty || "",
          roles: []
        }
        user = await HeadOfDepartment.create(userModel, hodData)
        break
      case "dean":
        const deanData: Omit<IDean, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
          email,
          password: hashedPassword,
          fullName,
          institution,
          position: roleSpecificData.position || "",
          faculty: roleSpecificData.faculty || "",
          roles: []
        }
        user = await Dean.create(userModel, deanData)
        break
      case "admin":
        const adminData: Omit<IAdmin, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
          email,
          password: hashedPassword,
          fullName,
          institution,
          position: roleSpecificData.position || "",
          roles: []
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

    switch (userRole) {
      case "student":
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
        break
      case "consultant":
        allowedUpdates = ["fullName", "institution", "position", "expertiseAreas"]
        break
      case "supervisor":
        allowedUpdates = ["fullName", "institution", "position", "department", "maxStudents"]
        break
      case "reviewer":
        allowedUpdates = ["fullName", "institution", "position", "expertiseAreas"]
        break
      case "head_of_department":
        allowedUpdates = ["fullName", "institution", "position", "department", "faculty"]
        break
      case "dean":
        allowedUpdates = ["fullName", "institution", "position", "faculty"]
        break
      case "admin":
        allowedUpdates = ["fullName", "institution", "position"]
        break
      default:
        allowedUpdates = ["fullName", "institution"]
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
      isTopicApproved: false,
      totalReviewAttempts: 0,
      currentReviewIteration: 0,
      roles: []
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
      position,
      faculty,
      department
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
      position: position || "",
      assignedTheses: [],
      reviewedTheses: [],
      roles: [],
      faculty: faculty || "",
      department: department || "",

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

// Additional registration functions for new roles
export const registerConsultant = async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      fullName,
      institution,
      position,
      faculty,
      department
    } = req.body

    const existingUser = await userModel.getUserByEmail(email)
    if (existingUser) {
      res.status(400).json({ error: "User already exists" })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const consultantData: Omit<IConsultant, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
      email,
      password: hashedPassword,
      fullName,
      institution,
      position: position || "",
      assignedStudents: [],
      assignedTheses: [],
      reviewedTheses: [],
      reviewStats: {
        totalReviews: 0,
        approvedTheses: 0,
        averageReviewCount: 0
      },
      roles: [],
      faculty: faculty || "",
      department: department || "",
    }


    const user = await Consultant.create(userModel, consultantData)
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
    res.status(500).json({ error: "Consultant registration failed" })
  }
}

export const registerSupervisor = async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      fullName,
      institution,
      position,
      department,
      maxStudents,
      faculty
    } = req.body

    const existingUser = await userModel.getUserByEmail(email)
    if (existingUser) {
      res.status(400).json({ error: "User already exists" })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const supervisorData: Omit<ISupervisor, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
      email,
      password: hashedPassword,
      fullName,
      institution,
      position: position || "",
      department: department || "",
      assignedStudents: [],
      maxStudents: maxStudents || 10,
      assignedTheses: [],
      reviewedTheses: [],
      reviewStats: {
        totalReviews: 0,
        approvedTheses: 0,
        averageReviewCount: 0
      },
      roles: [],
      faculty: faculty || ""
    }


    const user = await Supervisor.create(userModel, supervisorData)
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
    res.status(500).json({ error: "Supervisor registration failed" })
  }
}

export const registerHeadOfDepartment = async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      fullName,
      institution,
      position,
      department,
      faculty
    } = req.body

    const existingUser = await userModel.getUserByEmail(email)
    if (existingUser) {
      res.status(400).json({ error: "User already exists" })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const hodData: Omit<IHeadOfDepartment, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
      email,
      password: hashedPassword,
      fullName,
      institution,
      position: position || "",
      department: department || "",
      faculty: faculty || "",
      roles: []
    }

    const user = await HeadOfDepartment.create(userModel, hodData)
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
    res.status(500).json({ error: "Head of Department registration failed" })
  }
}

export const registerDean = async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      fullName,
      institution,
      position,
      faculty
    } = req.body

    const existingUser = await userModel.getUserByEmail(email)
    if (existingUser) {
      res.status(400).json({ error: "User already exists" })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const deanData: Omit<IDean, 'id' | 'createdAt' | 'updatedAt' | 'role'> = {
      email,
      password: hashedPassword,
      fullName,
      institution,
      position: position || "",
      faculty: faculty || "",
      roles: []
    }

    const user = await Dean.create(userModel, deanData)
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
    res.status(500).json({ error: "Dean registration failed" })
  }
}