import type { Request, Response } from "express";
import { Pool } from 'pg';
import { ThesisModel, IThesis, IReviewIteration } from "../models/Thesis.model";
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer } from "../models/User.model";

const pool = new Pool({
  connectionString: process.env.DB_URL
});

const thesisModel = new ThesisModel(pool);
const userModel = new UserModel(pool);

export const assignThesisTeam = async (req: Request, res: Response) => {
  try {
    const { studentId, supervisorId, consultantId, reviewerId } = req.body;

    // Validate at least one role is being assigned
    if (!supervisorId && !consultantId && !reviewerId) {
      res.status(400).json({ error: "At least one team member (supervisor, consultant, or reviewer) must be assigned" });
      return;
    }

    // Check if student exists
    const student = await userModel.getUserById(studentId);
    if (!student || student.role !== 'student') {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const studentData = student as IStudent;

    // Get current assignments BEFORE making changes
    const currentSupervisorId = studentData.supervisor;
    const currentConsultantId = studentData.consultant;
    const currentReviewerId = studentData.reviewer;

    // Find if there's an existing thesis for the student
    const studentTheses = await thesisModel.getThesesByStudent(studentId);
    const hasExistingThesis = studentTheses.length > 0;
    const thesis = hasExistingThesis ? studentTheses[0] : null;
    const thesisId = thesis?.id;

    // Handle SUPERVISOR assignment
    if (supervisorId) {
      const supervisor = await userModel.getUserById(supervisorId);
      if (!supervisor || supervisor.role !== 'supervisor') {
        res.status(404).json({ error: "Supervisor not found" });
        return;
      }
      
      // Remove from old supervisor first
      if (currentSupervisorId && currentSupervisorId !== supervisorId) {
        await userModel.removeStudentFromSupervisor(currentSupervisorId, studentId);
        if (hasExistingThesis && thesisId) {
          await userModel.removeThesisFromSupervisor(currentSupervisorId, thesisId);
          await thesisModel.unassignSupervisor(thesisId);
        }
      }

      // Assign supervisor to student
      await userModel.assignSupervisorToStudent(studentId, supervisorId);
      
      // Add student to supervisor's assigned students
      await userModel.addStudentToSupervisor(supervisorId, studentId);

      // If thesis exists, assign supervisor to thesis and add to assignedTheses
      if (hasExistingThesis && thesisId) {
        await thesisModel.assignSupervisor(thesisId, supervisorId);
        await userModel.addThesisToSupervisor(supervisorId, thesisId);
      }
    }

    // Handle CONSULTANT assignment
    if (consultantId) {
      const consultant = await userModel.getUserById(consultantId);
      if (!consultant || consultant.role !== 'consultant') {
        res.status(404).json({ error: "Consultant not found" });
        return;
      }
      
      // Remove from old consultant first
      if (currentConsultantId && currentConsultantId !== consultantId) {
        await userModel.removeStudentFromConsultant(currentConsultantId, studentId);
        if (hasExistingThesis && thesisId) {
          await userModel.removeThesisFromConsultant(currentConsultantId, thesisId);
          await thesisModel.unassignConsultant(thesisId);
        }
      }

      // Assign consultant to student
      await userModel.assignConsultantToStudent(studentId, consultantId);
      
      // Add student to consultant's assigned students
      await userModel.addStudentToConsultant(consultantId, studentId);

      // If thesis exists, assign consultant to thesis and add to assignedTheses
      if (hasExistingThesis && thesisId) {
        await thesisModel.assignConsultant(thesisId, consultantId);
        await userModel.addThesisToConsultant(consultantId, thesisId);
      }
    }

    // Handle REVIEWER assignment
    if (reviewerId) {
      const reviewer = await userModel.getUserById(reviewerId);
      if (!reviewer || reviewer.role !== 'reviewer') {
        res.status(404).json({ error: "Reviewer not found" });
        return;
      }

      // Remove from old reviewer first
      if (currentReviewerId && currentReviewerId !== reviewerId) {
        if (hasExistingThesis && thesisId) {
          await userModel.removeThesisFromReviewer(currentReviewerId, thesisId);
          await thesisModel.unassignReviewer(thesisId);
        }
      }

      // Assign reviewer to student
      await userModel.assignReviewerToStudent(studentId, reviewerId);

      // If thesis exists, assign reviewer to thesis and add to assignedTheses
      if (hasExistingThesis && thesisId) {
        await thesisModel.assignReviewer(thesisId, reviewerId);
        await userModel.addThesisToReviewer(reviewerId, thesisId);
      }
    }

    let thesisStatus = 'not_submitted';
    let currentIteration = 0;
    let totalReviewCount = 0;

    if (hasExistingThesis && thesisId) {
      // Initialize or update thesis with team assignments and start first iteration if needed
      const thesisData = thesis.data;
      
      // Determine the appropriate status based on assigned roles
      let newThesisStatus: IThesis['status'] = thesisData.status;

      if (thesisData.status === 'submitted' || thesisData.status === 'revisions_requested') {
        // Only change status if thesis is ready for review
        if (consultantId && supervisorId) {
          newThesisStatus = 'with_consultant';
        } else if (supervisorId) {
          newThesisStatus = 'with_supervisor';
        } else if (reviewerId) {
          newThesisStatus = 'under_review';
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

      // Get updated thesis data for response
      const updatedThesis = await thesisModel.getThesisById(thesisId);
      thesisStatus = updatedThesis?.data.status || 'not_submitted';
      currentIteration = updatedThesis?.data.currentIteration || 0;
      totalReviewCount = updatedThesis?.data.totalReviewCount || 0;
    }

    // Update student's team assignments in their profile
    const updateData: any = {};
    if (supervisorId) updateData.supervisor = supervisorId;
    if (consultantId) updateData.consultant = consultantId;
    if (reviewerId) updateData.reviewer = reviewerId;

    await userModel.updateUser(studentId, updateData);

    res.json({ 
      message: "Thesis team assigned successfully",
      assignments: {
        supervisor: supervisorId ? "Assigned" : "Not assigned",
        consultant: consultantId ? "Assigned" : "Not assigned", 
        reviewer: reviewerId ? "Assigned" : "Not assigned"
      },
      thesisInfo: {
        hasThesis: hasExistingThesis,
        status: thesisStatus,
        currentIteration,
        totalReviewCount
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to assign thesis team" });
  }
};