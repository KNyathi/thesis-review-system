// routes/studentRouter.ts
import express from 'express';
import upload from "../utils/multer"
import { authenticate, isFinalReview, isStudent } from '../middleware/auth';
import { downloadReviewerUnSignedReview, downloadSignedReview, downloadSupervisorUnSignedReview, getMyTopicStatus, getReviewerUnSignedReview, getSignedReview, getSupervisorUnSignedReview, respondToProposedTopic, studentSignedReviewReviewer, studentSignedReviewSupervisor, uploadStudentSignedReviewReviewer, uploadStudentSignedReviewSupervisor } from '../controllers/studentController';
import { Pool } from 'pg';
import { UserModel } from '../models/User.model';

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


export default studentRouter;