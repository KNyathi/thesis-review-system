import type { Request, Response } from "express";
import { Pool } from 'pg';
import { ThesisModel, IThesis, IReviewIteration } from "../models/Thesis.model";
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer, IHeadOfDepartment, IDean } from "../models/User.model";
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

// Получение работ для подписания (статус awaiting_dean_signature)
export const getThesesForSigning = async (req: Request, res: Response) => {
    try {
        const dean = req.user as AuthenticatedUser & IDean;
        console.log("Dean faculty:", dean.faculty);
        
        const allTheses = await thesisModel.find();
        console.log("Total theses found:", allTheses.length);
        
        // Фильтруем работы по статусу awaiting_dean_signature
        const thesesForSigning = allTheses.filter(thesis => {
            if (!thesis) return false;
            return thesis.status === "awaiting_dean_signature";
        });
        
        console.log("Theses with status awaiting_dean_signature:", thesesForSigning.length);
        
        // Получаем данные студентов
        const thesesWithStudents = await Promise.all(
            thesesForSigning.map(async (thesis) => {
                try {
                    const student = await userModel.getUserById(thesis.student) as IStudent;
                    if (!student) return null;
                    
                    // Проверка факультета
                    if (student?.faculty !== dean.faculty) return null;
                    
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
                        hodSignedReviewerPath: thesis.hodSignedReviewerPath,
                    };
                } catch (err) {
                    console.error("Error processing thesis:", thesis.id, err);
                    return null;
                }
            })
        );
        
        const filteredTheses = thesesWithStudents.filter(t => t !== null);
        console.log("Filtered theses for Dean:", filteredTheses.length);
        
        res.json(filteredTheses);
    } catch (error) {
        console.error("Error getting theses for signing:", error);
        res.status(500).json({ error: "Failed to get theses" });
    }
};

// Получение завершённых работ (статус evaluated)
export const getCompletedTheses = async (req: Request, res: Response) => {
    try {
        const dean = req.user as AuthenticatedUser & IDean;
        const allTheses = await thesisModel.find();
        
        const completedTheses = allTheses.filter(thesis => {
            if (!thesis) return false;
            return thesis.status === "evaluated";
        });
        
        const thesesWithStudents = await Promise.all(
            completedTheses.map(async (thesis) => {
                try {
                    const student = await userModel.getUserById(thesis.student) as IStudent;
                    if (!student) return null;
                    if (student?.faculty !== dean.faculty) return null;
                    
                    return {
                        id: thesis.id,
                        title: thesis.title || "Без названия",
                        status: thesis.status,
                        submissionDate: thesis.submissionDate,
                        finalGrade: thesis.finalGrade,
                        student: {
                            id: student.id,
                            fullName: student.fullName,
                            email: student.email,
                            faculty: student.faculty,
                            group: student.group,
                        },
                        signedDate: thesis.deanSignedDate,
                    };
                } catch (err) {
                    console.error("Error processing completed thesis:", thesis.id, err);
                    return null;
                }
            })
        );
        
        const filteredTheses = thesesWithStudents.filter(t => t !== null);
        res.json(filteredTheses);
    } catch (error) {
        console.error("Error getting completed theses:", error);
        res.status(500).json({ error: "Failed to get completed theses" });
    }
};

// Получение неподписанной рецензии для декана (подписанная HOD)
export const getUnsignedReview = async (req: Request, res: Response) => {
    try {
        const dean = req.user as AuthenticatedUser & IDean;
        const { thesisId } = req.params;

        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify Dean has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== dean.faculty) {
            res.status(403).json({ error: "Access denied: Not your faculty student" });
            return;
        }

        // Проверяем, что HOD уже подписал
        const hodSignedPath = thesis.data.hodSignedReviewerPath;
        if (!hodSignedPath) {
            res.status(400).json({ error: "HOD has not signed yet" });
            return;
        }

        if (!fs.existsSync(hodSignedPath)) {
            res.status(404).json({ error: "HOD signed review file not found" });
            return;
        }

        // Отдаём файл
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="dean_review_${thesis.data.student}.pdf"`);
        
        const fileStream = fs.createReadStream(hodSignedPath);
        fileStream.pipe(res);
        
        fileStream.on("error", (error) => {
            console.error("Error streaming file:", error);
            res.status(500).json({ error: "Failed to stream file" });
        });
        
    } catch (error) {
        console.error("Error getting unsigned review for Dean:", error);
        res.status(500).json({ error: "Failed to get unsigned review" });
    }
};

// Загрузка подписанной деканом рецензии
export const uploadSignedDeanReviews = async (req: Request, res: Response) => {
    try {
        console.log("=== uploadSignedDeanReviews START ===");
        
        const dean = req.user as AuthenticatedUser & IDean;
        const { thesisId } = req.params;
        const file = req.file;

        console.log("Dean ID:", dean.id);
        console.log("Thesis ID:", thesisId);
        console.log("File received:", file ? file.originalname : "No file");

        if (!file) {
            res.status(400).json({ error: "Signed PDF file is required" });
            return;
        }

        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify Dean has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== dean.faculty) {
            res.status(403).json({ error: "Access denied: Not your faculty student" });
            return;
        }

        // Проверяем, что HOD уже подписал
        if (!thesis.data.hodSignedReviewerPath) {
            res.status(400).json({ error: "HOD has not signed yet" });
            return;
        }

        // Ensure Dean signed reviews directory exists
        const signedDir = path.join(__dirname, "../../server/reviews/dean/signed");
        if (!fs.existsSync(signedDir)) {
            fs.mkdirSync(signedDir, { recursive: true });
        }

        // Сохраняем подписанный деканом файл
        const deanSignedPath = path.join(signedDir, `dean_signed_reviewer_${thesis.data.student}.pdf`);
        fs.renameSync(file.path, deanSignedPath);

        console.log(`Dean signed review saved to: ${deanSignedPath}`);

        // Обновляем статус работы
        await thesisModel.updateThesis(thesisId, {
            status: "evaluated",
            deanSignedReviewerPath: deanSignedPath,
            deanSignedDate: new Date()
        });

        // Обновляем статус студента
        await userModel.updateStudentThesisStatus(thesis.data.student, "evaluated");

        res.json({
            message: "Review signed successfully by Dean",
            success: true
        });
    } catch (error) {
        console.error("Error uploading Dean signed review:", error);
        res.status(500).json({ error: "Failed to upload signed review" });
    }
};

// Утверждение защиты (без подписи, просто кнопка)
export const approveDefense = async (req: Request, res: Response) => {
    try {
        const dean = req.user as AuthenticatedUser & IDean;
        const { thesisId } = req.params;

        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify Dean has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== dean.faculty) {
            res.status(403).json({ error: "Access denied: Not your faculty student" });
            return;
        }

        // Проверяем, что HOD уже подписал
        if (!thesis.data.hodSignedReviewerPath) {
            res.status(400).json({ error: "HOD has not signed yet" });
            return;
        }

        // Обновляем статус работы
        await thesisModel.updateThesis(thesisId, {
            status: "evaluated",
            deanSignedDate: new Date()
        });

        await userModel.updateStudentThesisStatus(thesis.data.student, "evaluated");

        res.json({
            message: "Defense approved successfully by Dean",
            success: true
        });
    } catch (error) {
        console.error("Error approving defense:", error);
        res.status(500).json({ error: "Failed to approve defense" });
    }
};

// Получение подписанной рецензии для просмотра
export const getSignedReview = async (req: Request, res: Response) => {
    try {
        const dean = req.user as AuthenticatedUser & IDean;
        const { thesisId } = req.params;

        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify Dean has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== dean.faculty) {
            res.status(403).json({ error: "Access denied: Not your faculty student" });
            return;
        }

        let signedPath = thesis.data.deanSignedReviewerPath;
        if (!signedPath || !fs.existsSync(signedPath)) {
            const fallbackPath = path.join(__dirname, "../../server/reviews/dean/signed", `dean_signed_reviewer_${thesis.data.student}.pdf`);
            if (fs.existsSync(fallbackPath)) {
                signedPath = fallbackPath;
            } else {
                res.status(404).json({ error: "Signed review not found" });
                return;
            }
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="dean_signed_review_${thesis.data.student}.pdf"`);
        fs.createReadStream(signedPath).pipe(res);
        
    } catch (error) {
        console.error("Error getting signed review:", error);
        res.status(500).json({ error: "Failed to get signed review" });
    }
};

// Скачивание подписанной рецензии
export const downloadSignedReview = async (req: Request, res: Response) => {
    try {
        const dean = req.user as AuthenticatedUser & IDean;
        const { thesisId } = req.params;

        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== dean.faculty) {
            res.status(403).json({ error: "Access denied" });
            return;
        }

        let signedPath = thesis.data.deanSignedReviewerPath;
        if (!signedPath || !fs.existsSync(signedPath)) {
            const fallbackPath = path.join(__dirname, "../../server/reviews/dean/signed", `dean_signed_reviewer_${thesis.data.student}.pdf`);
            if (fs.existsSync(fallbackPath)) {
                signedPath = fallbackPath;
            } else {
                res.status(404).json({ error: "Signed review not found" });
                return;
            }
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="dean_signed_review_${thesis.data.student}.pdf"`);
        fs.createReadStream(signedPath).pipe(res);
        
    } catch (error) {
        console.error("Error downloading signed review:", error);
        res.status(500).json({ error: "Failed to download signed review" });
    }
};

// Альтернативный метод подписания рецензии
export const signedReview = async (req: Request, res: Response) => {
    try {
        const dean = req.user as AuthenticatedUser & IDean;
        const { thesisId } = req.params;
        const file = req.file;

        if (!file) {
            res.status(400).json({ error: "Signed PDF file is required" });
            return;
        }

        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== dean.faculty) {
            res.status(403).json({ error: "Access denied" });
            return;
        }

        const signedDir = path.join(__dirname, "../../server/reviews/dean/signed");
        if (!fs.existsSync(signedDir)) {
            fs.mkdirSync(signedDir, { recursive: true });
        }

        const signedPath = path.join(signedDir, `dean_signed_reviewer_${thesis.data.student}.pdf`);
        fs.renameSync(file.path, signedPath);

        await thesisModel.updateThesis(thesisId, {
            status: "evaluated",
            deanSignedReviewerPath: signedPath,
            deanSignedDate: new Date()
        });

        await userModel.updateStudentThesisStatus(thesis.data.student, "evaluated");

        res.json({ success: true });
    } catch (error) {
        console.error("Error finalizing Dean review:", error);
        res.status(500).json({ error: "Failed to finalize Dean review" });
    }
};