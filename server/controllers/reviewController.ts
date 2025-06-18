import type { Request, Response } from "express"
import { Thesis } from "../models/Thesis.model"
import { User, type IReviewer } from "../models/User.model"

export const submitReview = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as IReviewer
    const { thesisId } = req.params
    const { grade, assessment } = req.body

    // Update the thesis with the review details
    const thesis = await Thesis.findByIdAndUpdate(
      thesisId,
      {
        status: "evaluated",
        finalGrade: grade,
        assessment: assessment,
      },
      { new: true },
    )

    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Move thesis from assigned to reviewed
    await User.findByIdAndUpdate(reviewer._id, {
      $pull: { assignedTheses: thesisId },
      $push: { reviewedTheses: thesisId },
    })

    // Update student's grade and thesis status
    await User.findByIdAndUpdate(thesis.student, {
      thesisStatus: "evaluated",
      thesisGrade: grade,
    })

    res.json(thesis)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to submit review" })
  }
}

export const getAssignedTheses = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as IReviewer

    // Fetch theses assigned to the reviewer
    const theses = await Thesis.find({ _id: { $in: reviewer.assignedTheses } })
      .populate("student", "fullName email institution")
      .lean()

    res.json(theses)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to fetch assigned theses" })
  }
}

export const getCompletedReviews = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as IReviewer

    // Fetch theses reviewed by the reviewer
    const reviews = await Thesis.find({ _id: { $in: reviewer.reviewedTheses } })
      .populate("student", "fullName email institution")
      .lean()

    res.json(reviews)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to fetch completed reviews" })
  }
}
