import express from "express"
import {
  submitThesis,
  getStudentThesis,
  downloadThesis,
  viewThesis,
  downloadSignedReview,
  submitTopic
} from "../controllers/thesisController"
import { authenticate, isAdmin, isReviewer, isStudent } from "../middleware/auth"
import upload from "../utils/multer"

const thesisRouter = express.Router()

//Student Routes
thesisRouter.post("/submit-topic", authenticate, isStudent, submitTopic) //complete
thesisRouter.post("/submit-thesis", authenticate, isStudent, upload.single("thesisFile"), submitThesis) //complete
thesisRouter.get("/my-thesis", authenticate, isStudent, getStudentThesis)

// Download route (reviewer/admin)
thesisRouter.get(
  "/thesis/:id/download",
  authenticate,
  (req, res, next) => {
    if (req.user?.role === "reviewer") {
      isReviewer(req, res, next)
    } else if (req.user?.role === "admin") {
      isAdmin(req, res, next)
    } else {
      res.status(403).json({ error: "Access denied" })
    }
  },
  downloadThesis,
)

thesisRouter.get("/view-pdf/:id", authenticate, viewThesis)

thesisRouter.get("/download-signed-review/:thesisId", authenticate, downloadSignedReview)


export default thesisRouter
