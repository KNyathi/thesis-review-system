import { useState, useEffect, useCallback, useRef } from "react"
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
  FiTrash2,
  FiAlertTriangle,
  FiMoreHorizontal,
  FiRefreshCw,
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import { thesisAPI } from "../services/api"
import Modal from "../components/Modal"

const AdminDashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [theses, setTheses] = useState([])
  const [pendingReviewers, setPendingReviewers] = useState([])
  const [approvedReviewers, setApprovedReviewers] = useState([])
  const [filteredStudents, setFilteredStudents] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [activeTab, setActiveTab] = useState("students")
  const [isLoading, setIsLoading] = useState(true)
  const [filterOption, setFilterOption] = useState("all")
  const [userFilterOption, setUserFilterOption] = useState("all")
  const [assigningStudent, setAssigningStudent] = useState(null)
  const [processingReviewer, setProcessingReviewer] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [reassignData, setReassignData] = useState(null)
  const [openDropdown, setOpenDropdown] = useState(null)
  const { toast, showToast, hideToast } = useToast()

  // Use ref to prevent infinite loops
  const fetchedRef = useRef(false)
  const retryCountRef = useRef(0)
  const maxRetries = 3

  const fetchData = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (fetchedRef.current && retryCountRef.current === 0) {
      return
    }

    try {
      setIsLoading(true)
      retryCountRef.current += 1

      // Fetch data with proper error handling and timeout
      const fetchWithTimeout = (promise, timeout = 10000) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), timeout)),
        ])
      }

      const [allUsersResult, allThesesResult, pendingResult, approvedResult] = await Promise.allSettled([
        fetchWithTimeout(thesisAPI.getAllUsers()),
        fetchWithTimeout(thesisAPI.getAllTheses()),
        fetchWithTimeout(thesisAPI.getPendingReviewers()),
        fetchWithTimeout(thesisAPI.getApprovedReviewers()),
      ])

      // Extract values from settled promises with fallbacks
      const users = allUsersResult.status === "fulfilled" && allUsersResult.value ? allUsersResult.value : []
      const thesesData = allThesesResult.status === "fulfilled" && allThesesResult.value ? allThesesResult.value : []
      const pending = pendingResult.status === "fulfilled" && pendingResult.value ? pendingResult.value : []
      const approved = approvedResult.status === "fulfilled" && approvedResult.value ? approvedResult.value : []

      // Filter students from all users with additional safety check
      const studentUsers = Array.isArray(users) ? users.filter((user) => user && user.role === "student") : []
      setStudents(studentUsers)
      setAllUsers(users)
      setTheses(thesesData)
      setPendingReviewers(pending)
      setApprovedReviewers(approved)

      // Check if any requests failed
      const failedRequests = [allUsersResult, allThesesResult, pendingResult, approvedResult].filter(
        (result) => result.status === "rejected",
      )

      if (failedRequests.length > 0) {
        console.warn("Some data requests failed:", failedRequests)
        if (retryCountRef.current < maxRetries) {
          showToast(`Some data could not be loaded. Retrying... (${retryCountRef.current}/${maxRetries})`, "warning")
          // Retry after a delay
          setTimeout(() => {
            fetchData()
          }, 2000)
          return
        } else {
          showToast("Some data could not be loaded after multiple attempts", "error")
        }
      }

      fetchedRef.current = true
      retryCountRef.current = 0
    } catch (error) {
      console.error("Error fetching data:", error)
      if (retryCountRef.current < maxRetries) {
        showToast(`Failed to fetch data. Retrying... (${retryCountRef.current}/${maxRetries})`, "warning")
        setTimeout(() => {
          fetchData()
        }, 2000)
      } else {
        showToast("Failed to fetch data after multiple attempts", "error")
        retryCountRef.current = 0
      }
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (user && user.role === "admin" && !fetchedRef.current) {
      fetchData()
    }
  }, [user, fetchData])

  // Filter students
  useEffect(() => {
    let filtered = [...students]

    if (filterOption === "assigned") {
      filtered = filtered.filter((student) => student.reviewer)
    } else if (filterOption === "not_assigned") {
      filtered = filtered.filter((student) => !student.reviewer)
    }

    setFilteredStudents(filtered)
  }, [students, filterOption])

  // Filter all users
  useEffect(() => {
    let filtered = [...allUsers]

    if (userFilterOption === "students") {
      filtered = filtered.filter((user) => user.role === "student")
    } else if (userFilterOption === "reviewers") {
      filtered = filtered.filter((user) => user.role === "reviewer")
    } else if (userFilterOption === "admins") {
      filtered = filtered.filter((user) => user.role === "admin")
    }

    setFilteredUsers(filtered)
  }, [allUsers, userFilterOption])

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const handleAssignReviewer = async (studentId, reviewerId) => {
    const student = students.find((s) => s.id === studentId)
    const reviewer = approvedReviewers.find((r) => r.id === reviewerId)

    const thesis = theses.find((t) => t.student === studentId)

    if (!thesis) {
      showToast("No thesis found for this student", "error")
      return
    }
    const oldReviewerId = student?.reviewer
    const currentReviewer = student?.reviewer ? approvedReviewers.find((r) => r.id === student.reviewer) : null

    if (currentReviewer) {
      // Show reassignment confirmation
      setReassignData({
        studentId,
        thesisId: thesis?.id,
        oldReviewerId: oldReviewerId,
        newReviewerId: reviewerId,
        studentName: student.fullName,
        currentReviewerName: currentReviewer.fullName,
        newReviewerName: reviewer.fullName,
      })
      setShowReassignModal(true)
    } else {
      // Direct assignment
      try {
        setAssigningStudent(studentId)
        await thesisAPI.assignReviewer(studentId, reviewerId)
        showToast("Reviewer assigned successfully!", "success")
        // Refresh data after successful assignment
        fetchedRef.current = false
        await fetchData()
      } catch (error) {
        showToast("Failed to assign reviewer", "error")
      } finally {
        setAssigningStudent(null)
      }
    }
  }

  const handleConfirmReassign = async () => {
    if (!reassignData) return

    try {
      setAssigningStudent(reassignData.studentId)
      await thesisAPI.reassignReviewer(reassignData.thesisId, reassignData.oldReviewerId, reassignData.newReviewerId)

      showToast(
        `Reviewer successfully changed from ${reassignData.currentReviewerName} to ${reassignData.newReviewerName}!`,
        "success",
      )
      // Refresh data after successful reassignment
      fetchedRef.current = false
      await fetchData()
      setShowReassignModal(false)
      setReassignData(null)
    } catch (error) {
      showToast("Failed to reassign reviewer", "error")
    } finally {
      setAssigningStudent(null)
    }
  }

  const handleApproveReviewer = async (reviewerId) => {
    try {
      setProcessingReviewer(reviewerId)
      await thesisAPI.approveReviewer(reviewerId)
      showToast("Reviewer approved successfully!", "success")
      // Refresh data after successful approval
      fetchedRef.current = false
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
      // Refresh data after successful decline
      fetchedRef.current = false
      await fetchData()
    } catch (error) {
      showToast("Failed to decline reviewer", "error")
    } finally {
      setProcessingReviewer(null)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    try {
      setDeletingUser(userToDelete.id)
      await thesisAPI.deleteUser(userToDelete.id)
      showToast(`User ${userToDelete.fullName} deleted successfully!`, "success")
      // Refresh data after successful deletion
      fetchedRef.current = false
      await fetchData()
      setShowDeleteModal(false)
      setUserToDelete(null)
    } catch (error) {
      showToast("Failed to delete user", "error")
    } finally {
      setDeletingUser(null)
    }
  }

  const openDeleteModal = (user) => {
    setUserToDelete(user)
    setShowDeleteModal(true)
    setOpenDropdown(null)
  }

  const toggleDropdown = (userId) => {
    setOpenDropdown(openDropdown === userId ? null : userId)
  }

  const getStatusColor = (status, hasUploaded, assignedReviewer) => {
    if (!hasUploaded) {
      return "text-red-400"
    }
    if (!assignedReviewer) {
      return "text-blue-400"
    }
    switch (status) {
      case "submitted":
        return "text-blue-400"
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
      case "under_review":
        return "Assigned to reviewer"
      case "evaluated":
        return "Evaluated"
      default:
        return "Awaiting Submission"
    }
  }

  const getRoleColor = (role) => {
    switch (role) {
      case "student":
        return "from-blue-500 to-purple-600"
      case "reviewer":
        return "from-green-500 to-teal-600"
      case "admin":
        return "from-purple-500 to-pink-600"
      default:
        return "from-gray-500 to-gray-600"
    }
  }

  // Check if user is admin
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-6">You don't have permission to access this page.</p>
          <button
            onClick={() => navigate(`/${user?.role || "login"}`)}
            className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (isLoading && !fetchedRef.current) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading admin dashboard...</p>
          {retryCountRef.current > 0 && (
            <p className="text-yellow-400 text-sm mt-2">
              Retry attempt {retryCountRef.current}/{maxRetries}
            </p>
          )}
        </div>
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
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-3 hover:bg-gray-800 rounded-lg p-2 transition-colors"
            >
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
              <div className="text-left">
                <p className="text-white font-medium text-sm">{user?.fullName}</p>
                <p className="text-gray-400 text-xs capitalize">{user?.role}</p>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchedRef.current = false
                retryCountRef.current = 0
                fetchData()
              }}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <FiRefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              <FiLogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
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
            <p className="text-gray-400">Manage students, reviewers, and users</p>
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
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "users" ? "bg-white text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              All Users ({allUsers.length})
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
                  filteredStudents.map((student) => {
                    const reviewer = approvedReviewers.find((reviewer) => reviewer.id === student.reviewer)
                    const thesis = theses?.find((thes) => thes.student === student.id)

                    return (
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
                                    <span>Submitted {new Date(thesis?.submissionDate).toLocaleDateString()}</span>
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
                                  <p className="text-white font-medium">{reviewer?.fullName}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {student.thesisFile && (
                              <div className="relative">
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleAssignReviewer(student.id, e.target.value)
                                      e.target.value = ""
                                    }
                                  }}
                                  disabled={assigningStudent === student.id}
                                  className="bg-white text-black font-medium py-2 px-4 rounded-lg hover:bg-gray-100 transition-colors text-sm disabled:opacity-50"
                                >
                                  <option value="">
                                    {assigningStudent === student.id
                                      ? "Processing..."
                                      : student.reviewer
                                        ? "Reassign Reviewer"
                                        : "Assign Reviewer"}
                                  </option>
                                  {approvedReviewers.map((reviewer) => (
                                    <option key={reviewer.id} value={reviewer.id}>
                                      {reviewer.fullName} - {reviewer.institution}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div className="relative">
                              <button
                                onClick={() => toggleDropdown(student.id)}
                                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                              >
                                <FiMoreHorizontal className="w-4 h-4" />
                              </button>
                              {openDropdown === student.id && (
                                <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
                                  <button
                                    onClick={() => openDeleteModal(student)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-gray-700 transition-colors text-sm"
                                  >
                                    <FiTrash2 className="w-4 h-4" />
                                    Delete User
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-12">
                    <FiUsers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-400 mb-2">No Students Found</h3>
                    <p className="text-gray-500">No students match the current filter criteria.</p>
                  </div>
                )}
              </div>
            </>
          ) : activeTab === "reviewers" ? (
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveReviewer(reviewer.id)}
                          disabled={processingReviewer === reviewer.id}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          {processingReviewer === reviewer.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <FiCheck className="w-4 h-4" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeclineReviewer(reviewer.id)}
                          disabled={processingReviewer === reviewer.id}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          <FiX className="w-4 h-4" />
                          Decline
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => toggleDropdown(reviewer.id)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                          >
                            <FiMoreHorizontal className="w-4 h-4" />
                          </button>
                          {openDropdown === reviewer.id && (
                            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
                              <button
                                onClick={() => openDeleteModal(reviewer)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-gray-700 transition-colors text-sm"
                              >
                                <FiTrash2 className="w-4 h-4" />
                                Delete User
                              </button>
                            </div>
                          )}
                        </div>
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
          ) : (
            /* All Users */
            <>
              {/* User Filters */}
              <div className="flex gap-4 mb-6 p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="flex items-center gap-2">
                  <FiFilter className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300 text-sm">Filter:</span>
                  <select
                    value={userFilterOption}
                    onChange={(e) => setUserFilterOption(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white"
                  >
                    <option value="all">All Users</option>
                    <option value="students">Students</option>
                    <option value="reviewers">Reviewers</option>
                    <option value="admins">Admins</option>
                  </select>
                </div>
              </div>

              {/* Users List */}
              <div className="space-y-4">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((userItem) => (
                    <div
                      key={userItem.id}
                      className="bg-gray-900 rounded-lg p-6 border border-gray-800 hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div
                              className={`w-10 h-10 bg-gradient-to-br ${getRoleColor(userItem.role)} rounded-full flex items-center justify-center`}
                            >
                              <span className="text-white font-semibold text-sm">
                                {userItem.fullName
                                  .split(" ")
                                  .map((name) => name[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-white">{userItem.fullName}</h3>
                              <p className="text-gray-400 text-sm">{userItem.email}</p>
                            </div>
                          </div>
                          <div className="ml-13">
                            <p className="text-white font-medium mb-1">{userItem.institution}</p>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-2 text-gray-400">
                                <FiUser className="w-4 h-4" />
                                <span className="capitalize font-medium">{userItem.role}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-400">
                                <FiClock className="w-4 h-4" />
                                <span>Joined {new Date(userItem.createdAt).toLocaleDateString()}</span>
                              </div>
                              {userItem.role === "reviewer" && (
                                <div
                                  className={`flex items-center gap-2 ${userItem.isApproved ? "text-green-400" : "text-yellow-400"}`}
                                >
                                  <FiCheck className="w-4 h-4" />
                                  <span>{userItem.isApproved ? "Approved" : "Pending"}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {userItem.id !== user.id && (
                            <div className="relative">
                              <button
                                onClick={() => toggleDropdown(userItem.id)}
                                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                              >
                                <FiMoreHorizontal className="w-4 h-4" />
                              </button>
                              {openDropdown === userItem.id && (
                                <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
                                  <button
                                    onClick={() => openDeleteModal(userItem)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-gray-700 transition-colors text-sm"
                                  >
                                    <FiTrash2 className="w-4 h-4" />
                                    Delete User
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <FiUsers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-400 mb-2">No Users Found</h3>
                    <p className="text-gray-500">No users match the current filter criteria.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setUserToDelete(null)
        }}
        title="Confirm User Deletion"
        size="medium"
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
              <FiAlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Delete User</h3>
              <p className="text-gray-400">This action cannot be undone</p>
            </div>
          </div>

          {userToDelete && (
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 bg-gradient-to-br ${getRoleColor(userToDelete.role)} rounded-full flex items-center justify-center`}
                >
                  <span className="text-white font-semibold text-sm">
                    {userToDelete.fullName
                      .split(" ")
                      .map((name) => name[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{userToDelete.fullName}</p>
                  <p className="text-gray-400 text-sm">{userToDelete.email}</p>
                  <p className="text-gray-400 text-sm capitalize">{userToDelete.role}</p>
                </div>
              </div>
            </div>
          )}

          <p className="text-gray-300 mb-6">
            Are you sure you want to delete user{" "}
            <span className="font-medium text-white">{userToDelete?.fullName}</span>? This will permanently remove their
            account and all associated data.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowDeleteModal(false)
                setUserToDelete(null)
              }}
              className="flex-1 bg-gray-700 text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteUser}
              disabled={deletingUser}
              className="flex-1 bg-red-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {deletingUser ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <FiTrash2 className="w-5 h-5" />
                  Delete User
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reassign Reviewer Confirmation Modal */}
      <Modal
        isOpen={showReassignModal}
        onClose={() => {
          setShowReassignModal(false)
          setReassignData(null)
        }}
        title="Confirm Reviewer Reassignment"
        size="medium"
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center">
              <FiRefreshCw className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Reassign Reviewer</h3>
              <p className="text-gray-400">This will change the assigned reviewer</p>
            </div>
          </div>

          {reassignData && (
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <p className="text-white mb-2">
                <span className="font-medium">Student:</span> {reassignData.studentName}
              </p>
              <p className="text-gray-300 mb-2">
                <span className="font-medium">Current Reviewer:</span> {reassignData.currentReviewerName}
              </p>
              <p className="text-gray-300">
                <span className="font-medium">New Reviewer:</span> {reassignData.newReviewerName}
              </p>
            </div>
          )}

          <p className="text-gray-300 mb-6">
            Are you sure you want to change the reviewer from{" "}
            <span className="font-medium text-white">{reassignData?.currentReviewerName}</span> to{" "}
            <span className="font-medium text-white">{reassignData?.newReviewerName}</span> for student{" "}
            <span className="font-medium text-white">{reassignData?.studentName}</span>?
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowReassignModal(false)
                setReassignData(null)
              }}
              className="flex-1 bg-gray-700 text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReassign}
              disabled={assigningStudent}
              className="flex-1 bg-yellow-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {assigningStudent ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <FiRefreshCw className="w-5 h-5" />
                  Reassign Reviewer
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Click outside to close dropdowns */}
      {openDropdown && <div className="fixed inset-0 z-5" onClick={() => setOpenDropdown(null)} />}
    </div>
  )
}

export default AdminDashboard
