import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { UserModel, IUser, IReviewer } from "../models/User.model";
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DB_URL
});
const userModel = new UserModel(pool);

// Extend Express Request type with user property
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET as string;


export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Extract token from header
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };

    // Find user and attach to request
    const user = await userModel.getUserById(decoded.id);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // The user is already a plain IUser object from getUserById
    req.user = user;

    next();
  } catch (err) {
    console.error("JWT verification error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * 2. Reviewer Approval Check
 * - Ensures reviewer is admin-approved before accessing protected routes
 */
export const requireReviewer = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "User not authenticated" });
    return;
  }

  if (user.role !== "reviewer") {
    res.status(403).json({ error: "Access denied. Reviewers only." });
    return;
  }

  const reviewer = user as IReviewer;
  if (!reviewer.isApproved) {
    res.status(403).json({
      error: "Reviewer account pending admin approval",
    });
    return;
  }

  next();
};

/**
 * 3. Reviewer Middleware (without approval check)
 * - Only checks if user is a reviewer, regardless of approval status
 */
export const isReviewer = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "User not authenticated" });
    return;
  }

  if (user.role !== "reviewer") {
    res.status(403).json({ error: "Access denied. Reviewers only." });
    return;
  }

  next();
};

/**
 * 4. Admin Middleware
 */
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

  next();
};

/**
 * 5. Student Middleware
 */
export const isStudent = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  if (user.role !== 'student') {
    res.status(403).json({ error: 'Access denied. Students only.' });
    return;
  }

  next();
};

/**
 * 6. Role-based access control middleware
 * - Allows multiple roles to access a route
 */
export const requireRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ 
        error: 'Access denied. Insufficient permissions.',
        requiredRoles: allowedRoles,
        userRole: user.role
      });
      return;
    }

    next();
  };
};

/**
 * 7. Optional authentication middleware
 * - Attaches user if token is present, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  
  if (!token) {
    return next(); // Continue without user
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    const user = await userModel.getUserById(decoded.id);
    
    if (user) {
      req.user = user;
    }
    
    next();
  } catch (err) {
    // If token is invalid, just continue without user
    next();
  }
};

/**
 * 8. Password Hashing Utility (for user registration/login)
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * 9. Generate JWT Token (for successful login)
 */
export const generateToken = (userId: string, role: string, expiresIn: any = "7d"): string => {
  return jwt.sign(
    { id: userId, role },
    JWT_SECRET,
    { expiresIn }
  );
};

/**
 * 10. Verify password utility
 */
export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * 11. Check if user owns resource
 * - Useful for routes where users can only access their own data
 */
export const requireOwnership = (resourceUserId: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Admins can access any resource
    if (user.role === 'admin') {
      return next();
    }

    // Users can only access their own resources
    if (user.id !== resourceUserId) {
      res.status(403).json({ 
        error: 'Access denied. You can only access your own resources.' 
      });
      return;
    }

    next();
  };
};

/**
 * 12. Check if reviewer is approved for thesis operations
 */
export const requireApprovedReviewer = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "User not authenticated" });
    return;
  }

  if (user.role !== "reviewer") {
    res.status(403).json({ error: "Access denied. Reviewers only." });
    return;
  }

  const reviewer = user as IReviewer;
  if (!reviewer.isApproved) {
    res.status(403).json({
      error: "Reviewer must be approved by admin to perform this action",
    });
    return;
  }

  next();
};