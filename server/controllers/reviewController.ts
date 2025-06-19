import type { Request, Response } from "express"
import { Thesis } from "../models/Thesis.model"
import { User, type IReviewer, Student, Reviewer } from "../models/User.model"
import { generateReviewPDF } from "../utils/pdfGenerator"
import { Types } from "mongoose"
import path from "path"

export const submitReview = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as IReviewer
    const { thesisId } = req.params
    const { grade, assessment } = req.body

    // Validate thesisId
    if (!Types.ObjectId.isValid(thesisId)) {
      res.status(400).json({ error: "Invalid thesis ID" })
      return
    }

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

    // ИСПРАВЛЕНО: Правильно перемещаем тезис из assigned в reviewed
   const reviewedThesis =  await Reviewer.findByIdAndUpdate(reviewer._id, {
      $pull: { assignedTheses: new Types.ObjectId(thesisId) },
      $push: { reviewedTheses: new Types.ObjectId(thesisId) },
    })

    if (!reviewedThesis) {
      res.status(404).json({ error: "Failed to update reviewed thesis" })
      return
    }

    // Update student's grade and thesis status
    const updatedStudent = await Student.findByIdAndUpdate(thesis.student, {
      thesisStatus: "evaluated",
      thesisGrade: grade,
    })

    if (!updatedStudent) {
      res.status(404).json({ error: "Failed to update user" })
      return
    }

    res.json({
      success: true,
      pdfUrl: `/${path.basename(pdfPath)}`,
      thesis,
    })
  } catch (error) {
    console.error("Error in submitReview:", error)
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

export const reReviewThesis = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as IReviewer
    const { thesisId } = req.params

    // Validate thesisId
    if (!Types.ObjectId.isValid(thesisId)) {
      res.status(400).json({ error: "Invalid thesis ID" })
      return
    }

    const thesisObjectId = new Types.ObjectId(thesisId)

    // Найти тезис
    const thesis = await Thesis.findById(thesisObjectId)
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Проверить, что рецензент имеет право на повторное рецензирование
    if (!reviewer.reviewedTheses.some((id) => id.equals(thesisObjectId))) {
      res.status(403).json({ error: "Access denied" })
      return
    }

    // Обновить статус тезиса обратно на "under_review"
    await Thesis.findByIdAndUpdate(thesisObjectId, {
      status: "under_review",
      $unset: { finalGrade: 1, assessment: 1, reviewPdf: 1 },
    })

    // Переместить тезис обратно из reviewed в assigned
    const reviewedThesis = await Reviewer.findByIdAndUpdate(reviewer._id, {
      $pull: { reviewedTheses: thesisObjectId },
      $push: { assignedTheses: thesisObjectId },
    })

    if (!reviewedThesis) {
      res.status(404).json({ error: "Failed to update reviewed thesis" })
      return
    }

    // Обновить статус студента
    const updatedStudent = await Student.findByIdAndUpdate(thesis.student, {
      thesisStatus: "under_review",
      $unset: { thesisGrade: 1 },
    })

    if (!updatedStudent) {
      res.status(404).json({ error: "Failed to update user" })
      return
    }

    res.json({ message: "Thesis moved back for re-review successfully" })
  } catch (error) {
    console.error("Error in reReviewThesis:", error)
    res.status(500).json({ error: "Failed to move thesis for re-review" })
  }
}
