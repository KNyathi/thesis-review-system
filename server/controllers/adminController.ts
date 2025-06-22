import type { Request, Response } from "express"
import { Thesis } from "../models/Thesis.model"
import { User, Reviewer, Student } from "../models/User.model"
import { Types } from "mongoose"

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find().lean()
    res.json(users)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to fetch users" })
  }
}

export const getAllTheses = async (req: Request, res: Response) => {
  try {
    const theses = await Thesis.find().lean()
    res.json(theses)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to fetch users" })
  }
}

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Find the user to get their role and associated data
    const userToDelete = await User.findById(id)
    if (!userToDelete) {
      res.status(404).json({ error: "User not found" })
      return
    }

    // If deleting a student, clean up their thesis and reviewer assignments
    if (userToDelete.role === "student") {
      // Find and delete the student's thesis
      const thesis = await Thesis.findOne({ student: id })
      if (thesis) {
        // If thesis was assigned to a reviewer, remove it from reviewer's assignedTheses
        if (thesis.assignedReviewer) {
          await User.findByIdAndUpdate(thesis.assignedReviewer, {
            $pull: { assignedTheses: thesis._id },
          })
        }
        // Delete the thesis
        await Thesis.findByIdAndDelete(thesis._id)
      }
    }

    // If deleting a reviewer, clean up their assigned theses
    if (userToDelete.role === "reviewer") {
      const reviewer = userToDelete as any
      if (reviewer.assignedTheses && reviewer.assignedTheses.length > 0) {
        // Update all assigned theses to remove reviewer assignment
        await Thesis.updateMany(
          { _id: { $in: reviewer.assignedTheses } },
          {
            $unset: { assignedReviewer: 1 },
            status: "submitted",
          },
        )

        // Update students' status back to submitted
        const theses = await Thesis.find({
          _id: { $in: reviewer.assignedTheses },
        })
        for (const thesis of theses) {
          await User.findByIdAndUpdate(thesis.student, {
            thesisStatus: "submitted",
            $unset: { reviewer: 1 },
          })
        }
      }
    }

    // Delete the user
    await User.findByIdAndDelete(id)

    res.json({ message: "User deleted successfully" })
  } catch (error) {
    console.error("Error deleting user:", error)
    res.status(500).json({ error: "Failed to delete user" })
  }
}

export const approveReviewer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Use the Reviewer model to update the document
    const updatedReviewer = await Reviewer.findByIdAndUpdate(
      id,
      { isApproved: true },
      { new: true }, // Returns the updated document
    )

    if (!updatedReviewer) {
      res.status(404).json({ error: "Reviewer not found" })
      return
    }

    res.json({
      message: "Reviewer approved successfully",
      reviewer: updatedReviewer,
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to approve reviewer" })
  }
}

export const rejectReviewer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await User.findByIdAndDelete(id)
    res.json({ message: "Reviewer rejected and deleted successfully" })
  } catch (error) {
    res.status(500).json({ error: "Failed to reject reviewer" })
  }
}

export const assignThesis = async (req: Request, res: Response) => {
  try {
    const { studentId, reviewerId } = req.body

    // Find a thesis associated with the student
    const thesis = await Thesis.findOne({ student: studentId })

    if (!thesis) {
      res.status(404).json({ error: "No thesis found for the given student" })
      return
    }

    const thesisId = thesis._id

    // Check if reviewer exists
    const reviewer = await Reviewer.findById(reviewerId)
    if (!reviewer) {
      console.error("Reviewer not found")
      res.status(404).json({ error: "Reviewer not found" })
      return
    }

    // Update thesis with reviewer
    await Thesis.findByIdAndUpdate(
      thesisId,
      { assignedReviewer: reviewerId },
      { new: true }, // Returns the updated document
    )

    // Add thesis to reviewer's assignedTheses
    await Reviewer.findByIdAndUpdate(
      reviewerId,
      { $push: { assignedTheses: thesisId } },
      { new: true }, // Returns the updated document
    )

    await Student.findByIdAndUpdate(
      studentId,
      { thesisStatus: "under_review", reviewer: reviewerId },
      { new: true }, // Returns the updated document
    )

    res.json({ message: "Thesis assigned successfully" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to assign thesis" })
  }
}

export const reassignThesis = async (req: Request, res: Response) => {
  try {
    const { thesisId, oldReviewerId, newReviewerId } = req.body

    // Find the thesis to check its current state
    const thesis = await Thesis.findById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: "No thesis found for updating" })
      return
    }

    // Prepare update object
    const updateObj: any = {
      assignedReviewer: newReviewerId,
    }

    // If thesis was already evaluated, reset it for re-review
    if (thesis.finalGrade) {
      updateObj.status = "under_review"
      updateObj.previousReviewedBy = thesis.reviewedBy
      updateObj.$unset = {
        finalGrade: 1,
        assessment: 1,
        reviewPdf: 1,
        signedReviewPath: 1,
        signedDate: 1,
        reviewedBy: 1,
      }
    }

    // Update thesis with new reviewer
    const updThesis = await Thesis.findByIdAndUpdate(thesisId, updateObj, { new: true })

    if (!updThesis) {
      res.status(404).json({ error: "Failed to update thesis" })
      return
    }

    // Remove thesis from old reviewer's assignedTheses and reviewedTheses
    const oldReviewer = await Reviewer.findByIdAndUpdate(
      oldReviewerId,
      {
        $pull: {
          assignedTheses: new Types.ObjectId(thesisId),
          reviewedTheses: new Types.ObjectId(thesisId), // Also remove from reviewed theses
        },
      },
      { new: true },
    )

    if (!oldReviewer) {
      res.status(404).json({ error: "Old reviewer not found" })
      return
    }

    // Add thesis to new reviewer's assignedTheses
    const newReviewer = await Reviewer.findByIdAndUpdate(
      newReviewerId,
      {
        $addToSet: { assignedTheses: new Types.ObjectId(thesisId) }, // Use $addToSet to avoid duplicates
        $pull: { reviewedTheses: new Types.ObjectId(thesisId) }, // Remove from reviewed if it was there
      },
      { new: true },
    )

    if (!newReviewer) {
      res.status(404).json({ error: "New reviewer not found" })
      return
    }

    // Prepare student update object
    const studentUpdateObj: any = {
      thesisStatus: "under_review",
      reviewer: newReviewerId,
    }

    // Remove grade if thesis was already graded
    if (thesis.finalGrade) {
      studentUpdateObj.$unset = { thesisGrade: 1 }
    }

    // Update student status
    await Student.findByIdAndUpdate(updThesis.student, studentUpdateObj, { new: true })

    res.json({ message: "Thesis reassigned successfully" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to reassign thesis" })
  }
}
