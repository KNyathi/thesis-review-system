// controllers/supervisorRequestController.ts
import { Pool } from 'pg';
import type { Request, Response } from "express"
import { UserModel, IStudent, ISupervisor } from "../models/User.model"
import { SupervisorRequestModel } from "../models/supervisorRequestModel"
import { ThesisModel, IThesis, IReviewIteration } from "../models/Thesis.model";


// Define the authenticated user type
interface AuthenticatedUser {
    id: string;
    role: string;
    email: string;
}

const pool = new Pool({
    connectionString: process.env.DB_URL
});

const userModel = new UserModel(pool);
const thesisModel = new ThesisModel(pool);
const supervisorRequestModel = new SupervisorRequestModel(pool);

// Initialize table on startup
supervisorRequestModel.createTable().catch(console.error);

export const requestSupervisor = async (req: Request, res: Response) => {
    try {
        const student = req.user as AuthenticatedUser & IStudent
        const { supervisorId, message } = req.body

        // Validate input
        if (!supervisorId) {
            res.status(400).json({ error: "Supervisor ID is required" })
            return
        }

        // Check if supervisor exists and is in same faculty
        const supervisor = await userModel.getUserById(supervisorId)
        if (!supervisor || supervisor.role !== 'supervisor') {
            res.status(404).json({ error: "Supervisor not found" })
            return
        }

        const supervisorData = supervisor as ISupervisor

        // Check if supervisor is in same faculty as student
        if (supervisorData.faculty !== student.faculty) {
            res.status(400).json({
                error: "Supervisor must be in the same faculty as you",
                details: {
                    yourFaculty: student.faculty,
                    supervisorFaculty: supervisorData.faculty
                }
            })
            return
        }

        // Check if student already has a supervisor
        if (student.supervisor) {
            res.status(400).json({
                error: "You already have a supervisor assigned",
                currentSupervisor: student.supervisor
            })
            return
        }

        // Check if there's already a pending request to this supervisor
        const hasPendingRequest = await supervisorRequestModel.hasPendingRequest(student.id, supervisorId)
        if (hasPendingRequest) {
            res.status(400).json({ error: "You already have a pending request to this supervisor" })
            return
        }


        // Create supervisor request
        const requestId = await supervisorRequestModel.createSupervisorRequest({
            studentId: student.id,
            supervisorId,
            faculty: student.faculty,
            status: 'pending',
            studentMessage: message
        })

        res.status(201).json({
            message: "Supervisor request sent successfully",
            requestId,
            supervisor: {
                id: supervisorId,
                name: `${supervisorData.fullName}`,
                email: supervisorData.email
            }
        })

    } catch (error) {
        console.error("Error requesting supervisor:", error)
        res.status(500).json({ error: "Failed to send supervisor request" })
    }
}

export const respondToSupervisorRequest = async (req: Request, res: Response) => {
    try {
        const supervisor = req.user as AuthenticatedUser & ISupervisor
        const { requestId } = req.params
        const { action, declineReason } = req.body

        if (!['accept', 'decline'].includes(action)) {
            res.status(400).json({ error: "Action must be 'accept' or 'decline'" })
            return
        }

        // Get the request
        const request = await supervisorRequestModel.getRequestById(requestId)
        if (!request) {
            res.status(404).json({ error: "Request not found" })
            return
        }

        // Verify the request belongs to this supervisor
        if (request.supervisorId !== supervisor.id) {
            res.status(403).json({ error: "Access denied: This request is not for you" })
            return
        }

        // Check if request is still pending
        if (request.status !== 'pending') {
            res.status(400).json({
                error: `Request has already been ${request.status}`,
                currentStatus: request.status
            })
            return
        }

        const student = await userModel.getUserById(request.studentId) as IStudent

        if (action === 'accept') {

            // Check if student already got another supervisor
            if (student.supervisor) {
                await supervisorRequestModel.updateRequestStatus(requestId, 'cancelled')
                res.status(400).json({
                    error: "Student already has a supervisor assigned",
                    currentSupervisor: student.supervisor
                })
                return
            }

            // Update request status
            await supervisorRequestModel.updateRequestStatus(requestId, 'accepted')

            // Get current assignments BEFORE making changes
            const currentSupervisorId = student.supervisor;
            const currentConsultantId = student.consultant;

            // Find if there's an existing thesis for the student
            const studentTheses = await thesisModel.getThesesByStudent(request.studentId);
            const hasExistingThesis = studentTheses.length > 0;
            const thesis = hasExistingThesis ? studentTheses[0] : null;
            const thesisId = thesis?.id;

            // Remove from old supervisor first (if any)
            if (currentSupervisorId && currentSupervisorId !== supervisor.id) {
                await userModel.removeStudentFromSupervisor(currentSupervisorId, request.studentId);
                if (hasExistingThesis && thesisId) {
                    await userModel.removeThesisFromSupervisor(currentSupervisorId, thesisId);
                    await thesisModel.unassignSupervisor(thesisId);
                }
            }

            // Assign supervisor to student
            await userModel.assignSupervisorToStudent(request.studentId, supervisor.id);
            await userModel.addStudentToSupervisor(supervisor.id, request.studentId);

            // If thesis exists, assign supervisor to thesis and add to assignedTheses
            if (hasExistingThesis && thesisId) {
                await thesisModel.assignSupervisor(thesisId, supervisor.id);
                await userModel.addThesisToSupervisor(supervisor.id, thesisId);

                // Update thesis status based on team composition
                const thesisData = thesis.data;
                let newThesisStatus: IThesis['status'] = thesisData.status;

                if (thesisData.status === 'submitted' || thesisData.status === 'revisions_requested') {
                    // Determine status based on assigned roles
                    if (currentConsultantId && supervisor.id) {
                        newThesisStatus = 'with_consultant';
                    } else if (supervisor.id) {
                        newThesisStatus = 'with_supervisor';
                    }

                    // If we're starting a new review cycle, initialize the first iteration
                    if (newThesisStatus !== 'submitted' && newThesisStatus !== 'revisions_requested') {
                        if (!thesisData.reviewIterations || thesisData.reviewIterations.length === 0) {
                            // Start first iteration
                            const firstIteration: IReviewIteration = {
                                iteration: 1,
                                status: 'under_review'
                            };

                            await thesisModel.updateThesis(thesisId, {
                                reviewIterations: [firstIteration],
                                currentIteration: 1,
                                totalReviewCount: 1,
                                status: newThesisStatus
                            });
                        } else {
                            // Update status of existing thesis
                            await thesisModel.updateThesisStatus(thesisId, newThesisStatus);
                        }
                    }
                }
            }

            // Cancel all other pending requests from this student
            const allStudentRequests = await supervisorRequestModel.getRequestsByStudent(request.studentId)
            const otherPendingRequests = allStudentRequests.filter(req =>
                req.id !== requestId && req.status === 'pending'
            )

            for (const otherRequest of otherPendingRequests) {
                await supervisorRequestModel.updateRequestStatus(otherRequest.id, 'cancelled')
            }

            // Get updated thesis info for response
            let thesisStatus = 'not_submitted';
            let currentIteration = 0;
            let totalReviewCount = 0;

            if (hasExistingThesis && thesisId) {
                const updatedThesis = await thesisModel.getThesisById(thesisId);
                thesisStatus = updatedThesis?.data.status || 'not_submitted';
                currentIteration = updatedThesis?.data.currentIteration || 0;
                totalReviewCount = updatedThesis?.data.totalReviewCount || 0;
            }

            res.json({
                message: "Supervisor request accepted successfully",
                student: {
                    id: request.studentId,
                    name: `${student.fullName}`,
                    email: student.email
                },
                thesisInfo: {
                    hasThesis: hasExistingThesis,
                    status: thesisStatus,
                    currentIteration,
                    totalReviewCount,
                    consultantAssigned: !!currentConsultantId
                }
            })

        } else { // decline
            if (!declineReason) {
                res.status(400).json({ error: "Decline reason is required when declining a request" })
                return
            }

            await supervisorRequestModel.updateRequestStatus(requestId, 'declined', declineReason)

            res.json({
                message: "Supervisor request declined successfully",
                declineReason
            })
        }

    } catch (error) {
        console.error("Error responding to supervisor request:", error)
        res.status(500).json({ error: "Failed to process supervisor request" })
    }
}


export const getMySupervisorRequests = async (req: Request, res: Response) => {
    try {
        const user = req.user as AuthenticatedUser & (IStudent | ISupervisor)

        if (user.role === 'student') {
            // Get all requests made by this student
            const requests = await supervisorRequestModel.getRequestsByStudent(user.id)

            // Enrich with supervisor details
            const enrichedRequests = await Promise.all(
                requests.map(async (request) => {
                    const supervisor = await userModel.getUserById(request.supervisorId) as ISupervisor
                    return {
                        ...request,
                        supervisor: {
                            id: supervisor.id,
                            name: `${supervisor.fullName}`,
                            email: supervisor.email,
                            department: supervisor.department,
                            position: supervisor.position
                        }
                    }
                })
            )

            res.json({
                requests: enrichedRequests,
                stats: {
                    total: requests.length,
                    pending: requests.filter(r => r.status === 'pending').length,
                    accepted: requests.filter(r => r.status === 'accepted').length,
                    declined: requests.filter(r => r.status === 'declined').length
                }
            })

        } else if (user.role === 'supervisor') {
            // Get all requests for this supervisor
            const requests = await supervisorRequestModel.getPendingRequestsForSupervisor(user.id)

            // Enrich with student details
            const enrichedRequests = await Promise.all(
                requests.map(async (request) => {
                    const student = await userModel.getUserById(request.studentId) as IStudent
                    return {
                        ...request,
                        student: {
                            id: student.id,
                            name: `${student.fullName}`,
                            email: student.email,
                            program: student.subjectArea,
                            degreeLevel: student.degreeLevel
                        }
                    }
                })
            )

            res.json({
                requests: enrichedRequests,
                pendingCount: requests.length
            })
        } else {
            res.status(403).json({ error: "Access denied: Only students and supervisors can access this" })
        }

    } catch (error) {
        console.error("Error getting supervisor requests:", error)
        res.status(500).json({ error: "Failed to get supervisor requests" })
    }
}

export const cancelSupervisorRequest = async (req: Request, res: Response) => {
    try {
        const student = req.user as AuthenticatedUser & IStudent
        const { requestId } = req.params

        const request = await supervisorRequestModel.getRequestById(requestId)
        if (!request) {
            res.status(404).json({ error: "Request not found" })
            return
        }

        // Verify the request belongs to this student
        if (request.studentId !== student.id) {
            res.status(403).json({ error: "Access denied: This request is not yours" })
            return
        }

        // Check if request is still pending
        if (request.status !== 'pending') {
            res.status(400).json({
                error: `Cannot cancel request that is already ${request.status}`,
                currentStatus: request.status
            })
            return
        }

        await supervisorRequestModel.updateRequestStatus(requestId, 'cancelled')

        res.json({
            message: "Supervisor request cancelled successfully"
        })

    } catch (error) {
        console.error("Error cancelling supervisor request:", error)
        res.status(500).json({ error: "Failed to cancel supervisor request" })
    }
}

export const getAvailableSupervisors = async (req: Request, res: Response) => {
    try {
        const student = req.user as AuthenticatedUser & IStudent

        // Get all supervisors in the same faculty
        const allSupervisors = await userModel.getSupervisors()
        const availableSupervisors = allSupervisors.filter(supervisor =>
            supervisor.faculty === student.faculty
        )

        // Enrich with additional info like current student count
        const enrichedSupervisors = await Promise.all(
            availableSupervisors.map(async (supervisor) => {


                // Check if student has any pending/accepted request to this supervisor
                const studentRequests = await supervisorRequestModel.getRequestsByStudent(student.id)
                const existingRequest = studentRequests.find(req => req.supervisorId === supervisor.id)

                return {
                    id: supervisor.id,
                    name: `${supervisor.fullName}`,
                    email: supervisor.email,
                    position: supervisor.position,
                    department: supervisor.department,
                    hasExistingRequest: !!existingRequest,
                    existingRequestStatus: existingRequest?.status
                }
            })
        )

        res.json({
            supervisors: enrichedSupervisors,
            faculty: student.faculty
        })

    } catch (error) {
        console.error("Error getting available supervisors:", error)
        res.status(500).json({ error: "Failed to get available supervisors" })
    }
}

export const getSupervisorRequestStats = async (req: Request, res: Response) => {
    try {
        const supervisor = req.user as AuthenticatedUser & ISupervisor

        const pendingRequests = await supervisorRequestModel.getPendingRequestsForSupervisor(supervisor.id)
        const currentStudents = supervisor.assignedStudents || []


        res.json({
            stats: {
                pendingRequests: pendingRequests.length,
                currentStudents: currentStudents.length
            }
        })

    } catch (error) {
        console.error("Error getting supervisor stats:", error)
        res.status(500).json({ error: "Failed to get supervisor statistics" })
    }
}