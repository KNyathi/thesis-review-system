// routes/studentRouter.ts
import path from "path";
import fs from "fs";
import express from 'express';
import upload from "../utils/multer"
import { authenticate, isFinalReview, isStudent } from '../middleware/auth';
import { downloadReviewerUnSignedReview, downloadSignedReview, downloadSupervisorUnSignedReview, getMyTopicStatus, getReviewerUnSignedReview, getSignedReview, getSupervisorUnSignedReview, respondToProposedTopic, studentSignedReviewReviewer, studentSignedReviewSupervisor, uploadStudentSignedReviewReviewer, uploadStudentSignedReviewSupervisor, getUnsignedReviewForStudent, uploadStudentSignedReview, saveThesisContent } from '../controllers/studentController';
import { Pool } from 'pg';
import { UserModel } from '../models/User.model';
import { ThesisModel } from '../models/Thesis.model';

const studentRouter = express.Router();


// Student gets their topic status
studentRouter.get('/topic-status', authenticate, isStudent, getMyTopicStatus);
studentRouter.put('/approve-topic-student', authenticate, isStudent, respondToProposedTopic);

studentRouter.get(
  "/signed-review-final/:thesisId",
  authenticate,
  isFinalReview,
  getSignedReview,
);

studentRouter.get(
  "/unsigned-review-supervisor/:thesisId",
  authenticate,
  isStudent,
  getSupervisorUnSignedReview,
);

studentRouter.get(
  "/unsigned-review-reviewer/:thesisId",
  authenticate,
  isStudent,
  getReviewerUnSignedReview,
)

studentRouter.get("/download-signed-review-final/:thesisId", authenticate, isFinalReview, downloadSignedReview)
studentRouter.get("/download-unsigned-review-supervisor/:thesisId", authenticate, isStudent, downloadSupervisorUnSignedReview)
studentRouter.get("/download-unsigned-review-reviewer/:thesisId", authenticate, isStudent, downloadReviewerUnSignedReview)

// Chrome native tools upload route
studentRouter.post(
    "/upload-signed--student-review-supervisor/:thesisId",
    authenticate,
    isStudent,
    upload.single("signedStudentReviewSupervisor"),
    uploadStudentSignedReviewSupervisor,
)

studentRouter.post(
    "/upload-signed--student-review-reviewer/:thesisId",
    authenticate,
    isStudent,
    upload.single("signedStudentReviewReviewer"),
    uploadStudentSignedReviewReviewer,
)

studentRouter.post("/signed-student-review-supervisor/:thesisId", authenticate, isStudent, studentSignedReviewSupervisor)
studentRouter.post("/signed-student-review-reviewer/:thesisId", authenticate, isStudent, studentSignedReviewReviewer)


// Создайте экземпляры
const pool = new Pool({
  connectionString: process.env.DB_URL
});
const userModel = new UserModel(pool);
const thesisModel = new ThesisModel(pool);

// Добавьте этот route в конце файла, перед экспортом
studentRouter.get('/available-supervisors', authenticate, isStudent, async (req, res) => {
  try {
    const student = req.user as any;
    
    // Получаем всех супервизоров
    const allSupervisors = await userModel.getSupervisors();
    
    // Фильтруем по факультету студента
    const availableSupervisors = allSupervisors.filter(supervisor => 
      supervisor.faculty === student.faculty
    );

    // Обогащаем информацией о существующих запросах
    const enrichedSupervisors = availableSupervisors.map((supervisor) => ({
      id: supervisor.id,
      fullName: supervisor.fullName,
      email: supervisor.email,
      position: supervisor.position,
      department: supervisor.department,
      faculty: supervisor.faculty
    }));

    res.json({
      supervisors: enrichedSupervisors,
      faculty: student.faculty
    });
    
  } catch (error) {
    console.error("Не удалось загрузить список научных руководителейs:", error);
    res.status(500).json({ error: "Не удалось загрузить список научных руководителей" });
  }
});


studentRouter.post("/thesis-content", authenticate, isStudent, saveThesisContent);

// Получение unsigned рецензии для подписания студентом
studentRouter.get(
  "/unsigned-review/:thesisId",
  authenticate,
  isStudent,
  getUnsignedReviewForStudent
);

// Загрузка подписанной студентом рецензии
studentRouter.post(
  "/upload-signed-review/:thesisId",
  authenticate,
  isStudent,
  upload.single("signedReview"),
  uploadStudentSignedReview
);

studentRouter.get(
  "/test-unsigned/:thesisId",
  authenticate,
  isStudent,
  (req, res) => {
    console.log("TEST UNSIGNED HIT!");
    res.json({ message: "Test unsigned works", thesisId: req.params.thesisId });
  }
);

studentRouter.get(
  "/my-signed-review/:thesisId",
  authenticate,
  isStudent,
  (req, res) => {
    // Используем void функцию, не async
    (async () => {
      try {
        const student = req.user as any;
        const { thesisId } = req.params;
        
        console.log("Fetching signed review for student:", student?.id, "thesisId:", thesisId);
        
        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
          console.log("Thesis not found");
          res.status(404).json({ error: "Thesis not found" });
          return;
        }
        
        console.log("Thesis found, student owner:", thesis.data.student);
        
        if (thesis.data.student !== student.id) {
          console.log("Access denied - student mismatch");
          res.status(403).json({ error: "Access denied" });
          return;
        }
        
        // Ищем подписанную рецензию рецензента
        let signedPath = thesis.data.reviewerSignedReviewPath;
        console.log("Reviewer signed path from DB:", signedPath);
        
        if (!signedPath || !fs.existsSync(signedPath)) {
          const fallbackPath = path.join(__dirname, "../../server/reviews/reviewer/signed", `signed_review2_${thesis.data.student}.pdf`);
          console.log("Fallback path:", fallbackPath);
          console.log("Fallback exists:", fs.existsSync(fallbackPath));
          
          if (fs.existsSync(fallbackPath)) {
            signedPath = fallbackPath;
          } else {
            console.log("Signed review not found in any location");
            res.status(404).json({ error: "Signed review not found" });
            return;
          }
        }
        
        console.log("Sending signed review file from:", signedPath);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");
        const fileStream = fs.createReadStream(signedPath);
        fileStream.pipe(res);
      } catch (error) {
        console.error("Error getting signed review for student:", error);
        res.status(500).json({ error: "Failed to get signed review" });
      }
    })();
  }
);

export default studentRouter;