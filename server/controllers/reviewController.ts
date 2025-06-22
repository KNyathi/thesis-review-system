import type { Request, Response } from "express"
import { Thesis } from "../models/Thesis.model"
import { type IReviewer, Student, Reviewer } from "../models/User.model"
import { generateReviewPDF } from "../utils/pdfGenerator"
import { Types, type Schema } from "mongoose"
import path from "path"
import fs from "fs"

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

    // Find the thesis first
    const thesis = await Thesis.findById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Update the thesis with the review details
    const updatedThesis = await Thesis.findByIdAndUpdate(
      thesisId,
      {
        finalGrade: grade,
        assessment: assessment,
        status: "under_review", // Keep as under_review until signed
        reviewedBy: reviewer._id, // Track who reviewed it
      },
      { new: true },
    )

    if (!updatedThesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Generate unsigned PDF
    const unsignedDir = path.join(__dirname, "../../server/reviews/unsigned")
    if (!fs.existsSync(unsignedDir)) {
      fs.mkdirSync(unsignedDir, { recursive: true })
    }

    const pdfPath = await generateReviewPDF(updatedThesis, reviewer)

    // Update thesis
    updatedThesis.reviewPdf = pdfPath
    await updatedThesis.save()

    // Update student's grade
    await Student.findByIdAndUpdate(thesis.student, {
      thesisGrade: grade,
      thesisStatus: "under_review",
    })

    // Move thesis from assigned to reviewed for reviewer tracking
    await Reviewer.findByIdAndUpdate(reviewer._id, {
      $pull: { assignedTheses: new Types.ObjectId(thesisId) },
      $push: { reviewedTheses: new Types.ObjectId(thesisId) },
    })

    // Return success with redirect flag
    res.json({
      message: "Review submitted successfully",
      redirectToSign: true,
      thesisId: thesisId,
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
      .populate("reviewedBy", "fullName email") // Populate previous reviewer info
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

    // Fetch theses reviewed by the reviewer or assigned to them for reassigned theses
    const reviews = await Thesis.find({
      $or: [
        { _id: { $in: reviewer.reviewedTheses } },
        { _id: { $in: reviewer.assignedTheses }, finalGrade: { $exists: true } },
      ],
    })
      .populate("student", "fullName email institution")
      .populate("reviewedBy", "fullName email") // Populate previous reviewer info
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

    // Find thesis
    const thesis = await Thesis.findById(thesisObjectId)
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Check reviewer access, allow if thesis is in reviewer's assignedTheses or reviewedTheses
    const hasAccess =
      reviewer.reviewedTheses.some((id) => new Types.ObjectId(id).equals(thesisObjectId)) ||
      reviewer.assignedTheses.some((id) => new Types.ObjectId(id).equals(thesisObjectId))

    if (!hasAccess) {
      res.status(403).json({ error: "Access denied" })
      return
    }

    // Delete signed review file if it exists
    const signedReviewPath = path.join(__dirname, "../../server/reviews/signed", `signed_review_${thesisId}.pdf`)
    if (fs.existsSync(signedReviewPath)) {
      fs.unlinkSync(signedReviewPath)
    }

    // Delete unsigned review file if it exists
    if (thesis.reviewPdf && fs.existsSync(thesis.reviewPdf)) {
      fs.unlinkSync(thesis.reviewPdf)
    }

    // Handle both ObjectId and populated IReviewer cases for previousReviewerId
    let previousReviewerId: Types.ObjectId | undefined
    if (thesis.reviewedBy) {
      // Convert to string first, then to ObjectId to handle both cases
      const reviewedByStr = thesis.reviewedBy.toString()
      previousReviewerId = new Types.ObjectId(reviewedByStr)
    }

    // Reset thesis to under_review and clear review data, but keep track of previous reviewer
    await Thesis.findByIdAndUpdate(thesisObjectId, {
      status: "under_review",
      previousReviewedBy: previousReviewerId, // Store previous reviewer
      $unset: { finalGrade: 1, assessment: 1, reviewPdf: 1, signedReviewPath: 1, signedDate: 1, reviewedBy: 1 },
    })

    // Ensure thesis is in current reviewer's assignedTheses
    await Reviewer.findByIdAndUpdate(reviewer._id, {
      $addToSet: { assignedTheses: thesisObjectId }, // Use $addToSet to avoid duplicates
      $pull: { reviewedTheses: thesisObjectId },
    })

    // If there was a previous reviewer, remove from their reviewedTheses
    if (previousReviewerId && !previousReviewerId.equals(new Types.ObjectId(reviewer._id))) {
      await Reviewer.findByIdAndUpdate(previousReviewerId, {
        $pull: { reviewedTheses: thesisObjectId },
      })
    }

    // Update student status
    await Student.findByIdAndUpdate(thesis.student, {
      thesisStatus: "under_review",
      $unset: { thesisGrade: 1 },
    })

    res.json({ message: "Thesis moved back for re-review successfully" })
  } catch (error) {
    console.error("Error in reReviewThesis:", error)
    res.status(500).json({ error: "Failed to move thesis for re-review" })
  }
}

export const getUnsignedReview = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as IReviewer
    const { thesisId } = req.params

    // Validate thesisId
    if (!Types.ObjectId.isValid(thesisId)) {
      res.status(400).json({ error: "Invalid thesis ID" })
      return
    }

    // Find thesis and check access
    const thesis = await Thesis.findById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Check if reviewer has access, allow if in assignedTheses or reviewedTheses
    const hasAccess =
      reviewer.reviewedTheses.some((id) => new Types.ObjectId(id).equals(new Types.ObjectId(thesisId))) ||
      reviewer.assignedTheses.some((id) => new Types.ObjectId(id).equals(new Types.ObjectId(thesisId)))

    if (!hasAccess) {
      res.status(403).json({ error: "Access denied" })
      return
    }

    if (!thesis.reviewPdf) {
      res.status(404).json({ error: "Unsigned review not found" })
      return
    }

    // Use full path from database
    const unsignedReviewPath = thesis.reviewPdf

    if (!fs.existsSync(unsignedReviewPath)) {
      res.status(404).json({ error: "Unsigned review file not found" })
      return
    }

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="unsigned_review_${thesisId}.pdf"`)

    const fileStream = fs.createReadStream(unsignedReviewPath)
    fileStream.pipe(res)

    fileStream.on("error", (error) => {
      console.error("Error streaming unsigned review:", error)
      res.status(500).json({ error: "Failed to stream unsigned review" })
    })
  } catch (error) {
    console.error("Error getting unsigned review:", error)
    res.status(500).json({ error: "Failed to get unsigned review" })
  }
}

export const uploadSignedReview = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as IReviewer
    const { thesisId } = req.params
    const { file } = req

    console.log("Uploading signed review via Chrome native tools:", { thesisId, hasFile: !!file })

    // Validate thesisId
    if (!Types.ObjectId.isValid(thesisId)) {
      res.status(400).json({ error: "Invalid thesis ID" })
      return
    }

    // Find thesis and check access
    const thesis = await Thesis.findById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    const hasAccess =
      reviewer.reviewedTheses.some((id) => new Types.ObjectId(id).equals(new Types.ObjectId(thesisId))) ||
      reviewer.assignedTheses.some((id) => new Types.ObjectId(id).equals(new Types.ObjectId(thesisId)))

    if (!hasAccess) {
      res.status(403).json({ error: "Access denied" })
      return
    }

    if (!file) {
      res.status(400).json({ error: "Signed PDF file is required" })
      return
    }

    // Ensure signed reviews directory exists
    const signedDir = path.join(__dirname, "../../server/reviews/signed")
    if (!fs.existsSync(signedDir)) {
      fs.mkdirSync(signedDir, { recursive: true })
    }

    // Move uploaded file to signed reviews directory
    const signedReviewPath = path.join(signedDir, `signed_review_${thesisId}.pdf`)
    fs.renameSync(file.path, signedReviewPath)

    console.log(`Chrome-signed review saved to: ${signedReviewPath}`)

    // Update thesis with signed PDF path and status
    await Thesis.findByIdAndUpdate(thesisId, {
      status: "evaluated",
      signedReviewPath: signedReviewPath,
      reviewPdf: signedReviewPath,
      signedDate: new Date(),
      reviewedBy: reviewer._id, // Ensure current reviewer is marked as the one who signed
    })

    // Update student status to evaluated
    await Student.findByIdAndUpdate(thesis.student, {
      thesisStatus: "evaluated",
    })

    res.json({
      message: "Signed review uploaded successfully using Chrome's native tools",
      success: true,
    })
  } catch (error) {
    console.error("Error uploading Chrome-signed review:", error)
    res.status(500).json({ error: "Failed to upload signed review" })
  }
}

export const getSignedReview = async (req: Request, res: Response) => {
  try {
    const user = req.user as any
    const { thesisId } = req.params

    // Validate thesisId
    if (!Types.ObjectId.isValid(thesisId)) {
      res.status(400).json({ error: "Invalid thesis ID" })
      return
    }

    // Find thesis and populate student properly
    const thesis = await Thesis.findById(thesisId).populate("student").lean()
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Check access permissions
    const studentId =
      typeof thesis.student === "object" && thesis.student !== null && "_id" in thesis.student
        ? (thesis.student as any)._id.toString()
        : (thesis.student as Schema.Types.ObjectId).toString()

    const isStudent = user.role === "student" && studentId === user._id.toString()
    const isReviewer =
      user.role === "reviewer" &&
      (user.reviewedTheses.some((id: any) => new Types.ObjectId(id).equals(new Types.ObjectId(thesisId))) ||
        user.assignedTheses.some((id: any) => new Types.ObjectId(id).equals(new Types.ObjectId(thesisId))))
    const isAdmin = user.role === "admin"

    if (!isStudent && !isReviewer && !isAdmin) {
      res.status(403).json({ error: "Access denied" })
      return
    }

    // Try to find signed review file using full path from database
    let signedReviewPath: string

    if (thesis.signedReviewPath && fs.existsSync(thesis.signedReviewPath)) {
      signedReviewPath = thesis.signedReviewPath
    } else {
      signedReviewPath = path.join(__dirname, "../../server/reviews/signed", `signed_review_${thesisId}.pdf`)
    }

    if (!fs.existsSync(signedReviewPath)) {
      res.status(404).json({ error: "Signed review not found" })
      return
    }

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="signed_review_${thesisId}.pdf"`)

    const fileStream = fs.createReadStream(signedReviewPath)
    fileStream.pipe(res)

    fileStream.on("error", (error) => {
      console.error("Error streaming signed review:", error)
      res.status(500).json({ error: "Failed to stream signed review" })
    })
  } catch (error) {
    console.error("Error getting signed review:", error)
    res.status(500).json({ error: "Failed to get signed review" })
  }
}

export const downloadSignedReview = async (req: Request, res: Response) => {
  try {
    const user = req.user as any
    const { thesisId } = req.params

    // Validate thesisId
    if (!Types.ObjectId.isValid(thesisId)) {
      res.status(400).json({ error: "Invalid thesis ID" })
      return
    }

    // Find thesis and populate student properly
    const thesis = await Thesis.findById(thesisId).populate("student").lean()
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Check access permissions
    const studentId =
      typeof thesis.student === "object" && thesis.student !== null && "_id" in thesis.student
        ? (thesis.student as any)._id.toString()
        : (thesis.student as Schema.Types.ObjectId).toString()

    const isStudent = user.role === "student" && studentId === user._id.toString()
    const isReviewer =
      user.role === "reviewer" &&
      (user.reviewedTheses.some((id: any) => new Types.ObjectId(id).equals(new Types.ObjectId(thesisId))) ||
        user.assignedTheses.some((id: any) => new Types.ObjectId(id).equals(new Types.ObjectId(thesisId))))
    const isAdmin = user.role === "admin"

    if (!isStudent && !isReviewer && !isAdmin) {
      res.status(403).json({ error: "Access denied" })
      return
    }

    let signedReviewPath: string

    if (thesis.signedReviewPath && fs.existsSync(thesis.signedReviewPath)) {
      signedReviewPath = thesis.signedReviewPath
    } else {
      signedReviewPath = path.join(__dirname, "../../server/reviews/signed", `signed_review_${thesisId}.pdf`)
    }

    if (!fs.existsSync(signedReviewPath)) {
      res.status(404).json({ error: "Signed review not found" })
      return
    }

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="signed_review_${thesisId}.pdf"`)

    const fileStream = fs.createReadStream(signedReviewPath)
    fileStream.pipe(res)

    fileStream.on("error", (error) => {
      console.error("Error downloading signed review:", error)
      res.status(500).json({ error: "Failed to download signed review" })
    })
  } catch (error) {
    console.error("Error downloading signed review:", error)
    res.status(500).json({ error: "Failed to download signed review" })
  }
}

export const signedReview = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as IReviewer
    const { thesisId } = req.params
    const { file } = req

    if (!file) {
      res.status(400).json({ error: "File not available" })
      return
    }

    // Validate thesisId
    if (!Types.ObjectId.isValid(thesisId)) {
      res.status(400).json({ error: "Invalid thesis ID" })
      return
    }

    // Update the thesis status to evaluated
    const thesis = await Thesis.findByIdAndUpdate(
      thesisId,
      {
        status: "evaluated",
        reviewedBy: reviewer._id,
      },
      { new: true },
    )

    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Move signed PDF to permanent storage
    const signedPath = path.join(__dirname, "../../server/reviews/signed", `signed_review_${thesisId}.pdf`)
    fs.renameSync(file.path, signedPath)

    // Update student's status
    await Student.findByIdAndUpdate(thesis.student, {
      thesisStatus: "evaluated",
    })

    res.json({ success: true })
  } catch (error) {
    console.error("Error finalizing review:", error)
    res.status(500).json({ error: "Failed to finalize review" })
  }
}
