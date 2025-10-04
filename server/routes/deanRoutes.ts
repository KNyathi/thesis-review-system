import express from 'express';
import upload from "../utils/multer"
import { authenticate, isAdmin, isConsultantReview, isDean, isHeadOfDepartment, isManagement } from '../middleware/auth';
import { hodUpload } from '../utils/multerMultiple';
import { downloadSignedReview, getSignedReview, getUnsignedReview, signedReview, uploadSignedDeanReviews } from '../controllers/deanController';
import { deanUpload } from '../utils/deanMulterMultiple';

const deanRouter = express.Router();

// Review signing routes
deanRouter.get("/unsigned-review-dean/:thesisId", authenticate, isDean, getUnsignedReview) //work in progress
deanRouter.get(
    "/signed-review-dean/:thesisId",
    authenticate,
    isConsultantReview,
    getSignedReview,
) //work in progress

// Chrome native tools upload route
deanRouter.post(
    "/upload-signed-review-dean/:thesisId",
    authenticate,
    isDean,
    deanUpload.fields([
        { name: "supervisorReview", maxCount: 1 },
        { name: "reviewerReview", maxCount: 1 }
    ]),
    uploadSignedDeanReviews,
) //work in progress

deanRouter.post("/signed-review-dean/:thesisId", authenticate, isDean, signedReview) //work in progress

deanRouter.get("/download-signed-review-dean/:thesisId", authenticate,  isConsultantReview, downloadSignedReview) //work in progress

export default deanRouter;