import { Request, Response } from "express";
import { Thesis } from "../models/Thesis.model";
import { User, Reviewer, Student, Admin } from "../models/User.model";

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find().lean();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const getAllTheses = async (req: Request, res: Response) => {
  try {
    const theses = await Thesis.find().lean();
    res.json(theses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

export const approveReviewer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Use the Reviewer model to update the document
    const updatedReviewer = await Reviewer.findByIdAndUpdate(
      id,
      { isApproved: true },
      { new: true } // This option returns the updated document
    );

    if (!updatedReviewer) {
      res.status(404).json({ error: "Reviewer not found" });
      return;
    }

    res.json({
      message: "Reviewer approved successfully",
      reviewer: updatedReviewer,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to approve reviewer" });
  }
};

export const rejectReviewer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ message: "Reviewer rejected and deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to reject reviewer" });
  }
};

export const assignThesis = async (req: Request, res: Response) => {
  try {
    const { studentId, reviewerId } = req.body;

    // Find a thesis associated with the student
    const thesis = await Thesis.findOne({ student: studentId });

    if (!thesis) {
      console.error("No thesis found for the given student");
      res.status(404).json({ error: "No thesis found for the given student" });
      return;
    }

    const thesisId = thesis._id;

    // Check if reviewer exists
    const reviewer = await User.findById(reviewerId);
    if (!reviewer) {
      console.error("Reviewer not found");
      res.status(404).json({ error: "Reviewer not found" });
      return;
    }

    // Update thesis with reviewer
    await Thesis.findByIdAndUpdate(
      thesisId,
      { assignedReviewer: reviewerId },
      { new: true } // This option returns the updated document
    );

    // Add thesis to reviewer's assignedTheses
    await Reviewer.findByIdAndUpdate(
      reviewerId,
      { $push: { assignedTheses: thesisId } },
      { new: true } // This option returns the updated document
    );

    await Student.findByIdAndUpdate(
      studentId,
      { thesisStatus: "under_review", reviewer: reviewerId },
      { new: true } // This option returns the updated document
    );

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
    await Thesis.findByIdAndUpdate(thesisId, {
      assignedReviewer: newReviewerId,
    });

    // Remove thesis from old reviewer's assignedTheses and add to new reviewer's assignedTheses
    await User.findByIdAndUpdate(oldReviewerId, {
      $pull: { assignedTheses: thesisId },
    });
    await User.findByIdAndUpdate(newReviewerId, {
      $push: { assignedTheses: thesisId },
    });

    res.json({ message: "Thesis reassigned successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to reassign thesis" });
  }
};
