import type { Request, Response } from "express"
import { ThesisModel } from "../models/Thesis.model"
import { UserModel, Reviewer, IUser, IReviewer, IStudent } from "../models/User.model"
import path from "path"
import fs from "fs"
import { Pool } from 'pg';
import { plagiarismService } from "../utils/plagiarismService"

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

export const checkPlagiarismSupervisor = async (req: Request, res: Response) => {
  try {
    const studentId = (req.user as AuthenticatedUser).id;
    const { thesisId } = req.params;

    // Get student and thesis
    const student = await userModel.getUserById(studentId);
    if (!student || student.role !== 'student') {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const thesis = await thesisModel.getThesisById(thesisId);

    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" });
      return;
    }

    // Check if student owns this thesis
    if (thesis.data.student !== studentId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Check if maximum attempts reached
    if (thesis.data.plagiarismCheck.attempts >= thesis.data.plagiarismCheck.maxAttempts) {
      res.status(400).json({
        error: "Maximum plagiarism check attempts reached",
        attempts: thesis.data.plagiarismCheck.attempts,
        maxAttempts: thesis.data.plagiarismCheck.maxAttempts
      });
      return;
    }

    // Check if file exists
    if (!thesis.data.fileUrl) {
      res.status(400).json({ error: "Thesis file not found here" });
      return;
    }


    const filePath = path.join(__dirname, "../../server/uploads/theses", path.basename(thesis.data.fileUrl))

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" })
      return
    }


    // File found, proceed with plagiarism check
    const fileName = path.basename(filePath);
    const result = await plagiarismService.checkDocument(filePath, fileName, thesisId, student);

    if (!result.success) {
      res.status(400).json({
        error: result.error || "Plagiarism check failed",
        attempt: (thesis.data.plagiarismCheck?.attempts || 0) + 1
      });
      return;
    }

    // Update thesis with plagiarism check results
    const updatedThesis = await thesisModel.updateThesis(thesisId, {
      plagiarismCheck: {
        isChecked: true,
        checkedFileUrl: result.checkedFileUrl,
        attempts: thesis.data.plagiarismCheck.attempts + 1,
        maxAttempts: thesis.data.plagiarismCheck.maxAttempts,
        lastCheckDate: new Date(),
        similarityScore: result.similarityScore,
        reportUrl: result.reportUrl,
        isApproved: result.similarityScore <= 15 // Example threshold: 15%
      }
    });

    res.status(200).json({
      message: "Plagiarism check completed successfully",
      result: {
        similarityScore: result.similarityScore,
        isApproved: result.similarityScore <= 15,
        attempts: updatedThesis.data.plagiarismCheck.attempts,
        maxAttempts: updatedThesis.data.plagiarismCheck.maxAttempts,
        reportUrl: result.reportUrl
      }
    });

  } catch (error: any) {
    console.error('Plagiarism check error:', error);
    res.status(500).json({ error: "Failed to check plagiarism" });
  }
};


export const checkPlagiarismStart = async (req: Request, res: Response) => {
  try {
    const studentId = (req.user as AuthenticatedUser).id;
    const { thesisId } = req.params;

    // Get student and thesis
    const student = await userModel.getUserById(studentId);
    if (!student || student.role !== 'student') {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const thesis = await thesisModel.getThesisById(thesisId);
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" });
      return;
    }

    // Check if student owns this thesis
    if (thesis.data.student !== studentId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }


    // Check if file exists
    if (!thesis.data.fileUrl) {
      res.status(400).json({ error: "Thesis file not found" });
      return;
    }

    const filePath = path.join(__dirname, "../../server/uploads/theses", path.basename(thesis.data.fileUrl))

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" })
      return
    }


    // File found, proceed with plagiarism check
    const fileName = path.basename(filePath);
    const result = await plagiarismService.checkDocument(filePath, fileName, thesisId, student);


    if (!result.success) {
      res.status(400).json({
        error: result.error || "Plagiarism check failed",
        attempt: (thesis.data.plagiarismCheck?.attempts || 0) + 1
      });
      return;
    }

    res.status(200).json({
      message: "Plagiarism check completed successfully",
      result: {
        similarityScore: result.similarityScore,
        isApproved: result.similarityScore <= 15,
        reportUrl: result.reportUrl
      }
    });

  } catch (error: any) {
    console.error('Plagiarism check error:', error);
    res.status(500).json({ error: "Failed to check plagiarism" });
  }
};