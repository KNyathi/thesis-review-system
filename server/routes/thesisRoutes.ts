import express from "express"
import {
  submitThesis,
  getStudentThesis,
  downloadThesis,
  viewThesis,
  reReviewThesis,
} from "../controllers/thesisController"
import { authenticate } from "../middleware/auth"
import { isStudent, isReviewer, isAdmin } from "../middleware/roles"
import upload from "../utils/multer"

const thesisRouter = express.Router()

//Student Routes
thesisRouter.post("/submit-thesis", authenticate, isStudent, upload.single("thesisFile"), submitThesis)
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

// Re-review route for reviewers
thesisRouter.post("/re-review/:id", authenticate, isReviewer, reReviewThesis)

export default thesisRouter
