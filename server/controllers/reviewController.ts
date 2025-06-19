import type { Request, Response } from "express"
import { Thesis } from "../models/Thesis.model"
import { User, type IReviewer } from "../models/User.model"
import { generateReviewPDF } from "../utils/pdfGenerator"
import path from "path"

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

    // Generate PDF
    const pdfPath = await generateReviewPDF(thesis, reviewer)

    // Update thesis with PDF path
    thesis.reviewPdf = pdfPath
    await thesis.save()

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

    res.json({
      success: true,
      pdfUrl: `/${path.basename(pdfPath)}`,
      thesis,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to submit review" })
  }
}

export const getAssignedTheses = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as IReviewer

    // Fetch theses assigned to the reviewer with better error handling
    const theses = await Thesis.find({ _id: { $in: reviewer.assignedTheses } })
      .populate({
        path: "student",
        select: "fullName email institution",
        match: { _id: { $exists: true } }, // Only include existing students
      })
      .lean()

    // Filter out theses where student population failed (deleted students)
    const validTheses = theses.filter((thesis) => thesis.student !== null)

    // If some theses had deleted students, clean up the reviewer's assignedTheses
    if (validTheses.length !== theses.length) {
      const validThesisIds = validTheses.map((t) => t._id)
      await User.findByIdAndUpdate(reviewer._id, {
        assignedTheses: validThesisIds,
      })
    }

    res.json(validTheses)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to fetch assigned theses" })
  }
}

export const getCompletedReviews = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as IReviewer

    // Fetch theses reviewed by the reviewer with better error handling
    const reviews = await Thesis.find({ _id: { $in: reviewer.reviewedTheses } })
      .populate({
        path: "student",
        select: "fullName email institution",
        match: { _id: { $exists: true } }, // Only include existing students
      })
      .lean()

    // Filter out reviews where student population failed (deleted students)
    const validReviews = reviews.filter((review) => review.student !== null)

    // If some reviews had deleted students, clean up the reviewer's reviewedTheses
    if (validReviews.length !== reviews.length) {
      const validReviewIds = validReviews.map((r) => r._id)
      await User.findByIdAndUpdate(reviewer._id, {
        reviewedTheses: validReviewIds,
      })
    }

    res.json(validReviews)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to fetch completed reviews" })
  }
}
