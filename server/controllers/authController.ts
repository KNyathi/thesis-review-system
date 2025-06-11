import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { User } from "../models/User.model";
import { generateToken } from "../middleware/auth";

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, institution, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: "User already exists" });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      email,
      password: hashedPassword,
      fullName,
      institution,
      role,
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id.toString(), user.role);

    res.status(201).json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Registration failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Generate JWT token
    const token = generateToken(user._id.toString(), user.role);

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
};

export const logout = (req: Request, res: Response) => {
  // In a stateless JWT setup, logout is typically handled client-side by removing the token
  res.json({ message: "Logged out successfully" });
};

export const getCurrentUser = (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const updates = Object.keys(req.body);
    const allowedUpdates = ["fullName", "institution"]; // Add other fields as needed
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      res.status(400).json({ error: "Invalid updates!" });
      return;
    }

    updates.forEach((update) => {
      if (update in user) {
        (user as any)[update] = req.body[update];
      }
    });

    await user.save();

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Profile update failed" });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    // Hash new password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Password change failed" });
  }
};
