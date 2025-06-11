import { Request, Response } from "express";
import { Thesis } from "../models/Thesis.model";
import { User, IReviewer } from "../models/User.model";

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find().lean();
    res.json(users);
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
    await User.findByIdAndUpdate(id, { isApproved: true });
    res.json({ message: "Reviewer approved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to approve reviewer" });
  }
};

export const rejectReviewer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ message: "Reviewer rejected and deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to reject reviewer" });
  }
};


export const assignThesis = async (req: Request, res: Response) => {
  try {
    const { thesisId, reviewerId } = req.body;

    // Update thesis with reviewer
    await Thesis.findByIdAndUpdate(thesisId, { assignedReviewer: reviewerId });

    // Add thesis to reviewer's assignedTheses
    await User.findByIdAndUpdate(reviewerId, { $push: { assignedTheses: thesisId } });

    res.json({ message: 'Thesis assigned successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to assign thesis' });
  }
};


export const reassignThesis = async (req: Request, res: Response) => {
  try {
    const { thesisId, oldReviewerId, newReviewerId } = req.body;

    // Update thesis with new reviewer
    await Thesis.findByIdAndUpdate(thesisId, { assignedReviewer: newReviewerId });

    // Remove thesis from old reviewer's assignedTheses and add to new reviewer's assignedTheses
    await User.findByIdAndUpdate(oldReviewerId, { $pull: { assignedTheses: thesisId } });
    await User.findByIdAndUpdate(newReviewerId, { $push: { assignedTheses: thesisId } });

    res.json({ message: 'Thesis reassigned successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reassign thesis' });
  }
};

