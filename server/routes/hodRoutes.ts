import express from 'express';
import upload from "../utils/multer"
import { authenticate, isAdmin, isConsultantReview, isHeadOfDepartment, isManagement } from '../middleware/auth';
import { downloadSignedReview, getSignedReview, getUnsignedReview, signedReview, uploadSignedHodReviews } from '../controllers/hodController';
import { hodUpload } from '../utils/multerMultiple';

const hodRouter = express.Router();

// Review signing routes
hodRouter.get("/unsigned-review-hod/:thesisId", authenticate, isHeadOfDepartment, getUnsignedReview) //work in progress
hodRouter.get(
    "/signed-review-hod/:thesisId",
    authenticate,
    isConsultantReview,
    getSignedReview,
) //work in progress

// Chrome native tools upload route
hodRouter.post(
    "/upload-signed-review-hod/:thesisId",
    authenticate,
    isHeadOfDepartment,
    hodUpload.fields([
        { name: "supervisorReview", maxCount: 1 },
        { name: "reviewerReview", maxCount: 1 }
    ]),
    uploadSignedHodReviews,
) //work in progress

hodRouter.post("/signed-review-hod/:thesisId", authenticate, isHeadOfDepartment, hodUpload.fields([
    { name: "supervisorReview", maxCount: 1 },
    { name: "reviewerReview", maxCount: 1 }
]), signedReview) //work in progress

hodRouter.get("/download-signed-review-hod/:thesisId", authenticate, isConsultantReview, downloadSignedReview) //work in progress

export default hodRouter;