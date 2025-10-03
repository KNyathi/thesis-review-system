import type { Request, Response } from "express";
import { Pool } from 'pg';
import { ThesisModel, IThesis, IReviewIteration } from "../models/Thesis.model";
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer } from "../models/User.model";

const pool = new Pool({
    connectionString: process.env.DB_URL
});

const thesisModel = new ThesisModel(pool);
const userModel = new UserModel(pool);

export const getMyTopicStatus = async (req: Request, res: Response) => {
    try {
        const studentId = (req.user as any).id;

        const student = await userModel.getUserById(studentId);
        if (!student || student.role !== 'student') {
            res.status(404).json({
                error: "Student not found"
            });
            return;
        }

        const studentData = student as IStudent;

        res.status(200).json({
            data: {
                thesisTopic: studentData.thesisTopic,
                isTopicApproved: studentData.isTopicApproved,
                rejectionComments: studentData.topicRejectionComments,
                supervisor: studentData.supervisor
            }
        });

    } catch (error: any) {
        console.error('Error fetching topic status:', error);
        res.status(500).json({
            error: error.message || "Failed to fetch topic status"
        });
    }
};