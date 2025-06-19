import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  FiUser,
  FiMail,
  FiBook,
  FiEdit,
  FiSave,
  FiX,
  FiLock,
  FiEye,
  FiEyeOff,
  FiLogOut,
  FiTrash2,
  FiAlertTriangle,
  FiInfo,
  FiPlus, // Add this import
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import Modal from "../components/Modal"
import api from "../services/api"

const ProfilePage = () => {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
    institution: "",
    faculty: "",
    group: "",
    subjectArea: "",
    educationalProgram: "",
    degreeLevel: "bachelors",
    thesisTopic: "",
    positions: [],
    position: "",
  })
  const [originalData, setOriginalData] = useState({}) // Store original data for comparison
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    if (user) {
      const userData = {
        fullName: user.fullName || "",
        email: user.email || "",
        institution: user.institution || "",
        faculty: user.faculty || "",
        group: user.group || "",
        subjectArea: user.subjectArea || "",
        educationalProgram: user.educationalProgram || "",
        degreeLevel: user.degreeLevel || "bachelors",
        thesisTopic: user.thesisTopic || "",
        positions: user.positions && user.positions.length > 0 ? user.positions : [""], // Ensure at least one empty position
        position: user.position || "",
      }
      setProfileData(userData)
      setOriginalData(userData) // Store original data
    }
  }, [user])

  const handleChange = (e) => {
    const { name, value } = e.target
    setProfileData((prev) => ({ ...prev, [name]: value }))
  }

  // Remove this function:
  // const handlePositionsChange = (e) => {
  //   const positions = e.target.value
  //     .split(",")
  //     .map((pos) => pos.trim())
  //     .filter(Boolean)
  //   setProfileData((prev) => ({ ...prev, positions }))
  // }

  // Check if any changes were made
  const hasChanges = () => {
    const currentData = { ...profileData }
    const original = { ...originalData }

    // Compare all fields
    return JSON.stringify(currentData) !== JSON.stringify(original)
  }

  const handleSaveProfile = async () => {
    // Check if any changes were made
    if (!hasChanges()) {
      showToast("No changes were made to save", "info")
      return
    }

    try {
      setIsLoading(true)

      // Only send changed fields to reduce payload
      const changedFields = {}
      Object.keys(profileData).forEach((key) => {
        if (JSON.stringify(profileData[key]) !== JSON.stringify(originalData[key])) {
          changedFields[key] = profileData[key]
        }
      })

      await api.patch("/profile", changedFields)

      // Refresh user data to get the latest information
      await refreshUser()

      // Update original data to current data
      setOriginalData({ ...profileData })

      showToast("Profile updated successfully!", "success")
      setIsEditing(false)
    } catch (error) {
      console.error("Profile update error:", error)
      showToast(error.response?.data?.error || "Failed to update profile", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelEdit = () => {
    // Reset to original data
    setProfileData({ ...originalData })
    setIsEditing(false)
  }

  const handlePasswordChange = (e) => {
    const { name, value } = e.target
    setPasswordData((prev) => ({ ...prev, [name]: value }))
  }

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast("New passwords do not match", "error")
      return
    }

    if (passwordData.newPassword.length < 6) {
      showToast("Password must be at least 6 characters long", "error")
      return
    }

    try {
      setIsChangingPassword(true)
      await api.patch("/password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })

      showToast("Password changed successfully!", "success")
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (error) {
      showToast(error.response?.data?.error || "Failed to change password", "error")
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showToast("Please enter your password to confirm deletion", "error")
      return
    }

    try {
      setIsDeletingAccount(true)
      await api.delete("/profile", {
        data: { password: deletePassword },
      })

      showToast("Account deleted successfully", "success")
      logout()
      navigate("/register", { replace: true })
    } catch (error) {
      showToast(error.response?.data?.error || "Failed to delete account", "error")
    } finally {
      setIsDeletingAccount(false)
      setShowDeleteModal(false)
      setDeletePassword("")
    }
  }

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  if (!user) {
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
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/${user.role}`)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-4 h-4" />
            Back to Dashboard
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

      {/* Content */}
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-semibold text-lg">
                {user.fullName
                  ?.split(" ")
                  .map((name) => name[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "U"}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">User Profile</h1>
            <p className="text-gray-400">Manage your account information</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Profile Information */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Profile Information</h2>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors text-sm"
                    >
                      <FiEdit className="w-4 h-4" />
                      Edit Profile
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                      >
                        <FiX className="w-4 h-4" />
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FiSave className="w-4 h-4" />
                        )}
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>
                {isEditing && (
                  <div className="mt-3 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FiInfo className="w-4 h-4 text-blue-400" />
                      <p className="text-blue-400 text-sm">
                        {hasChanges() ? "You have unsaved changes" : "No changes detected"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-4">
                {/* Email Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="email"
                      name="email"
                      value={profileData.email}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                      disabled
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      name="fullName"
                      value={profileData.fullName}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Institution */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Institution</label>
                  <div className="relative">
                    <FiBook className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      name="institution"
                      value={profileData.institution}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Student-specific fields */}
                {user.role === "student" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Faculty</label>
                        <input
                          type="text"
                          name="faculty"
                          value={profileData.faculty}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="Enter faculty"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Group</label>
                        <input
                          type="text"
                          name="group"
                          value={profileData.group}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="Enter group"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Subject Area</label>
                      <input
                        type="text"
                        name="subjectArea"
                        value={profileData.subjectArea}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="Enter subject area"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Educational Program</label>
                      <input
                        type="text"
                        name="educationalProgram"
                        value={profileData.educationalProgram}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="Enter educational program"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Degree Level</label>
                      <select
                        name="degreeLevel"
                        value={profileData.degreeLevel}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
                      >
                        <option value="bachelors">Bachelors</option>
                        <option value="masters">Masters</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Thesis Topic</label>
                      <input
                        type="text"
                        name="thesisTopic"
                        value={profileData.thesisTopic}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="Enter thesis topic"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
                      />
                    </div>
                  </>
                )}

                {/* Reviewer-specific fields */}
                {user.role === "reviewer" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Positions</label>
                    <div className="space-y-2">
                      {profileData.positions.map((position, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={position}
                            onChange={(e) => {
                              const newPositions = [...profileData.positions]
                              newPositions[index] = e.target.value
                              setProfileData((prev) => ({ ...prev, positions: newPositions }))
                            }}
                            disabled={!isEditing}
                            placeholder="Enter position"
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
                          />
                          {isEditing && profileData.positions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newPositions = profileData.positions.filter((_, i) => i !== index)
                                setProfileData((prev) => ({ ...prev, positions: newPositions }))
                              }}
                              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                              <FiX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}

                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileData((prev) => ({
                              ...prev,
                              positions: [...prev.positions, ""],
                            }))
                          }}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          <FiPlus className="w-4 h-4" />
                          Add Position
                        </button>
                      )}

                      {profileData.positions.length === 0 && (
                        <p className="text-gray-500 text-sm">No positions added</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Admin-specific fields */}
                {user.role === "admin" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Position</label>
                    <input
                      type="text"
                      name="position"
                      value={profileData.position}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Enter position"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Account Management */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-6 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">Account Management</h2>
                <p className="text-gray-400 text-sm">Manage your account security and settings</p>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-center mb-6">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center">
                    <FiLock className="w-8 h-8 text-gray-400" />
                  </div>
                </div>

                <p className="text-center text-gray-300 mb-6">Manage your account security and settings</p>

                <div className="space-y-4">
                  <div className="text-sm text-gray-400">
                    <p>• Change your password to keep your account secure</p>
                    <p>• Delete your account permanently (this action cannot be undone)</p>
                  </div>
                </div>
              </div>

              {/* Change Password Section */}
              <div className="border-t border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Change Password</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Current Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type={showPasswords.current ? "text" : "password"}
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-10 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("current")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showPasswords.current ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type={showPasswords.new ? "text" : "password"}
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-10 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("new")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showPasswords.new ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type={showPasswords.confirm ? "text" : "password"}
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-10 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("confirm")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showPasswords.confirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleChangePassword}
                    disabled={
                      isChangingPassword ||
                      !passwordData.currentPassword ||
                      !passwordData.newPassword ||
                      !passwordData.confirmPassword
                    }
                    className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isChangingPassword ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <FiLock className="w-5 h-5" />
                        Change Password
                      </>
                    )}
                  </button>

                  {/* Delete Account Button */}
                  <div className="pt-4 border-t border-gray-800">
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full bg-red-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <FiTrash2 className="w-5 h-5" />
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setDeletePassword("")
        }}
        title="Delete Account"
        size="medium"
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
              <FiAlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Delete Account</h3>
              <p className="text-gray-400">This action cannot be undone</p>
            </div>
          </div>

          <p className="text-gray-300 mb-6">
            Are you sure you want to delete your account? This will permanently remove your account and all associated
            data.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Enter your password to confirm deletion
            </label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowDeleteModal(false)
                setDeletePassword("")
              }}
              className="flex-1 bg-gray-700 text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount || !deletePassword}
              className="flex-1 bg-red-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeletingAccount ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <FiTrash2 className="w-5 h-5" />
                  Delete Account
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ProfilePage
