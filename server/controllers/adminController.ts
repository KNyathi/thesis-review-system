import type { Request, Response } from "express";
import { Pool } from 'pg';
import { ThesisModel } from "../models/Thesis.model";
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer } from "../models/User.model";

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

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Find the user to get their role and associated data
    const userToDelete = await userModel.getUserById(id);
    if (!userToDelete) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // If deleting a student, clean up their thesis and reviewer assignments
    if (userToDelete.role === "student") {
      // Find and delete the student's thesis
      const studentTheses = await thesisModel.getThesesByStudent(id);
      for (const thesis of studentTheses) {
        // If thesis was assigned to a reviewer, remove it from reviewer's assignedTheses
        if (thesis.data.assignedReviewer) {
          const reviewer = await userModel.getUserById(thesis.data.assignedReviewer);
          if (reviewer && reviewer.role === 'reviewer') {
            const reviewerData = reviewer as IReviewer;
            const updatedAssignedTheses = reviewerData.assignedTheses.filter(
              (thesisId: string) => thesisId !== thesis.id
            );
            // Use the reviewer-specific method
            await userModel.removeThesisFromReviewer(reviewer.id, thesis.id);
          }
        }
        // Delete the thesis
        await thesisModel.deleteThesis(thesis.id);
      }
    }

    // If deleting a reviewer, clean up their assigned theses
    if (userToDelete.role === "reviewer") {
      const reviewerData = userToDelete as IReviewer;
      if (reviewerData.assignedTheses && reviewerData.assignedTheses.length > 0) {
        // Update all assigned theses to remove reviewer assignment
        for (const thesisId of reviewerData.assignedTheses) {
          const thesis = await thesisModel.getThesisById(thesisId);
          if (thesis) {
            // Update thesis to remove reviewer and set status to submitted
            await thesisModel.updateThesis(thesisId, {
              assignedReviewer: undefined,
              status: "submitted"
            });

            // Update student's status back to submitted and remove reviewer
            if (thesis.data.student) {
              await userModel.updateStudentThesisStatus(thesis.data.student, "submitted");
              await userModel.assignReviewerToStudent(thesis.data.student, undefined as any);
            }
          }
        }
      }
    }

    // Delete the user
    await userModel.deleteUser(id);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

export const approveReviewer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Use the UserModel to update the reviewer
    const updatedReviewer = await userModel.approveReviewer(id);

    res.json({
      message: "Reviewer approved successfully",
      reviewer: updatedReviewer
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to approve reviewer" });
  }
};

export const rejectReviewer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if user is actually a reviewer
    const user = await userModel.getUserById(id);
    if (!user || user.role !== 'reviewer') {
      res.status(404).json({ error: "Reviewer not found" });
      return;
    }

    await userModel.deleteUser(id);
    res.json({ message: "Reviewer rejected and deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to reject reviewer" });
  }
};

export const assignThesis = async (req: Request, res: Response) => {
  try {
    const { studentId, reviewerId } = req.body;

    // Find theses associated with the student
    const studentTheses = await thesisModel.getThesesByStudent(studentId);
    if (studentTheses.length === 0) {
      res.status(404).json({ error: "No thesis found for the given student" });
      return;
    }

    // For simplicity, assign the first thesis (you might want to handle multiple theses differently)
    const thesis = studentTheses[0];
    const thesisId = thesis.id;

    // Check if reviewer exists and is approved
    const reviewer = await userModel.getUserById(reviewerId);
    if (!reviewer || reviewer.role !== 'reviewer') {
      res.status(404).json({ error: "Reviewer not found" });
      return;
    }

    const reviewerData = reviewer as IReviewer;
    if (!reviewerData.isApproved) {
      res.status(400).json({ error: "Reviewer is not approved" });
      return;
    }

    // Update thesis with reviewer
    await thesisModel.assignReviewer(thesisId, reviewerId);

    // Add thesis to reviewer's assignedTheses
    await userModel.addThesisToReviewer(reviewerId, thesisId);

    // Update student's thesis status and assign reviewer
    await userModel.updateStudentThesisStatus(studentId, "under_review");
    await userModel.assignReviewerToStudent(studentId, reviewerId);

    res.json({ message: "Thesis assigned successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to assign thesis" });
  }
};

export const reassignThesis = async (req: Request, res: Response) => {
  try {
    const { thesisId, oldReviewerId, newReviewerId } = req.body;

    // Update thesis with new reviewer
    const updatedThesis = await thesisModel.assignReviewer(thesisId, newReviewerId);
    if (!updatedThesis) {
      res.status(404).json({ error: "No thesis found for updating" });
      return;
    }

    // Remove thesis from old reviewer's assignedTheses
    const oldReviewer = await userModel.getUserById(oldReviewerId);
    if (oldReviewer && oldReviewer.role === 'reviewer') {
      await userModel.removeThesisFromReviewer(oldReviewerId, thesisId);
    } else {
      res.status(404).json({ error: "Old reviewer not found" });
      return;
    }

    // Add thesis to new reviewer's assignedTheses
    const newReviewer = await userModel.getUserById(newReviewerId);
    if (newReviewer && newReviewer.role === 'reviewer') {
      await userModel.addThesisToReviewer(newReviewerId, thesisId);
    } else {
      res.status(404).json({ error: "New reviewer not found" });
      return;
    }

    // Update student's reviewer assignment
    if (updatedThesis.data.student) {
      await userModel.assignReviewerToStudent(updatedThesis.data.student, newReviewerId);
    }

    res.json({ message: "Thesis reassigned successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to reassign thesis" });
  }
};

// Additional helper methods you might need
export const getPendingReviewers = async (req: Request, res: Response) => {
  try {
    const reviewers = await userModel.getReviewers();
    const pendingReviewers = reviewers.filter(reviewer => !reviewer.isApproved);
    res.json(pendingReviewers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch pending reviewers" });
  }
};

export const getApprovedReviewers = async (req: Request, res: Response) => {
  try {
    const approvedReviewers = await userModel.getApprovedReviewers();
    res.json(approvedReviewers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch approved reviewers" });
  }
};

export const getUnapprovedReviewers = async (req: Request, res: Response) => {
  try {
    const unapprovedReviewers = await userModel.getUnapprovedReviewers();
    res.json(unapprovedReviewers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch unapproved reviewers" });
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