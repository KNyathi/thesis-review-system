import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:8000/api/v1";

// Axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Real API calls
const realThesisAPI = {
  // Student endpoints
  submitThesis: async (formData) => {
    const response = await api.post("/submit-thesis", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  getMyThesis: async () => {
    const response = await api.get("/my-thesis");
    return response.data;
  },

  // Reviewer endpoints
  getAssignedTheses: async () => {
    const response = await api.get("/assigned-theses");
    return response.data;
  },

  getCompletedReviews: async () => {
    const response = await api.get("/completed-theses");
    return response.data;
  },

  submitReview: async (thesisId, reviewData) => {
    const response = await api.post(`/submit-review/${thesisId}`, reviewData, {
      responseType: "blob",
    });

    //THE RESPONSE HERE IS THE CREATED PDF FILE (TO BE SIGNED)
    return response.data;
  },

  reReviewThesis: async (thesisId) => {
    const response = await api.post(`/re-review/${thesisId}`);
    return response.data;
  },

  downloadReviewPdf: async (filename) => {
    const response = await api.get(`/download-review/${filename}`, {
      responseType: "blob",
    });
    return response.data;
  },

  downloadThesis: async (thesisId) => {
    const response = await api.get(`/thesis/${thesisId}/download`, {
      responseType: "blob",
    });
    return response.data;
  },

  downloadSignedReview: async (thesisId) => {
    const response = await api.get(`/download-signed-review/${thesisId}`, {
      responseType: "blob",
    });
    return response.data;
  },

  signedReview: async (thesisId, formData) => {
    const response = await api.post(`/signed-review/${thesisId}`, formData, {
       headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },


  viewThesis: async (thesisId) => {
    const response = await api.get(`/view-pdf/${thesisId}`, {
      responseType: "blob",
    });
    return response.data;
  },

  // Admin endpoints
  getAllUsers: async () => {
    const response = await api.get("/users");
    return response.data;
  },

  getAllTheses: async () => {
    const response = await api.get("/theses");
    return response.data;
  },

  getPendingReviewers: async () => {
    const response = await api.get("/users");
    const users = response.data;
    return users.filter((user) => user.role === "reviewer" && !user.isApproved);
  },

  getApprovedReviewers: async () => {
    const response = await api.get("/users");
    const users = response.data;
    return users.filter((user) => user.role === "reviewer" && user.isApproved);
  },

  assignReviewer: async (studentId, reviewerId) => {
    const response = await api.post("/assign-thesis", {
      studentId: studentId,
      reviewerId: reviewerId,
    });
    return response.data;
  },

  reassignReviewer: async (thesisId, oldReviewerId, newReviewerId) => {
    const response = await api.patch("/reassign-thesis", {
      thesisId: thesisId,
      oldReviewerId: oldReviewerId,
      newReviewerId: newReviewerId,
    });
    return response.data;
  },

  approveReviewer: async (reviewerId) => {
    const response = await api.patch(`/reviewers/${reviewerId}/approve`);
    return response.data;
  },

  declineReviewer: async (reviewerId) => {
    const response = await api.patch(`/reviewers/${reviewerId}/reject`);
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },
};

// Export the real API directly since we're not using mock data
export const thesisAPI = realThesisAPI;

export default api;
