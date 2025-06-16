import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { User, IUser, IReviewer } from "../models/User.model";

// Extend Express Request type with user property
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET as string;

/**
 * 1. Authentication Middleware
 * - Verifies JWT from Authorization header
 * - Attaches user to request object
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Extract token from header
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

    // Find user and attach to request
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Convert the Mongoose document to a plain object
    const userObject = user.toObject() as unknown as IUser;
    req.user = userObject;

    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * 2. Reviewer Approval Check
 * - Ensures reviewer is admin-approved before accessing protected routes
 */
export const isReviewer = (req: Request, res: Response, next: NextFunction) => {
  const reviewer = req.user as IReviewer;

  if (!reviewer) {
    res.status(401).json({ error: "User not authenticated" });
    return;
  }

  if (reviewer.role !== "reviewer") {
    res.status(403).json({ error: "Access denied. Reviewers only." });
    return;
  }

  if (reviewer.role === "reviewer" && !reviewer.isApproved) {
    res.status(403).json({
      error: "Reviewer account pending admin approval",
    });
    return;
  }

  next();
};


export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Access denied. Admins only.' });
    return;
  }

  next(); // Proceed to the next middleware if the user is an admin
};

/**
 * 3. Password Hashing Utility (for user registration/login)
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * 4. Generate JWT Token (for successful login)
 */
export const generateToken = (userId: string, role: string, expiresIn: any  = "7d"): string => {
  return jwt.sign(
    { id: userId, role },
    JWT_SECRET,
    { expiresIn} // Token expires in 7 days
  );
};
