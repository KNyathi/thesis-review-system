import type { Request, Response } from "express";
import { Pool } from 'pg';
import { ThesisModel, IThesis, IReviewIteration } from "../models/Thesis.model";
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer, IHeadOfDepartment } from "../models/User.model";
import path from "path"
import fs from "fs"

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

// Получение работ для подписания (статус awaiting_hod_signature)
export const getThesesForSigning = async (req: Request, res: Response) => {
  try {
    const hod = req.user as AuthenticatedUser & IHeadOfDepartment;
    console.log("HOD faculty:", hod.faculty);
    
    // Используем метод find() который возвращает массив с данными
    const allTheses = await thesisModel.find();
    console.log("Total theses found:", allTheses.length);
    
    // Фильтруем работы по статусу awaiting_hod_signature
    // ВНИМАНИЕ: в returned объекте нет поля .data, данные находятся на верхнем уровне
    const thesesForSigning = allTheses.filter(thesis => {
      if (!thesis) return false;
      return thesis.status === "awaiting_hod_signature";
    });
    
    console.log("Theses with status awaiting_hod_signature:", thesesForSigning.length);
    console.log("First thesis:", thesesForSigning[0]);
    
    // Получаем данные студентов
    const thesesWithStudents = await Promise.all(
      thesesForSigning.map(async (thesis) => {
        try {
          const student = await userModel.getUserById(thesis.student) as IStudent;
          if (!student) return null;
          
          console.log("Student faculty:", student?.faculty, "HOD faculty:", hod.faculty);
          
          // Проверка факультета (временно убрана)
          // if (student?.faculty !== hod.faculty) return null;
          
          return {
            id: thesis.id,
            title: thesis.title || "Без названия",
            status: thesis.status,
            submissionDate: thesis.submissionDate,
            student: {
              id: student.id,
              fullName: student.fullName,
              email: student.email,
              faculty: student.faculty,
              group: student.group,
            },
            finalGrade: thesis.finalGrade,
            reviewerSignedReviewPath: thesis.reviewerSignedReviewPath,
          };
        } catch (err) {
          console.error("Error processing thesis:", thesis.id, err);
          return null;
        }
      })
    );
    
    const filteredTheses = thesesWithStudents.filter(t => t !== null);
    console.log("Filtered theses for HOD:", filteredTheses.length);
    
    res.json(filteredTheses);
  } catch (error) {
    console.error("Error getting theses for signing:", error);
    res.status(500).json({ error: "Failed to get theses" });
  }
};

// Получение уже подписанных работ
export const getSignedTheses = async (req: Request, res: Response) => {
  try {
    const hod = req.user as AuthenticatedUser & IHeadOfDepartment;
    const allTheses = await thesisModel.find();
    
    const signedTheses = allTheses.filter(thesis => {
      if (!thesis) return false;
      return thesis.status === "awaiting_dean_signature" && 
             thesis.hodSignedReviewerPath;
    });
    
    const thesesWithStudents = await Promise.all(
      signedTheses.map(async (thesis) => {
        try {
          const student = await userModel.getUserById(thesis.student) as IStudent;
          if (!student) return null;
          if (student?.faculty !== hod.faculty) return null;
          
          return {
            id: thesis.id,
            title: thesis.title || "Без названия",
            status: thesis.status,
            submissionDate: thesis.submissionDate,
            student: {
              id: student.id,
              fullName: student.fullName,
              email: student.email,
              faculty: student.faculty,
              group: student.group,
            },
            finalGrade: thesis.finalGrade,
            signedDate: thesis.hodSignedDate,
          };
        } catch (err) {
          console.error("Error processing signed thesis:", thesis.id, err);
          return null;
        }
      })
    );
    
    const filteredTheses = thesesWithStudents.filter(t => t !== null);
    res.json(filteredTheses);
  } catch (error) {
    console.error("Error getting signed theses:", error);
    res.status(500).json({ error: "Failed to get signed theses" });
  }
};

export const getUnsignedReview = async (req: Request, res: Response) => {
    try {
        const hod = req.user as AuthenticatedUser & IHeadOfDepartment;
        const { thesisId } = req.params;

        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify HOD has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== hod.faculty) {
            res.status(403).json({ error: "Access denied: Not your student" });
            return;
        }

        // Проверяем, что рецензент уже подписал
        const reviewerSignedPath = thesis.data.reviewerSignedReviewPath;
        if (!reviewerSignedPath) {
            res.status(400).json({ error: "Reviewer has not signed yet" });
            return;
        }

        if (!fs.existsSync(reviewerSignedPath)) {
            res.status(404).json({ error: "Reviewer signed review file not found" });
            return;
        }

        // Отдаём файл напрямую (один файл, не multipart)
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="hod_review_${thesis.data.student}.pdf"`);
        
        const fileStream = fs.createReadStream(reviewerSignedPath);
        fileStream.pipe(res);
        
        fileStream.on("error", (error) => {
            console.error("Error streaming file:", error);
            res.status(500).json({ error: "Failed to stream file" });
        });
        
    } catch (error) {
        console.error("Error getting unsigned review for HOD:", error);
        res.status(500).json({ error: "Failed to get unsigned review" });
    }
};

export const getSignedReview = async (req: Request, res: Response) => {
    try {
        const hod = req.user as AuthenticatedUser & IHeadOfDepartment;
        const { thesisId } = req.params;

        // Find thesis
        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify HOD has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== hod.faculty) {
            res.status(403).json({ error: "Access denied: Not your student" });
            return;
        }

        // Get HOD signed paths
        const hodSupervisorPath = thesis.data.hodSignedSupervisorPath;
        const hodReviewerPath = thesis.data.hodSignedReviewerPath;

        // Check if both HOD signed files exist
        const hasHodSupervisorFile = hodSupervisorPath && fs.existsSync(hodSupervisorPath);
        const hasHodReviewerFile = hodReviewerPath && fs.existsSync(hodReviewerPath);

        if (!hasHodSupervisorFile || !hasHodReviewerFile) {
            res.status(404).json({
                error: "HOD signed reviews not found",
                details: {
                    hodSupervisorExists: hasHodSupervisorFile,
                    hodReviewerExists: hasHodReviewerFile
                }
            });
            return;
        }

        // Set headers for multipart response
        const boundary = '----HODSignedReviewBoundary';
        res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`);
        res.setHeader('Content-Disposition', `inline; filename="hod_signed_reviews_${thesisId}.multipart"`);

        // Helper function to send a file part
        const sendFilePart = (filePath: string, filename: string, contentType: string = 'application/pdf') => {
            const fileStats = fs.statSync(filePath);

            // Part header
            res.write(`--${boundary}\r\n`);
            res.write(`Content-Type: ${contentType}\r\n`);
            res.write(`Content-Disposition: attachment; filename="${filename}"\r\n`);
            res.write(`Content-Length: ${fileStats.size}\r\n`);
            res.write('\r\n');

            // File content
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res, { end: false });

            return new Promise<void>((resolve, reject) => {
                fileStream.on('end', () => resolve());
                fileStream.on('error', (error) => reject(error));
            });
        };

        // Send both HOD signed files
        await sendFilePart(hodSupervisorPath, `hod_signed_supervisor_review_${thesis.data.student}.pdf`);
        await sendFilePart(hodReviewerPath, `hod_signed_reviewer_review_${thesis.data.student}.pdf`);

        // End of multipart
        res.write(`--${boundary}--\r\n`);
        res.end();

    } catch (error) {
        console.error("Error getting HOD signed reviews:", error);
        res.status(500).json({ error: "Failed to get HOD signed reviews" });
    }
};

export const uploadSignedHodReviews = async (req: Request, res: Response) => {
    try {
        const hod = req.user as AuthenticatedUser & IHeadOfDepartment;
        const { thesisId } = req.params;
        const file = req.file;

        console.log("Uploading HOD signed review:", { thesisId, hasFile: !!file, file });

        if (!file) {
            res.status(400).json({ error: "Signed PDF file is required" });
            return;
        }

        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify HOD has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== hod.faculty) {
            res.status(403).json({ error: "Access denied: Not your student" });
            return;
        }

        // Проверяем, что рецензент уже подписал
        if (!thesis.data.reviewerSignedReviewPath) {
            res.status(400).json({ error: "Reviewer has not signed yet" });
            return;
        }

        // Ensure HOD signed reviews directory exists
        const signedDir = path.join(__dirname, "../../server/reviews/hod/signed");
        if (!fs.existsSync(signedDir)) {
            fs.mkdirSync(signedDir, { recursive: true });
        }

        // Сохраняем подписанный HOD файл
        const hodReviewerPath = path.join(signedDir, `hod_signed_reviewer_${thesis.data.student}.pdf`);
        
        // Перемещаем загруженный файл
        fs.renameSync(file.path, hodReviewerPath);
        
        console.log(`HOD signed review saved to: ${hodReviewerPath}`);

        // Обновляем статус работы
        await thesisModel.updateThesis(thesisId, {
            status: "awaiting_dean_signature",
            hodSignedReviewerPath: hodReviewerPath,
            hodSignedDate: new Date()
        });

        res.json({
            message: "Review signed successfully by HOD",
            success: true
        });
    } catch (error) {
        console.error("Error uploading HOD signed review:", error);
        res.status(500).json({ error: "Failed to upload signed review" });
    }
};

export const signedReview = async (req: Request, res: Response) => {
  try {
    const hod = req.user as AuthenticatedUser & IHeadOfDepartment;
    const { thesisId } = req.params;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.supervisorReview || !files.reviewerReview) {
      res.status(400).json({ error: "Both supervisor and reviewer signed files are required" });
      return;
    }

    // Get the current thesis first to access student data
    const currentThesis = await thesisModel.getThesisById(thesisId);
    if (!currentThesis) {
      res.status(404).json({ error: "Thesis not found" });
      return;
    }

    // Verify HOD has access to this faculty
    const student = await userModel.getUserById(currentThesis.data.student);
    if (!student || (student as IStudent).faculty !== hod.faculty) {
      res.status(403).json({ error: "Access denied: Not your student" });
      return;
    }

    // Move signed PDFs to permanent storage
    const supervisorSignedPath = path.join(__dirname, "../../server/reviews/hod/signed", `hod_signed_supervisor_${currentThesis.data.student}.pdf`);
    const reviewerSignedPath = path.join(__dirname, "../../server/reviews/hod/signed", `hod_signed_reviewer_${currentThesis.data.student}.pdf`);

    fs.renameSync(files.supervisorReview[0].path, supervisorSignedPath);
    fs.renameSync(files.reviewerReview[0].path, reviewerSignedPath);

    // Update thesis with HOD signed paths and metadata
    const thesis = await thesisModel.updateThesis(thesisId, {
      hodSignedSupervisorPath: supervisorSignedPath,
      hodSignedReviewerPath: reviewerSignedPath,
      hodSignedDate: new Date()
    });

    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" });
      return;
    }

    res.json({ 
      success: true,
      message: "Both reviews signed successfully by HOD"
    });
  } catch (error) {
    console.error("Error finalizing HOD review:", error);
    res.status(500).json({ error: "Failed to finalize HOD review" });
  }
};


export const downloadSignedReview = async (req: Request, res: Response) => {
  try {
    const hod = req.user as AuthenticatedUser & IHeadOfDepartment;
    const { thesisId } = req.params;

    // Find thesis
    const thesis = await thesisModel.getThesisById(thesisId);
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" });
      return;
    }

    // Verify HOD has access to this faculty
    const student = await userModel.getUserById(thesis.data.student);
    if (!student || (student as IStudent).faculty !== hod.faculty) {
      res.status(403).json({ error: "Access denied: Not your student" });
      return;
    }

    let supervisorSignedPath: string;
    let reviewerSignedPath: string;

    // Get HOD signed paths with fallbacks
    if (thesis.data.hodSignedSupervisorPath && fs.existsSync(thesis.data.hodSignedSupervisorPath)) {
      supervisorSignedPath = thesis.data.hodSignedSupervisorPath;
    } else {
      supervisorSignedPath = path.join(__dirname, "../../server/reviews/hod/signed", `hod_signed_supervisor_${thesis.data.student}.pdf`);
    }

    if (thesis.data.hodSignedReviewerPath && fs.existsSync(thesis.data.hodSignedReviewerPath)) {
      reviewerSignedPath = thesis.data.hodSignedReviewerPath;
    } else {
      reviewerSignedPath = path.join(__dirname, "../../server/reviews/hod/signed", `hod_signed_reviewer_${thesis.data.student}.pdf`);
    }

    // Check if both files exist
    if (!fs.existsSync(supervisorSignedPath) || !fs.existsSync(reviewerSignedPath)) {
      res.status(404).json({
        error: "HOD signed reviews not found",
        details: {
          supervisorExists: fs.existsSync(supervisorSignedPath),
          reviewerExists: fs.existsSync(reviewerSignedPath)
        }
      });
      return;
    }

    // Set headers for multipart response
    const boundary = '----HODSignedReviewBoundary';
    res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`);
    res.setHeader('Content-Disposition', `attachment; filename="hod_signed_reviews_${thesis.data.student}.multipart"`);

    // Helper function to send a file part
    const sendFilePart = (filePath: string, filename: string, contentType: string = 'application/pdf') => {
      const fileStats = fs.statSync(filePath);

      // Part header
      res.write(`--${boundary}\r\n`);
      res.write(`Content-Type: ${contentType}\r\n`);
      res.write(`Content-Disposition: attachment; filename="${filename}"\r\n`);
      res.write(`Content-Length: ${fileStats.size}\r\n`);
      res.write('\r\n');

      // File content
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res, { end: false });

      return new Promise<void>((resolve, reject) => {
        fileStream.on('end', () => resolve());
        fileStream.on('error', (error) => reject(error));
      });
    };

    // Send both files
    await sendFilePart(supervisorSignedPath, `hod_signed_supervisor_${thesis.data.student}.pdf`);
    await sendFilePart(reviewerSignedPath, `hod_signed_reviewer_${thesis.data.student}.pdf`);

    // End of multipart
    res.write(`--${boundary}--\r\n`);
    res.end();

  } catch (error) {
    console.error("Error downloading HOD signed reviews:", error);
    res.status(500).json({ error: "Failed to download HOD signed reviews" });
  }
};