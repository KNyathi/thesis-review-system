import type { Request, Response } from "express"
import { ThesisModel } from "../models/Thesis.model"
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer } from "../models/User.model"
import fs from "fs"
import path from "path"
import { Pool } from 'pg';

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

// Submit thesis topic
export const submitTopic = async (req: Request, res: Response) => {
  try {
    // Check if user is attached to the request and has the necessary properties
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" })
      return
    }

    const studentId = (req.user as AuthenticatedUser).id
    const { thesisTopic } = req.body

    // Validate request body
    if (!thesisTopic || typeof thesisTopic !== 'string' || thesisTopic.trim() === '') {
      res.status(400).json({ error: "Thesis topic is required and must be a non-empty string" })
      return
    }

    // Fetch the full student document from the database
    const student = await userModel.getUserById(studentId)
    if (!student || student.role !== 'student') {
      res.status(404).json({ error: "Student not found" })
      return
    }

    // Update the student's thesis topic - isTopicApproved remains false by default
    const updatedStudent = await userModel.updateUser(studentId, {
      thesisTopic: thesisTopic.trim()
    } as Partial<Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>>)

    //NOTIFY SUPERVISOR THAT TOPIC HAS BEEN SENT (TO BE DONE)
    res.status(200).json({
      message: "Thesis topic submitted successfully",
      student: {
        id: updatedStudent.id,
        thesisTopic: (updatedStudent as IStudent).thesisTopic,
        isTopicApproved: (updatedStudent as IStudent).isTopicApproved
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Thesis topic submission failed" })
  }
}

// Submit Thesis with File Upload
export const submitThesis = async (req: Request, res: Response) => {
  try {
    // Check if user is attached to the request and has the necessary properties
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" })
      return
    }

    const studentId = (req.user as AuthenticatedUser).id

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" })
      return
    }

    // Fetch the full student document from the database
    const student = await userModel.getUserById(studentId)
    if (!student || student.role !== 'student') {
      res.status(404).json({ error: "Student not found" })
      return
    }

    const studentData = student as IStudent

    // Check for existing thesis and delete if exists
    const existingTheses = await thesisModel.getThesesByStudent(studentId)
    for (const existingThesis of existingTheses) {
      // Remove the thesis from the reviewer's assignedTheses if it was assigned
      if (existingThesis.data.assignedReviewer) {
        const reviewer = await userModel.getUserById(existingThesis.data.assignedReviewer)
        if (reviewer && reviewer.role === 'reviewer') {
          await userModel.removeThesisFromReviewer(reviewer.id, existingThesis.id)
        }
      }
      // Delete the thesis
      await thesisModel.deleteThesis(existingThesis.id)
    }

    // Create new thesis
    const thesisData = {
      title: req.body.title,
      student: studentId,
      fileUrl: `/uploads/theses/${req.file.filename}`,
      submissionDate: new Date(),
      status: "submitted" as const,
      assignedReviewer: '',
      assignedSupervisor: '',
      assignedConsultant: '',
      finalGrade: undefined,
      assessment: undefined,
      reviewIterations: [], // Initialize empty array for review iterations
      currentIteration: 0,  // Start at iteration 0 (no reviews yet)
      totalReviewCount: 0,  // No reviews yet
      reviewPdf: undefined,
      signedReviewPath: undefined,
      signedDate: undefined
    }

    // Add team assignments if they exist
    if (studentData.supervisor) {
      thesisData.assignedSupervisor = studentData.supervisor;
    }
    if (studentData.consultant) {
      thesisData.assignedConsultant = studentData.consultant;
    }
    if (studentData.reviewer) {
      thesisData.assignedReviewer = studentData.reviewer;
    }
    
    const thesis = await thesisModel.createThesis(thesisData)

    // Update student's thesis status and info
    await userModel.updateStudentThesisStatus(studentId, "submitted")
    await userModel.updateStudentThesisInfo(studentId, {
      thesisFile: thesis.data.fileUrl,
      thesisTopic: thesis.data.title,
    })

    res.status(201).json({
      ...thesis.data,
      id: thesis.id,
      createdAt: thesis.created_at,
      updatedAt: thesis.updated_at
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Thesis submission failed" })
  }
}

/**
 * Get the current student's thesis with status and reviewer info
 */
export const getStudentThesis = async (req: Request, res: Response) => {
  try {
    const student = req.user as AuthenticatedUser & IStudent

    const theses = await thesisModel.getThesesByStudent(student.id)
    const thesis = theses[0] // Assuming one thesis per student for now

    if (!thesis) {
      res.status(404).json({
        message: "Thesis not submitted yet",
        status: "not_submitted",
      })
      return
    }

    // Get reviewer info if assigned
    let reviewerInfo = null
    if (thesis.data.assignedReviewer) {
      const reviewer = await userModel.getUserById(thesis.data.assignedReviewer)
      if (reviewer) {
        reviewerInfo = {
          id: reviewer.id,
          fullName: reviewer.fullName,
          email: reviewer.email,
          institution: reviewer.institution
        }
      }
    }

    res.json({
      ...thesis.data,
      id: thesis.id,
      createdAt: thesis.created_at,
      updatedAt: thesis.updated_at,
      reviewer: reviewerInfo,
      status: student.thesisStatus || "submitted",
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error fetching thesis" })
  }
}

// Download Thesis
export const downloadThesis = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const user = req.user as AuthenticatedUser

    if (!user) {
      res.status(401).json({ error: "User not authenticated" })
      return
    }

    const thesis = await thesisModel.getThesisById(id)
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Verify permissions
    const isAllowed =
      user.role === "admin" ||
      (user.role === "reviewer" && thesis.data.assignedReviewer === user.id) ||
      (user.role === "student" && thesis.data.student === user.id)

    if (!isAllowed) {
      res.status(403).json({ error: "Access denied" })
      return
    }

    const filePath = path.join(__dirname, "../../server/uploads/theses", path.basename(thesis.data.fileUrl))

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" })
      return
    }

    // Set headers to indicate a file download
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${thesis.data.title}.pdf"`)

    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)

    fileStream.on("error", (error) => {
      console.error("Error streaming file:", error)
      res.status(500).json({ error: "Download failed" })
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Download failed" })
  }
}

export const viewThesis = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const user = req.user as AuthenticatedUser

    if (!user) {
      res.status(401).json({ error: "User not authenticated" })
      return
    }

    const thesis = await thesisModel.getThesisById(id)
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Allow students to view their own thesis, reviewers to view assigned thesis, and admins to view all
    const isAllowed =
      user.role === "admin" ||
      (user.role === "student" && thesis.data.student === user.id) ||
      (user.role === "reviewer" && thesis.data.assignedReviewer === user.id)

    if (!isAllowed) {
      res.status(403).json({ error: "Access denied" })
      return
    }

    const filePath = path.join(__dirname, "../../server/uploads/theses", path.basename(thesis.data.fileUrl))

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" })
      return
    }

    // Set headers to indicate a file download
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="${thesis.data.title}.pdf"`)

    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)

    fileStream.on("error", (error) => {
      console.error("Error streaming file:", error)
      res.status(500).json({ error: "View failed" })
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "View failed" })
  }
}

// Download Signed Review
export const downloadSignedReview = async (req: Request, res: Response) => {
  try {
    const { thesisId } = req.params
    const user = req.user as AuthenticatedUser

    if (!user) {
      res.status(401).json({ error: "User not authenticated" })
      return
    }

    const thesis = await thesisModel.getThesisById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Check if review exists and is signed
    if (thesis.data.status !== "evaluated" || !thesis.data.reviewPdf) {
      res.status(404).json({ error: "Signed review not available" });
      return
    }

    // Check permissions - student can only download their own signed review
    const isAllowed =
      user.role === "admin" ||
      (user.role === "student" && thesis.data.student === user.id) ||
      (user.role === "reviewer" && thesis.data.assignedReviewer === user.id)

    if (!isAllowed) {
      res.status(403).json({ error: "Access denied" })
      return
    }

    let filePath: string

    // Try to use the signed review path first, fall back to review PDF path
    if (thesis.data.signedReviewPath && fs.existsSync(thesis.data.signedReviewPath)) {
      filePath = thesis.data.signedReviewPath
    } else if (thesis.data.reviewPdf && fs.existsSync(thesis.data.reviewPdf)) {
      filePath = thesis.data.reviewPdf
    } else {
      // Fallback to default path
      filePath = path.join(__dirname, "../../server/reviews/signed", `signed_review_${thesisId}.pdf`)
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" })
      return
    }

    // Set headers to indicate a file download
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${thesis.data.title}_signed_review.pdf"`)

    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)

    fileStream.on("error", (error) => {
      console.error("Error streaming file:", error)
      res.status(500).json({ error: "Download failed" })
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Download failed" })
  }
}

// Get student's thesis status and grade
export const getThesisStatus = async (req: Request, res: Response) => {
  try {
    const student = req.user as AuthenticatedUser & IStudent

    const theses = await thesisModel.getThesesByStudent(student.id)
    const thesis = theses[0] // Assuming one thesis per student

    const response = {
      thesisStatus: student.thesisStatus || "not_submitted",
      thesisGrade: student.thesisGrade || null,
      thesisTopic: student.thesisTopic || null,
      hasThesis: !!thesis,
      thesis: thesis ? {
        id: thesis.id,
        title: thesis.data.title,
        submissionDate: thesis.data.submissionDate,
        status: thesis.data.status,
        assignedReviewer: thesis.data.assignedReviewer,
      } : null
    }

    res.json(response)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to get thesis status" })
  }
}

// Delete student's thesis
export const deleteThesis = async (req: Request, res: Response) => {
  try {
    const student = req.user as AuthenticatedUser & IStudent

    const theses = await thesisModel.getThesesByStudent(student.id)

    for (const thesis of theses) {
      // Remove from reviewer's assigned theses if assigned
      if (thesis.data.assignedReviewer) {
        const reviewer = await userModel.getUserById(thesis.data.assignedReviewer)
        if (reviewer && reviewer.role === 'reviewer') {
          await userModel.removeThesisFromReviewer(reviewer.id, thesis.id)
        }
      }

      // Delete the thesis file
      const filePath = path.join(__dirname, "../../server/uploads/theses", path.basename(thesis.data.fileUrl))
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }

      // Delete the thesis record
      await thesisModel.deleteThesis(thesis.id)
    }

    // Reset student's thesis info using separate methods
    await userModel.updateStudentThesisStatus(student.id, "not_submitted")
    await userModel.updateStudentThesisInfo(student.id, {
      thesisFile: undefined,
      thesisTopic: undefined,
      thesisGrade: undefined,
    })

    res.json({ message: "Thesis deleted successfully" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to delete thesis" })
  }
}

// Update student's thesis topic
export const updateThesisTopic = async (req: Request, res: Response) => {
  try {
    const student = req.user as AuthenticatedUser & IStudent
    const { thesisTopic } = req.body

    if (!thesisTopic) {
      res.status(400).json({ error: "Thesis topic is required" })
      return
    }

    await userModel.updateStudentThesisInfo(student.id, {
      thesisTopic: thesisTopic,
    })

    res.json({ message: "Thesis topic updated successfully" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to update thesis topic" })
  }
}