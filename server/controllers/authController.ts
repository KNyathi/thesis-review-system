import type { Request, Response } from "express"
import bcrypt from "bcrypt"
import { User, type IUser, Admin, Reviewer, Student } from "../models/User.model"
import { generateToken } from "../middleware/auth"

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, institution, role } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      res.status(400).json({ error: "User already exists" })
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create new user

    let user
    switch (role) {
      case "student":
        user = new Student({
          email,
          password: hashedPassword,
          fullName,
          institution,
          role,
          faculty: "",
          group: "",
          subjectArea: "",
          educationalProgram: "",
          degreeLevel: "bachelors",
        })
        break
      case "reviewer":
        user = new Reviewer({
          email,
          password: hashedPassword,
          fullName,
          institution,
          role,
          positions: [],
          assignedTheses: [],
          reviewedTheses: [],
          isApproved: false,
        })
        break
      case "admin":
        user = new Admin({
          email,
          password: hashedPassword,
          fullName,
          institution,
          role,
          position: "",
        })
        break
      default:
        res.status(400).json({ error: "Invalid role" })
        return
    }

    await user.save()

    // Generate JWT token
    const token = generateToken(user._id.toString(), user.role)

    res.status(201).json({ token })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Registration failed" })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body

    // Find user by email
    const user = await User.findOne({ email })
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
    const tokenExpiration = rememberMe ? "30d" : "7d" // 30 days if "Remember Me" is checked, otherwise 7 days
    const token = generateToken(user._id.toString(), user.role, tokenExpiration)

    res.setHeader("Authorization", `Bearer ${token}`)

    res.json({
      token,
      user: {
        id: user._id,
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

export const getCurrentUser = (req: Request, res: Response) => {
  try {
    const user = req.user
    if (!user) {
      res.status(401).json({ error: "User not authenticated" })
      return
    }
    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to fetch user" })
  }
}

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser
    if (!user) {
      res.status(401).json({ error: "User not authenticated" })
      return
    }

    const updates = Object.keys(req.body)

    // Define allowed updates based on user role - FIXED: Added thesisTopic for students
    let allowedUpdates: string[] = []

    if (user.role === "student") {
      allowedUpdates = [
        "fullName",
        "institution",
        "faculty",
        "group",
        "subjectArea",
        "educationalProgram",
        "degreeLevel",
        "thesisTopic", // This was missing!
      ]
    } else if (user.role === "reviewer") {
      allowedUpdates = ["fullName", "institution", "positions"]
    } else if (user.role === "admin") {
      allowedUpdates = ["fullName", "institution", "position"]
    }

    const isValidOperation = updates.every((update) => allowedUpdates.includes(update))

    if (!isValidOperation) {
      console.log("Invalid updates:", updates, "Allowed:", allowedUpdates, "Role:", user.role)
      res.status(400).json({
        error: "Invalid updates for this user role!",
        invalidFields: updates.filter((update) => !allowedUpdates.includes(update)),
        allowedFields: allowedUpdates,
      })
      return
    }

    // Fetch the user as a Mongoose document
    const userDoc = await User.findById(user._id)
    if (!userDoc) {
      res.status(404).json({ error: "User not found" })
      return
    }

    // Apply updates to the Mongoose document
    updates.forEach((update) => {
      if (update in userDoc) {
        ;(userDoc as any)[update] = req.body[update]
      }
    })

    // Save the Mongoose document
    await userDoc.save()

    res.json(userDoc)
  } catch (error) {
    console.error("Profile update error:", error)
    res.status(500).json({ error: "Profile update failed" })
  }
}

export const changePassword = async (req: Request, res: Response) => {
  try {
    const user = req.user

    if (!user) {
      res.status(401).json({ error: "User not authenticated" })
      return
    }

    const { currentPassword, newPassword } = req.body

    // Fetch the user as a Mongoose document
    const userDoc = await User.findById(user._id)
    if (!userDoc) {
      res.status(404).json({ error: "User not found" })
      return
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password)

    if (!isMatch) {
      res.status(401).json({ error: "Current password is incorrect" })
      return
    }

    // Hash new password
    userDoc.password = await bcrypt.hash(newPassword, 10)

    // Save the Mongoose document
    await userDoc.save()

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

    const userDoc = await User.findOne({ email })
    if (!userDoc) {
      res.status(404).json({ error: "User not found" })
      return
    }

    // Hash and update the new password
    userDoc.password = await bcrypt.hash(newPassword, 10)
    await userDoc.save()

    res.json({ message: "Password reset successful" })
  } catch (error) {
    console.error("Reset password error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const user = req.user
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
    const userDoc = await User.findById(user._id)
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
    await User.findByIdAndDelete(user._id)

    res.json({ message: "Account deleted successfully" })
  } catch (error) {
    console.error("Delete account error:", error)
    res.status(500).json({ error: "Failed to delete account" })
  }
}
