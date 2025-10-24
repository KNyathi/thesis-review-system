import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { UserModel, IUser, IReviewer } from "../models/User.model";
import { Pool } from 'pg';
import { ROLES, ROLE_HIERARCHY, ROLE_GROUPS, UserRole } from './roles';

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

  next();
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


  next();
};



// Generic role checker
// Generic role checker - FIXED VERSION
export const requireRole = (allowedRoles: UserRole | UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const hasRole = (user: IUser, role: UserRole): boolean => {
      // Check both single role (backward compatibility) and roles array (new system)
      return user.role === role || (user.roles && user.roles.includes(role));
    };

    const hasAnyRole = (user: IUser, roles: UserRole[]): boolean => {
      return roles.some(role => hasRole(user, role));
    };
    // Check if user has ANY of the required roles
    const userHasRole = hasAnyRole(req.user, rolesArray);

    if (!userHasRole) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: rolesArray,
        current: req.user.role, 
        currentAllRoles: req.user.roles || [], // The new roles array
        userRoles: req.user.roles || [req.user.role] // All roles user has
      });
      return;
    }

    next();
  };
};

// Hierarchical role check (user must have at least the specified role level)
export const requireMinRole = (minRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.user.role as UserRole;
    const userRoles = req.user.roles || [userRole]; // Use roles array or fallback to single role
    const allowedRoles = ROLE_HIERARCHY[minRole];

    // Check if user has any role that meets the minimum requirement
    const hasRequiredRole = userRoles.some(role =>
      allowedRoles.includes(role as UserRole)
    );

    if (!hasRequiredRole) {
      res.status(403).json({
        error: 'Insufficient permissions',
        minimumRequired: minRole,
        current: userRole,
        currentAllRoles: userRoles,
        allowedRoles
      });
      return;
    }

    next();
  };
};

// Specific role middleware
export const isStudent = requireRole(ROLES.STUDENT);
export const isConsultant = requireRole(ROLES.CONSULTANT);
export const isSupervisor = requireRole(ROLES.SUPERVISOR);
export const isReviewer = requireRole(ROLES.REVIEWER);
export const isHeadOfDepartment = requireRole(ROLES.HEAD_OF_DEPARTMENT);
export const isDean = requireRole(ROLES.DEAN);
export const isAdmin = requireRole(ROLES.ADMIN);

// Role group middleware
export const isFaculty = requireRole(ROLE_GROUPS.FACULTY);
export const isManagement = requireRole(ROLE_GROUPS.MANAGEMENT);
export const isAcademicStaff = requireRole(ROLE_GROUPS.ACADEMIC_STAFF);
export const isStaff = requireRole(ROLE_GROUPS.ALL_STAFF);

export const isConsultantReview = requireRole(ROLE_GROUPS.ACCESS_REVIEW_1);
export const isReviewerReview = requireRole(ROLE_GROUPS.ACCESS_REVIEW_2);
export const isFinalReview = requireRole(ROLE_GROUPS.ACCESS_REVIEW_3);
export const isThesisAccess = requireRole(ROLE_GROUPS.ACCESS_THESIS);
export const isStudentSupervisor = requireRole(ROLE_GROUPS.SELECT_SV);

// Multiple specific roles
export const requireRoles = (roles: UserRole[]) => requireRole(roles);