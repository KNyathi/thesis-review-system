import type { Request, Response } from "express";
import { Pool } from 'pg';
import { ThesisDocument, ThesisModel } from "../models/Thesis.model";
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer, ISupervisor, IConsultant } from "../models/User.model";

const pool = new Pool({
  connectionString: process.env.DB_URL
});

const thesisModel = new ThesisModel(pool);
const userModel = new UserModel(pool);

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await userModel.find();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const getAllTheses = async (req: Request, res: Response) => {
  try {
    const theses = await thesisModel.find();
    res.json(theses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch theses" });
  }
};


export const getStudentsWithoutReviewers = async (req: Request, res: Response) => {
  try {
    const students = await userModel.getStudents();
    const studentsWithoutReviewers = students.filter(student => !student.reviewer);
    res.json(studentsWithoutReviewers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch students without reviewers" });
  }
};

export const getThesesByStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.params;
    const theses = await thesisModel.getThesesByStatus(status);
    res.json(theses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch theses by status" });
  }
};

export const getUnassignedTheses = async (req: Request, res: Response) => {
  try {
    const unassignedTheses = await thesisModel.getUnassignedTheses();
    res.json(unassignedTheses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch unassigned theses" });
  }
};


export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Find the user to get their role and associated data
    const userToDelete = await userModel.getUserById(id);
    if (!userToDelete) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Handle different user roles
    switch (userToDelete.role) {
      case "student":
        await handleStudentDeletion(id);
        break;

      case "supervisor":
        await handleSupervisorDeletion(id, userToDelete as ISupervisor);
        break;

      case "consultant":
        await handleConsultantDeletion(id, userToDelete as IConsultant);
        break;

      case "reviewer":
        await handleReviewerDeletion(id, userToDelete as IReviewer);
        break;

      case "head_of_department":
      case "dean":
      case "admin":
        // No special cleanup needed for these roles
        break;

      default:
        const unexpectedRole = (userToDelete as IUser).role;
        console.warn(`Unknown role for user ${id}: ${unexpectedRole}`);
    }

    // Delete the user
    await userModel.deleteUser(id);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

// Helper functions for each role type
async function handleStudentDeletion(studentId: string): Promise<void> {
  // Find and delete the student's thesis
  const studentTheses = await thesisModel.getThesesByStudent(studentId);

  for (const thesis of studentTheses) {
    // Clean up assignments from supervisors, consultants, and reviewers
    await cleanupThesisAssignments(thesis);

    // Delete the thesis
    await thesisModel.deleteThesis(thesis.id);
  }

  // Remove student from supervisor's assigned students
  const student = await userModel.getUserById(studentId) as IStudent;
  if (student.supervisor) {
    await userModel.removeStudentFromSupervisor(student.supervisor, studentId);
  }

  // Remove student from consultant's assigned students
  if (student.consultant) {
    await userModel.removeStudentFromConsultant(student.consultant, studentId);
  }
}

async function handleSupervisorDeletion(supervisorId: string, supervisor: ISupervisor): Promise<void> {
  // Handle assigned students
  if (supervisor.assignedStudents && supervisor.assignedStudents.length > 0) {
    for (const studentId of supervisor.assignedStudents) {
      // Remove supervisor from student's profile
      await userModel.updateUser(studentId, { supervisor: undefined } as Partial<Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>>);

      // Update student's thesis status if needed
      const studentTheses = await thesisModel.getThesesByStudent(studentId);
      for (const thesis of studentTheses) {
        if (thesis.data.assignedSupervisor === supervisorId) {
          await thesisModel.unassignSupervisor(thesis.id);

          // If thesis was with supervisor, move it back to submitted
          if (thesis.data.status === 'with_supervisor') {
            await thesisModel.updateThesisStatus(thesis.id, 'submitted');
          }
        }
      }
    }
  }

  // Handle assigned theses
  if (supervisor.assignedTheses && supervisor.assignedTheses.length > 0) {
    for (const thesisId of supervisor.assignedTheses) {
      const thesis = await thesisModel.getThesisById(thesisId);
      if (thesis && thesis.data.assignedSupervisor === supervisorId) {
        await thesisModel.unassignSupervisor(thesisId);

        // Update thesis status if it was with supervisor
        if (thesis.data.status === 'with_supervisor') {
          await thesisModel.updateThesisStatus(thesisId, 'submitted');
        }
      }
    }
  }
}

async function handleConsultantDeletion(consultantId: string, consultant: IConsultant): Promise<void> {
  // Handle assigned students
  if (consultant.assignedStudents && consultant.assignedStudents.length > 0) {
    for (const studentId of consultant.assignedStudents) {
      // Remove consultant from student's profile
      await userModel.updateUser(studentId, { consultant: undefined } as Partial<Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>>);

      // Update student's thesis status if needed
      const studentTheses = await thesisModel.getThesesByStudent(studentId);
      for (const thesis of studentTheses) {
        if (thesis.data.assignedConsultant === consultantId) {
          await thesisModel.unassignConsultant(thesis.id);

          // If thesis was with consultant, check if it should move to supervisor
          if (thesis.data.status === 'with_consultant') {
            const newStatus = thesis.data.assignedSupervisor ? 'with_supervisor' : 'submitted';
            await thesisModel.updateThesisStatus(thesis.id, newStatus);
          }
        }
      }
    }
  }

  // Handle assigned theses
  if (consultant.assignedTheses && consultant.assignedTheses.length > 0) {
    for (const thesisId of consultant.assignedTheses) {
      const thesis = await thesisModel.getThesisById(thesisId);
      if (thesis && thesis.data.assignedConsultant === consultantId) {
        await thesisModel.unassignConsultant(thesisId);

        // Update thesis status if it was with consultant
        if (thesis.data.status === 'with_consultant') {
          const newStatus = thesis.data.assignedSupervisor ? 'with_supervisor' : 'submitted';
          await thesisModel.updateThesisStatus(thesisId, newStatus);
        }
      }
    }
  }
}

async function handleReviewerDeletion(reviewerId: string, reviewer: IReviewer): Promise<void> {
  if (reviewer.assignedTheses && reviewer.assignedTheses.length > 0) {
    for (const thesisId of reviewer.assignedTheses) {
      const thesis = await thesisModel.getThesisById(thesisId);
      if (thesis) {
        // Update thesis to remove reviewer
        await thesisModel.unassignReviewer(thesisId);

        // Update thesis status if it was under review
        if (thesis.data.status === 'under_review') {
          // Check if there's a supervisor to send it back to
          const newStatus = thesis.data.assignedSupervisor ? 'with_supervisor' : 'submitted';
          await thesisModel.updateThesisStatus(thesisId, newStatus);
        }

        // Update student's status and remove reviewer
        if (thesis.data.student) {
          await userModel.updateStudentThesisStatus(thesis.data.student, "submitted");
          await userModel.assignReviewerToStudent(thesis.data.student, undefined as any);
        }
      }
    }
  }
}

// Generic cleanup function for thesis assignments
async function cleanupThesisAssignments(thesis: ThesisDocument): Promise<void> {
  const thesisId = thesis.id;

  // Remove from supervisor's assignedTheses
  if (thesis.data.assignedSupervisor) {
    await userModel.removeThesisFromSupervisor(thesis.data.assignedSupervisor, thesisId);
  }

  // Remove from consultant's assignedTheses
  if (thesis.data.assignedConsultant) {
    await userModel.removeThesisFromConsultant(thesis.data.assignedConsultant, thesisId);
  }

  // Remove from reviewer's assignedTheses
  if (thesis.data.assignedReviewer) {
    await userModel.removeThesisFromReviewer(thesis.data.assignedReviewer, thesisId);
  }
}