import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiUpload,
  FiFile,
  FiCheck,
  FiClock,
  FiUser,
  FiDownload,
  FiRefreshCw,
  FiLogOut,
  FiAlertCircle,
} from "react-icons/fi";
import { Toast, useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { thesisAPI } from "../services/api";

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [thesis, setThesis] = useState(null);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showReupload, setShowReupload] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  const hasFetched = useRef(false);

  const fetchThesis = useCallback(async () => {
    if (hasFetched.current) return;

    try {
      setIsLoading(true);
      hasFetched.current = true;
      const data = await thesisAPI.getMyThesis();
      setThesis(data);
      setTitle(data?.title || "");
    } catch (error) {
      if (error.response?.status !== 404) {
        showToast("Failed to fetch thesis information", "error");
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchThesis();
  }, [fetchThesis]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        showToast("Please select a PDF file", "error");
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        showToast("File size must be less than 10MB", "error");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title.trim()) {
      showToast("Please provide both title and file", "error");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("thesisFile", file);

      await thesisAPI.submitThesis(formData);
      showToast(
        thesis
          ? "Thesis re-uploaded successfully!"
          : "Thesis submitted successfully!",
        "success"
      );

      hasFetched.current = false;
      await fetchThesis();
      setFile(null);
      setShowReupload(false);

      const fileInput = document.getElementById("thesisFile");
      if (fileInput) fileInput.value = "";
    } catch (error) {
      showToast(
        error.response?.data?.error || "Failed to submit thesis",
        "error"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewPDF = async () => {
    try {
      const blob = await thesisAPI.viewThesis(thesis?._id);
      const blobUrl = URL.createObjectURL(blob);

      // Open in new tab with proper PDF handling
      const newWindow = window.open("", "_blank");
      if (newWindow) {
        // Create a clean HTML document
        newWindow.document.open();
        newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Thesis Viewer</title>
            <style>
              body { margin: 0; overflow: hidden; }
              iframe { width: 100vw; height: 100vh; border: none; }
            </style>
          </head>
          <body>
            <iframe src="${blobUrl}"></iframe>
          </body>
        </html>
      `);
        newWindow.document.close();

        // Focus the new window
        newWindow.focus();
      } else {
        showToast("Popup blocked - please allow popups", "warning");
      }

      // Clean up after some time
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (error) {
      showToast("Failed to open thesis", "error");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "submitted":
        return "text-blue-400";
      case "assigned":
      case "under_review":
        return "text-orange-400";
      case "evaluated":
        return "text-green-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "submitted":
        return "Submitted - Waiting for reviewer assignment";
      case "assigned":
        return "Assigned to reviewer";
      case "under_review":
        return "Under review";
      case "evaluated":
        return "Evaluated";
      default:
        return "Not submitted";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Toast {...toast} onClose={hideToast} />

      {/* Top Navigation Bar */}
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-black font-bold text-sm">T</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-xs">
                  {user?.fullName
                    ?.split(" ")
                    .map((name) => name[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "U"}
                </span>
              </div>
              <div>
                <p className="text-white font-medium text-sm">
                  {user?.fullName}
                </p>
                <p className="text-gray-400 text-xs capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            <FiLogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-black font-bold text-xl">T</span>
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">
              Thesis Submission
            </h1>
            <p className="text-gray-400">
              Upload and manage your graduation thesis
            </p>
          </div>

          {thesis && !showReupload ? (
            // Existing thesis display
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-2">
                    {thesis.title}
                  </h2>
                  <div
                    className={`flex items-center gap-2 ${getStatusColor(
                      thesis.status
                    )}`}
                  >
                    <FiClock className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {getStatusText(thesis.status)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Submitted on</p>
                  <p className="text-white font-medium">
                    {new Date(thesis.submissionDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Special message for students waiting for reviewer assignment */}
              {thesis.status === "submitted" && !thesis.assignedReviewer && (
                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <FiAlertCircle className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-blue-400 font-medium">
                        Waiting for Reviewer Assignment
                      </p>
                      <p className="text-gray-400 text-sm">
                        Your thesis has been successfully submitted. An
                        administrator will assign a reviewer to your thesis
                        soon. You will be notified once a reviewer has been
                        assigned and begins the review process.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {thesis.assignedReviewer && (
                <div className="bg-gray-800 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <FiUser className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-gray-400 text-sm">Assigned Reviewer</p>
                      <p className="text-white font-medium">
                        {thesis.assignedReviewer.fullName}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {thesis.assignedReviewer.institution}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {thesis.finalGrade && (
                <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <FiCheck className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-green-400 font-medium">
                        Final Grade: {thesis.finalGrade}
                      </p>
                      <p className="text-gray-400 text-sm">
                        Your thesis has been evaluated
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                <div className="flex items-center gap-2 text-gray-400">
                  <FiFile className="w-4 h-4" />
                  <span className="text-sm">PDF Document</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowReupload(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    <FiRefreshCw className="w-4 h-4" />
                    Re-upload Thesis
                  </button>
                  <button
                    onClick={handleViewPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <FiDownload className="w-4 h-4" />
                    View Thesis
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Upload/Re-upload form
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              {showReupload && (
                <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FiRefreshCw className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="text-yellow-400 font-medium">
                        Re-uploading Thesis
                      </p>
                      <p className="text-gray-400 text-sm">
                        This will replace your current thesis file. The old file
                        will be permanently deleted.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Thesis Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter your thesis title"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="thesisFile"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Thesis File (PDF only, max 10MB)
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      id="thesisFile"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      required
                    />
                    <label
                      htmlFor="thesisFile"
                      className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors"
                    >
                      <div className="text-center">
                        <FiUpload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-400">
                          {file ? file.name : "Click to select PDF file"}
                        </p>
                        <p className="text-gray-500 text-sm mt-1">
                          PDF only, max 10MB
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3">
                  {showReupload && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowReupload(false);
                        setFile(null);
                        const fileInput = document.getElementById("thesisFile");
                        if (fileInput) fileInput.value = "";
                      }}
                      className="flex-1 bg-gray-800 text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isUploading || !file || !title.trim()}
                    className="flex-1 bg-white text-black font-medium py-3 px-4 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <FiUpload className="w-5 h-5" />
                        {showReupload ? "Re-upload Thesis" : "Submit Thesis"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
