import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  FiUsers,
  FiUserCheck,
  FiFilter,
  FiCheck,
  FiX,
  FiLogOut,
  FiUser,
  FiClock,
  FiMail,
  FiShield,
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import { thesisAPI } from "../services/api"

const AdminDashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [pendingReviewers, setPendingReviewers] = useState([])
  const [approvedReviewers, setApprovedReviewers] = useState([])
  const [filteredStudents, setFilteredStudents] = useState([])
  const [activeTab, setActiveTab] = useState("students")
  const [isLoading, setIsLoading] = useState(true)
  const [filterOption, setFilterOption] = useState("all")
  const [assigningStudent, setAssigningStudent] = useState(null)
  const [processingReviewer, setProcessingReviewer] = useState(null)
  const { toast, showToast, hideToast } = useToast()

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [allUsers, pendingData, approvedData] = await Promise.all([
        thesisAPI.getAllUsers(),
        thesisAPI.getPendingReviewers(),
        thesisAPI.getApprovedReviewers(),
      ])

 
      // Filter students from all users
      const studentUsers = allUsers.filter((user) => user.role === "student")
      setStudents(studentUsers)
      setPendingReviewers(pendingData)
      setApprovedReviewers(approvedData)
    } catch (error) {
      showToast("Failed to fetch data", error)
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchData()
  }, [])

  // Filter students
  useEffect(() => {
    let filtered = [...students]

    if (filterOption === "assigned") {
      filtered = filtered.filter((student) => student.assignedReviewer)
    } else if (filterOption === "not_assigned") {
      filtered = filtered.filter((student) => !student.assignedReviewer)
    }

    setFilteredStudents(filtered)
  }, [students, filterOption])

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const handleAssignReviewer = async (studentId, reviewerId) => {
    try {
      setAssigningStudent(studentId)
      await thesisAPI.assignReviewer(studentId, reviewerId)
      showToast("Reviewer assigned successfully!", "success")
      await fetchData()
    } catch (error) {
      showToast("Failed to assign reviewer", "error")
    } finally {
      setAssigningStudent(null)
    }
  }

  const handleApproveReviewer = async (reviewerId) => {
    try {
      setProcessingReviewer(reviewerId)
      await thesisAPI.approveReviewer(reviewerId)
      showToast("Reviewer approved successfully!", "success")
      await fetchData()
    } catch (error) {
      showToast("Failed to approve reviewer", "error")
    } finally {
      setProcessingReviewer(null)
    }
  }

  const handleDeclineReviewer = async (reviewerId) => {
    try {
      setProcessingReviewer(reviewerId)
      await thesisAPI.declineReviewer(reviewerId)
      showToast("Reviewer declined", "success")
      await fetchData()
    } catch (error) {
      showToast("Failed to decline reviewer", "error")
    } finally {
      setProcessingReviewer(null)
    }
  }

  const getStatusColor = (status, hasUploaded, assignedReviewer) => {
    if (!hasUploaded) {
      return "text-red-400"
    }
    if (!assignedReviewer) {
      return "text-blue-400"
    }
    switch (status) {
      case "assigned":
      case "under_review":
        return "text-orange-400"
      case "evaluated":
        return "text-green-400"
      default:
        return "text-gray-400"
    }
  }

  const getStatusText = (status, hasUploaded, assignedReviewer) => {
    if (!hasUploaded) {
      return "Not submitted"
    }
    if (!assignedReviewer) {
      return "Waiting for reviewer assignment"
    }
    switch (status) {
      case "assigned":
        return "Assigned to reviewer"
      case "under_review":
        return "Under review"
      case "evaluated":
        return "Evaluated"
      default:
        return "Unknown"
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Toast {...toast} onClose={hideToast} />

      {/* Top Navigation Bar */}
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
              <FiShield className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-xs">
                  {user?.fullName
                    ?.split(" ")
                    .map((name) => name[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "A"}
                </span>
              </div>
              <div>
                <p className="text-white font-medium text-sm">{user?.fullName}</p>
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
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-black font-bold text-xl">T</span>
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">Admin Dashboard</h1>
            <p className="text-gray-400">Manage students and reviewers</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveTab("students")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "students" ? "bg-white text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              Students ({students.length})
            </button>
            <button
              onClick={() => setActiveTab("reviewers")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "reviewers" ? "bg-white text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              Pending Reviewers ({pendingReviewers.length})
            </button>
          </div>

          {activeTab === "students" ? (
            <>
              {/* Student Filters */}
              <div className="flex gap-4 mb-6 p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="flex items-center gap-2">
                  <FiFilter className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300 text-sm">Filter:</span>
                  <select
                    value={filterOption}
                    onChange={(e) => setFilterOption(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white"
                  >
                    <option value="all">All Students</option>
                    <option value="assigned">With Assigned Reviewer</option>
                    <option value="not_assigned">Without Assigned Reviewer</option>
                  </select>
                </div>
              </div>

              {/* Students List */}
              <div className="space-y-4">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <div
                      key={student._id}
                      className="bg-gray-900 rounded-lg p-6 border border-gray-800 hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold text-sm">
                                {student.fullName
                                  .split(" ")
                                  .map((name) => name[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-white">{student.fullName}</h3>
                              <p className="text-gray-400 text-sm">{student.email}</p>
                            </div>
                          </div>
                          <div className="ml-13">
                            <p className="text-white font-medium mb-1">
                              {student.thesisTopic || "No thesis title yet"}
                            </p>
                            <p className="text-gray-400 text-sm mb-2">{student.institution}</p>
                            <div className="flex items-center gap-4 text-sm">
                              {student.thesisFile && (
                                <div className="flex items-center gap-2 text-gray-400">
                                  <FiClock className="w-4 h-4" />
                                  <span>Thesis uploaded</span>
                                </div>
                              )}
                              <div
                                className={`flex items-center gap-2 ${getStatusColor(
                                  student.thesisStatus,
                                  !!student.thesisFile,
                                  student.reviewer,
                                )}`}
                              >
                                <FiUser className="w-4 h-4" />
                                <span className="font-medium">
                                  {getStatusText(student.thesisStatus, !!student.thesisFile, student.reviewer)}
                                </span>
                              </div>
                            </div>
                            {student.reviewer && (
                              <div className="mt-3 p-3 bg-gray-800 rounded-lg">
                                <p className="text-gray-400 text-xs">Assigned Reviewer</p>
                                <p className="text-white font-medium">Reviewer assigned</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!student.reviewer && student.thesisFile && (
                            <div className="relative">
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignReviewer(student._id, e.target.value)
                                    e.target.value = ""
                                  }
                                }}
                                disabled={assigningStudent === student._id}
                                className="bg-white text-black font-medium py-2 px-4 rounded-lg hover:bg-gray-100 transition-colors text-sm disabled:opacity-50"
                              >
                                <option value="">
                                  {assigningStudent === student._id ? "Assigning..." : "Assign Reviewer"}
                                </option>
                                {approvedReviewers.map((reviewer) => (
                                  <option key={reviewer._id} value={reviewer._id}>
                                    {reviewer.fullName} - {reviewer.institution}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <FiUsers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-400 mb-2">No Students Found</h3>
                    <p className="text-gray-500">No students match the current filter criteria.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Pending Reviewers */
            <div className="space-y-4">
              {pendingReviewers.length > 0 ? (
                pendingReviewers.map((reviewer) => (
                  <div
                    key={reviewer._id}
                    className="bg-gray-900 rounded-lg p-6 border border-gray-800 hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {reviewer.fullName
                                .split(" ")
                                .map((name) => name[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">{reviewer.fullName}</h3>
                            <p className="text-gray-400 text-sm">{reviewer.email}</p>
                          </div>
                        </div>
                        <div className="ml-13">
                          <p className="text-white font-medium mb-1">{reviewer.institution}</p>
                          <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <FiMail className="w-4 h-4" />
                            <span>Registered {new Date(reviewer.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveReviewer(reviewer._id)}
                          disabled={processingReviewer === reviewer._id}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          {processingReviewer === reviewer._id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <FiCheck className="w-4 h-4" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeclineReviewer(reviewer._id)}
                          disabled={processingReviewer === reviewer._id}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          <FiX className="w-4 h-4" />
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <FiUserCheck className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-400 mb-2">No Pending Reviewers</h3>
                  <p className="text-gray-500">All reviewer applications have been processed.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
