import axios from "axios"

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000/api/v1"

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Real API calls
const realThesisAPI = {
  register: async (userData) => {
    const response = await api.post("/register", userData)
    return { success: true, ...response.data }
  },

  login: async (credentials) => {
    const response = await api.post("/login", credentials)
    return response.data
  },

  logout: async () => {
    const response = await api.post("/logout")
    return response.data
  },

  me: async () => {
    const response = await api.get("/me")
    return response.data
  },

  submitTopic: async (thesisTopic) => {
    const response = await api.post(`/submit-topic`, { thesisTopic })
    return response.data
  },

  respondToProposedTopic: async (requestData) => {
      const response = await api.put(`/approve-topic-student`, requestData)
      return response.data
  },

  // Student endpoints
  submitThesis: async (formData) => {
    const response = await api.post("/submit-thesis", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  },

  getMyThesis: async () => {
    const response = await api.get("/my-thesis")
    return response.data
  },

  studentResubmitThesis: async (thesisId) => {
    const response = await api.post(`/student/resubmit-thesis/${thesisId}`)
    return response.data
  },

  // Reviewer endpoints
  getAssignedTheses: async () => {
    const response = await api.get("/assigned-theses")
    return response.data
  },

  getCompletedReviews: async () => {
    const response = await api.get("/completed-theses")
    return response.data
  },

  submitReview: async (thesisId, reviewData) => {
    const response = await api.post(`/submit-review/${thesisId}`, reviewData)
    return response.data
  },

  reReviewThesis: async (thesisId) => {
    const response = await api.post(`/re-review/${thesisId}`)
    return response.data
  },

  // File access routes
  downloadThesis: async (thesisId) => {
    const response = await api.get(`/thesis/${thesisId}/download`, {
      responseType: "blob",
    })
    return response.data
  },

  viewThesis: async (thesisId) => {
    const response = await api.get(`/view-pdf/${thesisId}`, {
      responseType: "blob",
    })
    return response.data
  },

  downloadSignedReview: async (thesisId) => {
    const response = await api.get(`/download-signed-review/${thesisId}`, {
      responseType: "blob",
    })
    return response.data
  },

  // Review signing routes with Chrome native tools workflow
  getUnsignedReview: async (thesisId) => {
    const response = await api.get(`/unsigned-review/${thesisId}`, {
      responseType: "blob",
    })
    return response.data
  },

  getSignedReview: async (thesisId) => {
    const response = await api.get(`/signed-review/${thesisId}`, {
      responseType: "blob",
    })
    return response.data
  },

  // Upload signed PDF
  uploadSignedReview: async (thesisId, formData) => {
    const response = await api.post(`/upload-signed-review/${thesisId}`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  },

  downloadReviewPdf: async (filename) => {
    const response = await api.get(`/download-review/${filename}`, {
      responseType: "blob",
    })
    return response.data
  },

  signedReview: async (thesisId, formData) => {
    const response = await api.post(`/signed-review/${thesisId}`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  },

  // Supervisor endpoints
  getSupervisorAssignedTheses: async () => {
    const response = await api.get("/assigned-theses-supervisor")
    return response.data
  },

  getMyStudents: async () => {
    const response = await api.get("/my-students")
    return response.data
  },

  getSupervisorCompletedReviews: async () => {
    const response = await api.get("/completed-theses-supervisor")
    return response.data
  },

  submitSupervisorReview: async (thesisId, reviewData) => {
    const response = await api.post(`/submit-review-supervisor/${thesisId}`, reviewData)
    return response.data
  },

  getSupervisorUnsignedReview: async (thesisId) => {
    const response = await api.get(`/unsigned-review-supervisor/${thesisId}`, {
      responseType: "blob",
    })
    return response.data
  },

  uploadSupervisorSignedReview: async (thesisId, formData) => {
    const response = await api.post(`/upload-signed-review-supervisor/${thesisId}`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  },

  // Dean endpoints
  getDeanTheses: async () => {
    const response = await api.get("/dean/theses")
    return response.data
  },

  getDeanThesesReadyForSigning: async () => {
    const response = await api.get("/dean/theses-ready-for-signing")
    return response.data
  },

  getDeanSignedTheses: async () => {
    const response = await api.get("/dean/signed-theses")
    return response.data
  },

  getDeanUnsignedReview: async (thesisId) => {
    const response = await api.get(`/dean/unsigned-review-dean/${thesisId}`, {
      responseType: "blob",
    })
    return response.data
  },

  getDeanSignedReview: async (thesisId) => {
    const response = await api.get(`/dean/signed-review-dean/${thesisId}`, {
      responseType: "blob",
    })
    return response.data
  },

  uploadDeanSignedReview: async (thesisId, formData) => {
    const response = await api.post(`/dean/upload-signed-review-dean/${thesisId}`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  },

  downloadDeanSignedReview: async (thesisId) => {
    const response = await api.get(`/dean/download-signed-review-dean/${thesisId}`, {
      responseType: "blob",
    })
    return response.data
  },

  approveDeanDefense: async (thesisId) => {
    const response = await api.post(`/dean/approve-defense/${thesisId}`)
    return response.data
  },

  // Admin endpoints
  getAllUsers: async () => {
    const response = await api.get("/users")
    return response.data
  },

  getAllTheses: async () => {
    const response = await api.get("/theses")
    return response.data
  },

  getApprovedReviewers: async () => {
    const response = await api.get("/users")
    const users = response.data
    return users.filter((user) => user.role === "reviewer")
  },

  assignReviewer: async (studentId, reviewerId) => {
    const response = await api.post("/assign-thesis", {
      studentId: studentId,
      reviewerId: reviewerId,
    })
    return response.data
  },

  reassignReviewer: async (thesisId, oldReviewerId, newReviewerId) => {
    const response = await api.patch("/reassign-thesis", {
      thesisId: thesisId,
      oldReviewerId: oldReviewerId,
      newReviewerId: newReviewerId,
    })
    return response.data
  },

  approveReviewer: async (reviewerId) => {
    const response = await api.patch(`/reviewers/${reviewerId}/approve`)
    return response.data
  },

  declineReviewer: async (reviewerId) => {
    const response = await api.patch(`/reviewers/${reviewerId}/reject`)
    return response.data
  },

  deleteUser: async (userId) => {
    const response = await api.delete(`/users/${userId}`)
    return response.data
  },

  assignThesisTeam: async (assignmentData) => {
    const response = await api.post("/assign-thesis-team", assignmentData)
    return response.data
  },

  getConsultantAssignedTheses: async () => {
    const response = await api.get("/assigned-theses-consultant")
    return response.data
  },

  getConsultantCompletedReviews: async () => {
    const response = await api.get("/completed-theses-consultant")
    return response.data
  },

  submitConsultantReview: async (thesisId, reviewData) => {
    const response = await api.post(`/submit-review-consultant/${thesisId}`, reviewData)
    return response.data
  },

  reReviewThesis: async (thesisId) => {
    const response = await api.post(`/re-review-consultant/${thesisId}`)
    return response.data
  },

  getUnsignedConsultantReview: async (thesisId) => {
    const response = await api.get(`/unsigned-review-consultant/${thesisId}`)
    return response.data
  },

  uploadSignedConsultantReview: async (thesisId, file) => {
    const formData = new FormData()
    formData.append("file", file)
    const response = await api.post(`/signed-review-consultant/${thesisId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    return response.data
  },

  getAvailableSupervisors: async () => {
    const response = await api.get("/supervisor-requests/available-supervisors")
    return response.data
  },

  requestSupervisor: async (supervisorId, message) => {
    const response = await api.post("/supervisor-requests/request", {
      supervisorId,
      message,
    })
    return response.data
  },

  getMySupervisorRequests: async () => {
    const response = await api.get("/supervisor-requests/my-requests")
    return response.data
  },

  cancelSupervisorRequest: async (requestId) => {
    const response = await api.delete(`/supervisor-requests/${requestId}`)
    return response.data
  },

  respondToSupervisorRequest: async (requestId, action, declineReason = "") => {
    const payload = { action }
    if (action === "decline") {
      payload.declineReason = declineReason
    }
    const response = await api.patch(`/supervisor-requests/${requestId}/respond`, payload)
    return response.data
  },

  getAvailableConsultants: async () => {
    const response = await api.get("/supervisor-requests/available-consultants")
    return response.data
  },

  // Supervisor topic management endpoints
  getPendingTopicApprovals: async () => {
    const response = await api.get("/pending-approvals")
    return response.data
  },

  proposeTopicToStudent: async (studentId, proposedTopic) => {
    const response = await api.put(`/${studentId}/propose-topic-supervisor`, { proposedTopic })
    return response.data
  },

  approveStudentTopic: async (studentId, approved, comments) => {
    const response = await api.put(`/${studentId}/approve-topic-supervisor`, { approved, comments })
    return response.data
  },
}

export const thesisAPI = realThesisAPI

export default api
