import type { Request, Response } from "express"
import { ThesisModel } from "../models/Thesis.model"
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer, ISupervisor, IConsultant, IHeadOfDepartment, IDean } from "../models/User.model"
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

    const studentData = student as IStudent

    // Check if there's a pending supervisor proposal waiting for student response
    if (studentData.topicProposedBy === 'supervisor' &&
      studentData.studentTopicResponse?.status === 'pending') {
      res.status(400).json({
        error: "You have a pending topic proposal from your supervisor. Please respond to it first before submitting your own topic."
      })
      return
    }

    // Check if topic is already approved
    if (studentData.isTopicApproved) {
      res.status(400).json({
        error: "Thesis topic is already approved. You cannot submit a new topic."
      })
      return
    }

    // Check if student already submitted a topic that's pending approval
    if (studentData.thesisTopic && studentData.thesisTopic.trim() !== '' &&
      studentData.topicProposedBy === 'student' &&
      !studentData.isTopicApproved) {
      res.status(400).json({
        error: "You already have a submitted topic waiting for supervisor approval."
      })
      return
    }


    // Update the student's thesis topic - isTopicApproved remains false by default
    const updatedStudent = await userModel.updateUser(studentId, {
      thesisTopic: thesisTopic.trim(),
      topicProposedBy: 'student',
      topicSubmittedAt: new Date(),
      topicRejectionComments: null,
      studentTopicResponse: null

    } as Partial<Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>>)

    //NOTIFY SUPERVISOR THAT TOPIC HAS BEEN SENT (TO BE DONE)
    res.status(200).json({
      message: "Thesis topic submitted successfully",
      student: {
        id: updatedStudent.id,
        thesisTopic: (updatedStudent as IStudent).thesisTopic,
        isTopicApproved: (updatedStudent as IStudent).isTopicApproved,
        topicProposedBy: (updatedStudent as IStudent).topicProposedBy,
        topicSubmittedAt: (updatedStudent as IStudent).topicSubmittedAt
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

    // Check for existing thesis to determine if this is a resubmission
    const existingTheses = await thesisModel.getThesesByStudent(studentId)
    const isResubmission = existingTheses.length > 0

    let currentIteration = 1; // Default for first submission

    if (isResubmission) {
      // This is a resubmission - increment iteration
      const existingThesis = existingTheses[0]
      currentIteration = existingThesis.data.currentIteration + 1

      // Remove the thesis from the reviewer's assignedTheses if it was assigned
      if (existingThesis.data.assignedReviewer) {
        const reviewer = await userModel.getUserById(existingThesis.data.assignedReviewer)
        if (reviewer && reviewer.role === 'reviewer') {
          await userModel.removeThesisFromReviewer(reviewer.id, existingThesis.id)
        }
      }
      // Delete the old thesis
      await thesisModel.deleteThesis(existingThesis.id)
    }

    // Create new thesis (or replacement thesis for resubmission)
    const thesisData = {
      title: req.body.title,
      student: studentId,
      fileUrl: `/uploads/theses/${req.file.filename}`,
      submissionDate: new Date(),
      status: "submitted" as const,
      plagiarismCheck: {
        isChecked: false,
        attempts: 0,
        maxAttempts: 2, 
        isApproved: false
      },
      assignedReviewer: '',
      assignedSupervisor: '',
      assignedConsultant: '',
      finalGrade: undefined,
      assessment: undefined,
      reviewIterations: [], // Start with empty review iterations for new submission
      currentIteration: currentIteration, // Use calculated iteration
      totalReviewCount: 0,  // Reset review count for new submission
      reviewPdfReviewer: undefined,
      reviewerSignedReviewPath: undefined,
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

    const studentUpdateData: any = {
      thesisFile: thesis.data.fileUrl,
      thesisTopic: thesis.data.title,
      currentReviewIteration: currentIteration, // Update student's iteration
    }

    // Only increment totalReviewAttempts for student if this is first submission
    if (!isResubmission) {
      studentUpdateData.totalReviewAttempts = 0 // Initialize for first submission
    }

    await userModel.updateStudentThesisInfo(studentId, studentUpdateData)

    res.status(201).json({
      ...thesis.data,
      id: thesis.id,
      createdAt: thesis.created_at,
      updatedAt: thesis.updated_at,
      isResubmission: isResubmission, // Let frontend know if this was a resubmission
      iteration: currentIteration
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Thesis submission failed" })
  }
}


export const getStudentThesis = async (req: Request, res: Response) => {
  try {
    const student = req.user as AuthenticatedUser & IStudent;

    const theses = await thesisModel.getThesesByStudent(student.id);
    const thesis = theses[0]; // One thesis per student

    if (!thesis) {
      res.status(404).json({
        message: "Thesis not submitted yet",
        status: "not_submitted",
      });
      return;
    }

    // Get reviewer info if assigned
    let reviewerInfo = null;
    if (thesis.data.assignedReviewer) {
      const reviewer = await userModel.getUserById(thesis.data.assignedReviewer);
      if (reviewer) {
        reviewerInfo = {
          id: reviewer.id,
          fullName: reviewer.fullName,
          email: reviewer.email,
          institution: reviewer.institution,
          position: (reviewer as IReviewer).position
        };
      }
    }

    // Get supervisor info if assigned
    let supervisorInfo = null;
    if (thesis.data.assignedSupervisor) {
      const supervisor = await userModel.getUserById(thesis.data.assignedSupervisor);
      if (supervisor) {
        supervisorInfo = {
          id: supervisor.id,
          fullName: supervisor.fullName,
          email: supervisor.email,
          institution: supervisor.institution,
          position: (supervisor as ISupervisor).position,
          department: (supervisor as ISupervisor).department
        };
      }
    }

    // Get consultant info if assigned
    let consultantInfo = null;
    if (thesis.data.assignedConsultant) {
      const consultant = await userModel.getUserById(thesis.data.assignedConsultant);
      if (consultant) {
        consultantInfo = {
          id: consultant.id,
          fullName: consultant.fullName,
          email: consultant.email,
          institution: consultant.institution,
          position: (consultant as IConsultant).position
        };
      }
    }

    // Get current review iteration details
    const currentIteration = thesis.data.reviewIterations?.[thesis.data.currentIteration - 1];
    let currentConsultantReview = null;
    let currentSupervisorReview = null;

    if (currentIteration) {
      if (currentIteration.consultantReview) {
        currentConsultantReview = {
          comments: currentIteration.consultantReview.comments,
          status: currentIteration.consultantReview.status,
          submittedDate: currentIteration.consultantReview.submittedDate,
          iteration: currentIteration.consultantReview.iteration
        };
      }

      if (currentIteration.supervisorReview) {
        currentSupervisorReview = {
          comments: currentIteration.supervisorReview.comments,
          status: currentIteration.supervisorReview.status,
          submittedDate: currentIteration.supervisorReview.submittedDate,
          iteration: currentIteration.supervisorReview.iteration,
          signedDate: currentIteration.supervisorReview.signedDate
        };
      }
    }

    // Get all review iterations for history
    const reviewHistory = thesis.data.reviewIterations?.map(iteration => ({
      iteration: iteration.iteration,
      consultantReview: iteration.consultantReview ? {
        comments: iteration.consultantReview.comments,
        status: iteration.consultantReview.status,
        submittedDate: iteration.consultantReview.submittedDate
      } : null,
      supervisorReview: iteration.supervisorReview ? {
        comments: iteration.supervisorReview.comments,
        status: iteration.supervisorReview.status,
        submittedDate: iteration.supervisorReview.submittedDate,
        signedDate: iteration.supervisorReview.signedDate
      } : null,
      studentResubmissionDate: iteration.studentResubmissionDate,
      status: iteration.status
    })) || [];

    res.json({
      ...thesis.data,
      id: thesis.id,
      createdAt: thesis.created_at,
      updatedAt: thesis.updated_at,
      reviewer: reviewerInfo,
      supervisor: supervisorInfo,
      consultant: consultantInfo,
      currentIteration: {
        number: thesis.data.currentIteration,
        consultantReview: currentConsultantReview,
        supervisorReview: currentSupervisorReview,
        status: currentIteration?.status || 'under_review'
      },
      reviewHistory,
      studentStatus: student.thesisStatus || "submitted",
      // Include student's topic approval status
      isTopicApproved: student.isTopicApproved,
      topicRejectionComments: student.topicRejectionComments
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error fetching thesis" });
  }
};

// Download Thesis
export const downloadThesis = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as AuthenticatedUser;

    if (!user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const thesis = await thesisModel.getThesisById(id);
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" });
      return;
    }

    // Get the student to verify assignments
    const student = await userModel.getUserById(thesis.data.student);
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    // Enhanced permission checking
    let isAllowed = false;

    switch (user.role) {
      case "admin":
        // Admin can access everything
        isAllowed = true;
        break;

      case "student":
        // Student can only access their own thesis
        isAllowed = thesis.data.student === user.id;
        break;

      case "reviewer":
        // Reviewer must be assigned to this specific thesis
        isAllowed = thesis.data.assignedReviewer === user.id;
        break;

      case "supervisor":
        // Supervisor must be assigned to this student
        const studentAsIStudent = student as IStudent;
        isAllowed = studentAsIStudent.supervisor === user.id;
        break;

      case "consultant":
        // Consultant must be assigned to this student
        const studentAsIStudentForConsultant = student as IStudent;
        isAllowed = studentAsIStudentForConsultant.consultant === user.id;
        break;

      case "head_of_department":
        // Head of Department must be in the same faculty as the student
        const studentAsIStudentForHOD = student as IStudent;
        const hod = user as IHeadOfDepartment;
        isAllowed = studentAsIStudentForHOD.faculty === hod.faculty;
        break;

      case "dean":
        // Dean must be in the same faculty as the student
        const studentAsIStudentForDean = student as IStudent;
        const dean = user as IDean;
        isAllowed = studentAsIStudentForDean.faculty === dean.faculty;
        break;

      default:
        isAllowed = false;
    }

    if (!isAllowed) {
      res.status(403).json({
        error: "Access denied",
        message: "You are not authorized to access this thesis"
      });
      return;
    }

    const filePath = path.join(__dirname, "../../server/uploads/theses", path.basename(thesis.data.fileUrl))

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" })
      return
    }

    // Set headers to indicate a file download
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="thesis_${thesis.data.student}.pdf"`)

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


    // Get the student to verify assignments
    const student = await userModel.getUserById(thesis.data.student);
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    // Enhanced permission checking
    let isAllowed = false;

    switch (user.role) {
      case "admin":
        // Admin can access everything
        isAllowed = true;
        break;

      case "student":
        // Student can only access their own thesis
        isAllowed = thesis.data.student === user.id;
        break;

      case "reviewer":
        // Reviewer must be assigned to this specific thesis
        isAllowed = thesis.data.assignedReviewer === user.id;
        break;

      case "supervisor":
        // Supervisor must be assigned to this student
        const studentAsIStudent = student as IStudent;
        isAllowed = studentAsIStudent.supervisor === user.id;
        break;

      case "consultant":
        // Consultant must be assigned to this student
        const studentAsIStudentForConsultant = student as IStudent;
        isAllowed = studentAsIStudentForConsultant.consultant === user.id;
        break;

      case "head_of_department":
        // Head of Department must be in the same faculty as the student
        const studentAsIStudentForHOD = student as IStudent;
        const hod = user as IHeadOfDepartment;
        isAllowed = studentAsIStudentForHOD.faculty === hod.faculty;
        break;

      case "dean":
        // Dean must be in the same faculty as the student
        const studentAsIStudentForDean = student as IStudent;
        const dean = user as IDean;
        isAllowed = studentAsIStudentForDean.faculty === dean.faculty;
        break;

      default:
        isAllowed = false;
    }

    if (!isAllowed) {
      res.status(403).json({
        error: "Access denied",
        message: "You are not authorized to access this thesis"
      });
      return;
    }


    const filePath = path.join(__dirname, "../../server/uploads/theses", path.basename(thesis.data.fileUrl))

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" })
      return
    }

    // Set headers to indicate a file download
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="thesis_${thesis.data.student}.pdf"`)

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
    const student = req.user as AuthenticatedUser & IStudent;

    const theses = await thesisModel.getThesesByStudent(student.id);

    for (const thesis of theses) {
      // Remove from reviewer's assigned theses if assigned
      if (thesis.data.assignedReviewer) {
        const reviewer = await userModel.getUserById(thesis.data.assignedReviewer);
        if (reviewer && reviewer.role === 'reviewer') {
          await userModel.removeThesisFromReviewer(reviewer.id, thesis.id);
        }
      }

      // Remove from consultant's assigned theses if assigned
      if (thesis.data.assignedConsultant) {
        const consultant = await userModel.getUserById(thesis.data.assignedConsultant);
        if (consultant && consultant.role === 'consultant') {
          // Remove from assignedTheses array
          await userModel.removeThesisFromConsultant(consultant.id, thesis.id);
          // Remove from assignedStudents array
          await userModel.removeStudentFromConsultant(consultant.id, student.id);
        }
      }

      // Remove from supervisor's assigned theses if assigned
      if (thesis.data.assignedSupervisor) {
        const supervisor = await userModel.getUserById(thesis.data.assignedSupervisor);
        if (supervisor && supervisor.role === 'supervisor') {
          // Remove from assignedTheses array
          await userModel.removeThesisFromSupervisor(supervisor.id, thesis.id);
          // Remove from assignedStudents array
          await userModel.removeStudentFromSupervisor(supervisor.id, student.id);
        }
      }

      // Delete the thesis file
      const filePath = path.join(__dirname, "../../server/uploads/theses", path.basename(thesis.data.fileUrl));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete the thesis record
      await thesisModel.deleteThesis(thesis.id);
    }

    // Reset student's thesis info using separate methods
    await userModel.updateStudentThesisStatus(student.id, "not_submitted");
    await userModel.updateStudentThesisInfo(student.id, {
      thesisFile: undefined,
      thesisTopic: undefined,
      thesisGrade: undefined,
    });


    res.json({ message: "Thesis deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete thesis" });
  }
};

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