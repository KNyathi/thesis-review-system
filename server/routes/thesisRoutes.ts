import express from "express"
import {
  submitThesis,
  getStudentThesis,
  downloadThesis,
  viewThesis,
  submitTopic
} from "../controllers/thesisController"
import { authenticate, isAdmin, isReviewer, isStudent, isThesisAccess } from "../middleware/auth"
import upload from "../utils/multer"

const thesisRouter = express.Router()

//Student Routes
thesisRouter.post("/submit-topic", authenticate, isStudent, submitTopic) //complete
thesisRouter.post("/submit-thesis", authenticate, isStudent, upload.single("thesisFile"), submitThesis) //complete
thesisRouter.get("/my-thesis", authenticate, isStudent, getStudentThesis) //complete

// Download route (reviewer/admin)
thesisRouter.get(
  "/thesis/:id/download",
  authenticate,
  isThesisAccess,
  downloadThesis,
) //complete

thesisRouter.get("/view-pdf/:id", authenticate, isThesisAccess, viewThesis) //complete




export default thesisRouter
