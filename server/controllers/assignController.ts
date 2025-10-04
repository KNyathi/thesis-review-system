import type { Request, Response } from "express";
import { Pool } from 'pg';
import { ThesisModel, IThesis, IReviewIteration } from "../models/Thesis.model";
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer, IHeadOfDepartment, IDean, IAdmin, ISupervisor, IConsultant } from "../models/User.model";

const pool = new Pool({
  connectionString: process.env.DB_URL
});

const thesisModel = new ThesisModel(pool);
const userModel = new UserModel(pool);

// Define authenticated user type
interface AuthenticatedUser {
  id: string;
  role: string;
  email: string;
}


export const assignThesisTeam = async (req: Request, res: Response) => {
  try {
    const assigner = req.user as AuthenticatedUser & (IHeadOfDepartment | IDean | IAdmin);

    const { studentId, supervisorId, consultantId, reviewerId } = req.body;

    // Validate at least one role is being assigned
    if (!supervisorId && !consultantId && !reviewerId) {
      res.status(400).json({ error: "At least one team member (supervisor, consultant, or reviewer) must be assigned" });
      return;
    }

    // Check if student exists
    const student = await userModel.getUserById(studentId);
    if (!student || student.role !== 'student') {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const studentData = student as IStudent;

    // SECURITY: Check if assigner has permission for this student's faculty
    // Admin can assign to any faculty, HOD/Dean only to their own faculty
    if (assigner.role !== 'admin') {
      if (assigner.role === 'head_of_department' || assigner.role === 'dean') {
        if (studentData.faculty !== assigner.faculty) {
          res.status(403).json({
            error: "Access denied: You can only assign to students in your faculty",
            details: {
              studentFaculty: studentData.faculty,
              yourFaculty: assigner.faculty
            }
          });
          return;
        }
      }
    }

    // Get current assignments BEFORE making changes
    const currentSupervisorId = studentData.supervisor;
    const currentConsultantId = studentData.consultant;
    const currentReviewerId = studentData.reviewer;

    // Find if there's an existing thesis for the student
    const studentTheses = await thesisModel.getThesesByStudent(studentId);
    const hasExistingThesis = studentTheses.length > 0;
    const thesis = hasExistingThesis ? studentTheses[0] : null;
    const thesisId = thesis?.id;

    // Handle SUPERVISOR assignment
    if (supervisorId) {
      const supervisor = await userModel.getUserById(supervisorId);
      if (!supervisor || supervisor.role !== 'supervisor') {
        res.status(404).json({ error: "Supervisor not found" });
        return;
      }

      const supervisorData = supervisor as ISupervisor;

      // SECURITY: Check if supervisor is in the same faculty as student
      if (supervisorData.faculty !== studentData.faculty) {
        res.status(400).json({
          error: "Supervisor must be in the same faculty as the student",
          details: {
            studentFaculty: studentData.faculty,
            supervisorFaculty: supervisorData.faculty
          }
        });
        return;
      }

      // SECURITY: Check supervisor's department if HOD is assigning
      if (assigner.role === 'head_of_department' && supervisorData.department !== assigner.department) {
        res.status(400).json({
          error: "Supervisor must be in the same department as you",
          details: {
            yourDepartment: assigner.department,
            supervisorDepartment: supervisorData.department
          }
        });
        return;
      }


      // Remove from old supervisor first
      if (currentSupervisorId && currentSupervisorId !== supervisorId) {
        await userModel.removeStudentFromSupervisor(currentSupervisorId, studentId);
        if (hasExistingThesis && thesisId) {
          await userModel.removeThesisFromSupervisor(currentSupervisorId, thesisId);
          await thesisModel.unassignSupervisor(thesisId);
        }
      }

      // Assign supervisor to student
      await userModel.assignSupervisorToStudent(studentId, supervisorId);

      // Add student to supervisor's assigned students
      await userModel.addStudentToSupervisor(supervisorId, studentId);

      // If thesis exists, assign supervisor to thesis and add to assignedTheses
      if (hasExistingThesis && thesisId) {
        await thesisModel.assignSupervisor(thesisId, supervisorId);
        await userModel.addThesisToSupervisor(supervisorId, thesisId);
      }
    }

    // Handle CONSULTANT assignment
    if (consultantId) {
      const consultant = await userModel.getUserById(consultantId);
      if (!consultant || consultant.role !== 'consultant') {
        res.status(404).json({ error: "Consultant not found" });
        return;
      }

      const consultantData = consultant as IConsultant;

      // SECURITY: Check if consultant is in the same faculty as student
      if (consultantData.faculty !== studentData.faculty) {
        res.status(400).json({
          error: "Consultant must be in the same faculty as the student",
          details: {
            studentFaculty: studentData.faculty,
            consultantFaculty: consultantData.faculty
          }
        });
        return;
      }

      // SECURITY: Check consultant's department if HOD is assigning
      if (assigner.role === 'head_of_department' && consultantData.department !== assigner.department) {
        res.status(400).json({
          error: "Consultant must be in the same department as you",
          details: {
            yourDepartment: assigner.department,
            consultantDepartment: consultantData.department
          }
        });
        return;
      }

      // Remove from old consultant first
      if (currentConsultantId && currentConsultantId !== consultantId) {
        await userModel.removeStudentFromConsultant(currentConsultantId, studentId);
        if (hasExistingThesis && thesisId) {
          await userModel.removeThesisFromConsultant(currentConsultantId, thesisId);
          await thesisModel.unassignConsultant(thesisId);
        }
      }

      // Assign consultant to student
      await userModel.assignConsultantToStudent(studentId, consultantId);

      // Add student to consultant's assigned students
      await userModel.addStudentToConsultant(consultantId, studentId);

      // If thesis exists, assign consultant to thesis and add to assignedTheses
      if (hasExistingThesis && thesisId) {
        await thesisModel.assignConsultant(thesisId, consultantId);
        await userModel.addThesisToConsultant(consultantId, thesisId);
      }
    }

    // Handle REVIEWER assignment
    if (reviewerId) {
      const reviewer = await userModel.getUserById(reviewerId);
      if (!reviewer || reviewer.role !== 'reviewer') {
        res.status(404).json({ error: "Reviewer not found" });
        return;
      }

      const reviewerData = reviewer as IReviewer;

      // SECURITY: Check if reviewer is in the same faculty as student
      if (reviewerData.faculty !== studentData.faculty) {
        res.status(400).json({
          error: "Reviewer must be in the same faculty as the student",
          details: {
            studentFaculty: studentData.faculty,
            reviewerFaculty: reviewerData.faculty
          }
        });
        return;
      }

      // SECURITY: Check reviewer's department if HOD is assigning
      if (assigner.role === 'head_of_department' && reviewerData.department !== assigner.department) {
        res.status(400).json({
          error: "Reviewer must be in the same department as you",
          details: {
            yourDepartment: assigner.department,
            reviewerDepartment: reviewerData.department
          }
        });
        return;
      }

      // Remove from old reviewer first
      if (currentReviewerId && currentReviewerId !== reviewerId) {
        if (hasExistingThesis && thesisId) {
          await userModel.removeThesisFromReviewer(currentReviewerId, thesisId);
          await thesisModel.unassignReviewer(thesisId);
        }
      }

      // Assign reviewer to student
      await userModel.assignReviewerToStudent(studentId, reviewerId);

      // If thesis exists, assign reviewer to thesis and add to assignedTheses
      if (hasExistingThesis && thesisId) {
        await thesisModel.assignReviewer(thesisId, reviewerId);
        await userModel.addThesisToReviewer(reviewerId, thesisId);
      }
    }

    let thesisStatus = 'not_submitted';
    let currentIteration = 0;
    let totalReviewCount = 0;

    if (hasExistingThesis && thesisId) {
      // Initialize or update thesis with team assignments and start first iteration if needed
      const thesisData = thesis.data;

      // Determine the appropriate status based on assigned roles
      let newThesisStatus: IThesis['status'] = thesisData.status;

      if (thesisData.status === 'submitted' || thesisData.status === 'revisions_requested') {
        // Only change status if thesis is ready for review
        if (consultantId && supervisorId) {
          newThesisStatus = 'with_consultant';
        } else if (supervisorId) {
          newThesisStatus = 'with_supervisor';
        } else if (reviewerId) {
          newThesisStatus = 'under_review';
        }

        // If we're starting a new review cycle, initialize the first iteration
        if (newThesisStatus !== 'submitted' && newThesisStatus !== 'revisions_requested') {
          if (!thesisData.reviewIterations || thesisData.reviewIterations.length === 0) {
            // Start first iteration
            const firstIteration: IReviewIteration = {
              iteration: 1,
              status: 'under_review'
            };

            await thesisModel.updateThesis(thesisId, {
              reviewIterations: [firstIteration],
              currentIteration: 1,
              totalReviewCount: 1,
              status: newThesisStatus
            });
          } else {
            // Update status of existing thesis
            await thesisModel.updateThesisStatus(thesisId, newThesisStatus);
          }
        }
      }

      // Get updated thesis data for response
      const updatedThesis = await thesisModel.getThesisById(thesisId);
      thesisStatus = updatedThesis?.data.status || 'not_submitted';
      currentIteration = updatedThesis?.data.currentIteration || 0;
      totalReviewCount = updatedThesis?.data.totalReviewCount || 0;
    }

    // Update student's team assignments in their profile
    const updateData: any = {};
    if (supervisorId) updateData.supervisor = supervisorId;
    if (consultantId) updateData.consultant = consultantId;
    if (reviewerId) updateData.reviewer = reviewerId;

    await userModel.updateUser(studentId, updateData);

    res.json({
      message: "Thesis team assigned successfully",
      assignments: {
        supervisor: supervisorId ? "Assigned" : "Not assigned",
        consultant: consultantId ? "Assigned" : "Not assigned",
        reviewer: reviewerId ? "Assigned" : "Not assigned"
      },
      thesisInfo: {
        hasThesis: hasExistingThesis,
        status: thesisStatus,
        currentIteration,
        totalReviewCount
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to assign thesis team" });
  }
};



export const assignUserRole = async (req: Request, res: Response) => {
  try {
    const assigner = req.user as AuthenticatedUser;
    const { userId, newRole, setAsPrimary = false } = req.body;

    // Validate required fields
    if (!userId || !newRole) {
      res.status(400).json({
        error: "User ID and new role are required"
      });
      return;
    }

    // Check if target user exists
    const targetUser = await userModel.getUserById(userId);
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Define role hierarchy
    const roleHierarchy = {
      'student': 1,
      'consultant': 2,
      'supervisor': 3,
      'reviewer': 4,
      'head_of_department': 5,
      'dean': 6,
      'admin': 7
    };

    // SECURITY: Check if assigner can assign this role
    const assignerLevel = roleHierarchy[assigner.role as keyof typeof roleHierarchy] || 0;
    const newRoleLevel = roleHierarchy[newRole as keyof typeof roleHierarchy];

    if (newRoleLevel === undefined) {
      res.status(400).json({
        error: "Invalid role",
        validRoles: Object.keys(roleHierarchy)
      });
      return;
    }

    // Only admin can assign admin role
    if (newRole === 'admin' && assigner.role !== 'admin') {
      res.status(403).json({
        error: "Only administrators can assign admin role"
      });
      return;
    }

    // Check hierarchy - users can only assign roles at or below their level
    if (newRoleLevel > assignerLevel) {
      res.status(403).json({
        error: "You cannot assign roles higher than your own",
        yourRole: assigner.role,
        yourLevel: assignerLevel,
        attemptedRole: newRole,
        attemptedLevel: newRoleLevel
      });
      return;
    }

    // Get current roles
    const currentRoles = targetUser.roles || [];

    // Check if user already has this role
    if (currentRoles.includes(newRole)) {
      res.status(400).json({
        error: "User already has this role",
        currentRoles
      });
      return;
    }

    // Add the new role
    const updatedRoles = [...currentRoles, newRole];

    // Determine primary role
    let primaryRole = targetUser.role;
    if (setAsPrimary || updatedRoles.length === 1) {
      primaryRole = newRole;
    }

    // Update the user's roles
    const updatedUser = await userModel.updateUser(userId, {
      roles: updatedRoles,
      role: primaryRole
    });

    res.json({
      success: true,
      message: `Role ${newRole} added to user successfully`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        roles: updatedUser.roles,
        role: updatedUser.role
      },
      assignedBy: {
        id: assigner.id,
        role: assigner.role
      }
    });

  } catch (error) {
    console.error("Error assigning user role:", error);
    res.status(500).json({ error: "Failed to assign user role" });
  }
};

export const removeUserRole = async (req: Request, res: Response) => {
  try {
    const assigner = req.user as AuthenticatedUser;
    const { userId, roleToRemove } = req.body;

    // Validate required fields
    if (!userId || !roleToRemove) {
      res.status(400).json({
        error: "User ID and role to remove are required"
      });
      return;
    }

    // Check if target user exists
    const targetUser = await userModel.getUserById(userId);
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Get current roles
    const currentRoles = targetUser.roles || [];

    // Check if user has this role
    if (!currentRoles.includes(roleToRemove)) {
      res.status(400).json({
        error: "User does not have this role",
        currentRoles
      });
      return;
    }

    // Cannot remove last role
    if (currentRoles.length === 1) {
      res.status(400).json({
        error: "Cannot remove user's only role"
      });
      return;
    }

    // Remove the role
    const updatedRoles = currentRoles.filter(role => role !== roleToRemove);

    // Update primary role if needed
    let primaryRole = targetUser.role;
    if (primaryRole === roleToRemove) {
      // Set the highest remaining role as primary
      const roleHierarchy = {
        'student': 1,
        'consultant': 2,
        'supervisor': 3,
        'reviewer': 4,
        'head_of_department': 5,
        'dean': 6,
        'admin': 7
      };

      const remainingRolesWithLevels = updatedRoles.map(role => ({
        role,
        level: roleHierarchy[role as keyof typeof roleHierarchy]
      })).sort((a, b) => b.level - a.level);

      primaryRole = remainingRolesWithLevels[0]?.role || updatedRoles[0];
    }

    // Update the user
    const updatedUser = await userModel.updateUser(userId, {
      roles: updatedRoles,
      role: primaryRole
    });

    res.json({
      success: true,
      message: `Role ${roleToRemove} removed from user successfully`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        roles: updatedUser.roles,
        role: updatedUser.role
      },
      removedBy: {
        id: assigner.id,
        role: assigner.role
      }
    });

  } catch (error) {
    console.error("Error removing user role:", error);
    res.status(500).json({ error: "Failed to remove user role" });
  }
};

export const setPrimaryRole = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthenticatedUser;
    const { userId, primaryRole } = req.body;

    // Validate required fields
    if (!userId || !primaryRole) {
      res.status(400).json({
        error: "User ID and primary role are required"
      });
      return;
    }

    // Users can only change their own primary role unless they're management
    if (!['head_of_department', 'dean', 'admin'].includes(user.role)) {
      res.status(403).json({
        error: "Only head_of_department, dean, or admin can set primary roles"
      });
      return;
    }

    // Check if target user exists
    const targetUser = await userModel.getUserById(userId);
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Check if user has this role
    if (!targetUser.roles.includes(primaryRole)) {
      res.status(400).json({
        error: "User does not have this role",
        availableRoles: targetUser.roles
      });
      return;
    }

    // Update primary role
    const updatedUser = await userModel.updateUser(userId, {
      role: primaryRole
    });

    res.json({
      success: true,
      message: `Primary role set to ${primaryRole} successfully`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        roles: updatedUser.roles,
        role: updatedUser.role
      }
    });

  } catch (error) {
    console.error("Error setting primary role:", error);
    res.status(500).json({ error: "Failed to set primary role" });
  }
};

export const getUnassignedUsers = async (req: Request, res: Response) => {
  try {
    const assigner = req.user as AuthenticatedUser;

    // Get all users
    const allUsers = await userModel.find();

    // Filter users with no roles (roles array is empty or doesn't exist)
    const unassignedUsers = allUsers.filter(user =>
      !user.roles || user.roles.length === 0
    );

    res.json({
      success: true,
      count: unassignedUsers.length,
      users: unassignedUsers.map(user => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        institution: user.institution,
        createdAt: user.createdAt,
        currentRoles: user.roles || []
      }))
    });

  } catch (error) {
    console.error("Error fetching unassigned users:", error);
    res.status(500).json({ error: "Failed to fetch unassigned users" });
  }
};