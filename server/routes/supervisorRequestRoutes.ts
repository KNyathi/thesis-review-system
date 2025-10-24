// routes/supervisorRequestRoutes.ts
import express from "express"
import {
  requestSupervisor,
  respondToSupervisorRequest,
  getMySupervisorRequests,
  cancelSupervisorRequest,
  getAvailableSupervisors,
  getSupervisorRequestStats,
} from "../controllers/supervisorRequestController"
import { authenticate, isStudent, isStudentSupervisor, isSupervisor } from "../middleware/auth"

const supervisorRequestRouter = express.Router()

// Student routes
supervisorRequestRouter.post("/request", authenticate, isStudent, requestSupervisor) //works
supervisorRequestRouter.get("/my-requests", authenticate, isStudentSupervisor, getMySupervisorRequests) //works
supervisorRequestRouter.get("/available-supervisors", authenticate, isStudent, getAvailableSupervisors) //works
supervisorRequestRouter.delete("/:requestId", authenticate, isStudent, cancelSupervisorRequest) //works

// Supervisor routes
supervisorRequestRouter.patch("/:requestId/respond", authenticate, isSupervisor, respondToSupervisorRequest) //works
supervisorRequestRouter.get("/stats", authenticate, isSupervisor, getSupervisorRequestStats) //works

export default supervisorRequestRouter