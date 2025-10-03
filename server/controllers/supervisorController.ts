import type { Request, Response } from "express";
import { Pool } from 'pg';
import { ThesisModel, IThesis, IReviewIteration } from "../models/Thesis.model";
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer } from "../models/User.model";

const pool = new Pool({
    connectionString: process.env.DB_URL
});

const thesisModel = new ThesisModel(pool);
const userModel = new UserModel(pool);

export const approveThesisTopic = async (req: Request, res: Response) => {
    try {
        const { studentId } = req.params;
        const { approved, comments } = req.body;
        const supervisorId = (req.user as any).id;

        // Validate input
        if (typeof approved !== 'boolean') {
            res.status(400).json({
                error: "Approval status is required and must be boolean"
            });
            return;
        }

        if (!approved && (!comments || comments.trim() === '')) {
            res.status(400).json({
                error: "Comments are required when rejecting a thesis topic"
            });
            return;
        }

        // Get student data
        const student = await userModel.getUserById(studentId);
        if (!student || student.role !== 'student') {
            res.status(404).json({
                error: "Student not found"
            });
            return;
        }

        const studentData = student as IStudent;

         // Check if student is assigned to this supervisor
        if (studentData.supervisor !== supervisorId) {
            res.status(403).json({
                error: "You are not assigned as supervisor for this student"
            });
            return;
        }

        // Check if student has submitted a thesis topic
        if (!studentData.thesisTopic || studentData.thesisTopic.trim() === '') {
            res.status(400).json({
                error: "Student has not submitted any thesis topic"
            });
            return;
        }

        // Check if topic is already approved
        if (studentData.isTopicApproved) {
            res.status(400).json({
                error: "Thesis topic is already approved"
            });
            return;
        }

        // Prepare update data
        const updateData: any = {
            isTopicApproved: approved
        };

        // Store rejection comments if topic is rejected
        if (!approved) {
            updateData.topicRejectionComments = comments.trim();
        } else {
            // Clear rejection comments if approving
            updateData.topicRejectionComments = null;
        }

        const updatedStudent = await userModel.updateUser(studentId, updateData);

        res.status(200).json({
            message: `Thesis topic ${approved ? 'approved' : 'rejected'} successfully`,
            student: {
                id: updatedStudent.id,
                thesisTopic: (updatedStudent as IStudent).thesisTopic,
                isTopicApproved: (updatedStudent as IStudent).isTopicApproved,
                fullName: updatedStudent.fullName,
                ...(!approved && { rejectionComments: (updatedStudent as IStudent).topicRejectionComments })
            }
        });

    } catch (error: any) {
        console.error('Error approving thesis topic:', error);
        res.status(500).json({
            error: error.message || "Failed to approve thesis topic"
        });
    }
};


export const getPendingApprovals = async (req: Request, res: Response) => {
  try {
    const supervisorId = (req.user as any).id;

    const allStudents = await userModel.getStudents();
    
    // Filter students assigned to this supervisor with pending topic approval
    const pendingApprovals = allStudents
      .filter(student => 
        student.thesisTopic && 
        student.thesisTopic.trim() !== '' && 
        !student.isTopicApproved && 
        student.supervisor === supervisorId
      )
      .map(student => ({
        studentId: student.id,
        studentName: student.fullName,
        faculty: student.faculty,
        thesisTopic: student.thesisTopic
      }));

     res.status(200).json({
      data: pendingApprovals
    });
    return

  } catch (error: any) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({
      error: error.message || "Failed to fetch pending approvals"
    });

    return
  }
};