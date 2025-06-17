import { Request, Response } from "express";
import { Thesis } from "../models/Thesis.model";
import { IStudent, IUser, Student, Reviewer } from "../models/User.model";
import { Types } from "mongoose";
import fs from "fs";
import path from "path";

function isObjectId(value: unknown): value is Types.ObjectId {
  return value instanceof Types.ObjectId;
}

// Submit Thesis with File Upload
export const submitThesis = async (req: Request, res: Response) => {
  try {
    // Check if user is attached to the request and has the necessary properties
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    // Access the user's _id correctly
    const studentId = req.user._id;

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    // Fetch the full student document from the database
    const student = await Student.findById(studentId);
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const existingThesis = await Thesis.findOne({ student: studentId });
    if (existingThesis) {
      await Thesis.findByIdAndDelete(existingThesis._id);

      // Remove the thesis from the reviewer's assignedTheses if it was assigned
      if (existingThesis.assignedReviewer) {
        await Reviewer.findByIdAndUpdate(
          existingThesis.assignedReviewer,
          { $pull: { assignedTheses: existingThesis._id } },
          { new: true }
        );
      }
    }

    const thesis = new Thesis({
      title: req.body.title,
      student: student._id,
      fileUrl: `/uploads/theses/${req.file.filename}`,
      status: "submitted",
      assignedReviewer: null,
      finalGrade: "",
      assessment: null,
    });

    await thesis.save();

    // Update student's thesis status
    student.thesisStatus = "submitted";
    student.thesisFile = thesis.fileUrl;
    student.thesisTopic = thesis.title;

    await student.save();

    res.status(201).json(thesis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Thesis submission failed" });
  }
};

/**
 * Get the current student's thesis with status and reviewer info
 */
export const getStudentThesis = async (req: Request, res: Response) => {
  try {
    const student = req.user as IStudent;

    const thesis = await Thesis.findOne({ student: student._id })
      .populate("assignedReviewer", "fullName email institution")
      .lean();

    if (!thesis) {
      res.status(404).json({
        message: "Thesis not submitted yet",
        status: "not_submitted",
      });
      return;
    }

    res.json({
      ...thesis,
      reviewer: thesis.assignedReviewer, // First assigned reviewer
      status: student.thesisStatus, // From user model
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error fetching thesis" });
  }
};

// Download Thesis
export const downloadThesis = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as IUser;

    if (!user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const thesis = await Thesis.findById(id);
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" });
      return;
    }

    // Verify permissions
    const isAllowed =
      user.role === "admin" ||
      (user.role === "reviewer" &&
        isObjectId(thesis.assignedReviewer) &&
        isObjectId(user._id) &&
        thesis.assignedReviewer.equals(user._id));

    if (!isAllowed) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const filePath = path.join(__dirname, "../../server/uploads/theses", path.basename(thesis.fileUrl));

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Set headers to indicate a file download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${thesis.title}.pdf"`
    );

    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("error", (error) => {
      console.error("Error streaming file:", error);
      res.status(500).json({ error: "Download failed" });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Download failed" });
  }
};



export const viewThesis = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as IUser;

    if (!user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const thesis = await Thesis.findById(id);
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" });
      return;
    }

    // Verify permissions
    {/* 
    const isAllowed =
      user.role === "admin" ||  user.role === "student" ||
      (user.role === "reviewer" &&
        isObjectId(thesis.assignedReviewer) &&
        isObjectId(user._id) &&
        thesis.assignedReviewer.equals(user._id));

    if (!isAllowed) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
*/}
    const filePath = path.join(__dirname, "../../server/uploads/theses", path.basename(thesis.fileUrl));

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Set headers to indicate a file download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${thesis.title}.pdf"`
    );

    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("error", (error) => {
      console.error("Error streaming file:", error);
      res.status(500).json({ error: "Download failed" });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Download failed" });
  }
};