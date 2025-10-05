const express = require("express");
const Job = require("../models/Job");
const auth = require("../middlewares/auth"); // Make sure path is correct
const Application = require("../models/application");

const notificationRouter = express.Router();

// GET API to get application status notifications for students
// GET API to get unread application status notifications for students
notificationRouter.get(
  "/api/applications/notifications",
  auth,
  async (req, res) => {
    try {
      const studentId = req.user._id;

      // Validation - Only students can access their notifications
      if (req.user.role !== "student") {
        return res.status(403).json({
          message: "Only students can access application notifications.",
        });
      }

      // Find only unread notifications (notificationSent: true, notificationRead: false)
      const applications = await Application.find({
        candidateId: studentId,
        status: { $in: ["accepted", "rejected"] },
        notificationSent: true,
        notificationRead: false,
      })
        .populate("jobId", "title companyId")
        .populate("companyId", "companyName industry profilePicture")
        .sort({ reviewedAt: -1, updatedAt: -1 }); // Sort by most recent review first

      // console.log(applications);

      // Format the notifications
      const notifications = applications.map((app) => {
        let message = "";
        let type = "";

        if (app.status === "accepted") {
          message = `Congratulations! Your application for "${app.jobId.title}" has been accepted by ${app.companyId.companyName}.`;
          type = "success";
        } else if (app.status === "rejected") {
          message = `Your application for "${app.jobId.title}" at ${app.companyId.companyName} has been reviewed but not selected for this position.`;
          type = "info";
        }

        return {
          _id: app._id,
          message,
          type,
          status: app.status,
          jobTitle: app.jobId.title,
          companyName: app.companyId.companyName,
          companyIndustry: app.companyId.industry,
          companyLogo: app.companyId.profilePicture,
          applicationDate: app.createdAt,
          reviewedDate: app.reviewedAt || app.updatedAt,
          isNew:
            (app.reviewedAt || app.updatedAt) >
            new Date(Date.now() - 24 * 60 * 60 * 1000), // New if reviewed in last 24 hours
        };
      });

      // Get counts for different notification types
      const notificationStats = {
        total: notifications.length,
        accepted: notifications.filter((n) => n.status === "accepted").length,
        rejected: notifications.filter((n) => n.status === "rejected").length,
        new: notifications.filter((n) => n.isNew).length,
      };

      res.status(200).json({
        success: true,
        message: "Unread notifications retrieved successfully",
        notifications,
        stats: notificationStats,
        count: notifications.length,
      });
    } catch (error) {
      console.error("Notifications error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while fetching notifications.",
      });
    }
  }
);

// PUT API to mark a single notification as read
notificationRouter.put(
  "/api/applications/notifications/mark-read/:applicationId",
  auth,
  async (req, res) => {
    try {
      const studentId = req.user._id;
      const { applicationId } = req.params;

      if (req.user.role !== "student") {
        return res.status(403).json({
          message: "Only students can mark notifications as read.",
        });
      }

      // Update single application to mark it as read
      const application = await Application.findOneAndUpdate(
        {
          _id: applicationId,
          candidateId: studentId,
          notificationSent: true,
          notificationRead: false,
        },
        {
          $set: {
            notificationRead: true,
            updatedAt: new Date(),
          },
        },
        { new: true } // Return updated document
      );

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Notification not found or already read.",
        });
      }

      res.status(200).json({
        success: true,
        message: "Notification marked as read successfully",
        application: {
          _id: application._id,
          status: application.status,
          notificationRead: application.notificationRead,
        },
      });
    } catch (error) {
      console.error("Mark read error:", error);
      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: "Invalid application ID format.",
        });
      }
      res.status(500).json({
        success: false,
        message: "Server error while updating notification.",
      });
    }
  }
);
module.exports = { notificationRouter };
