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
  FiArrowLeft,
  FiCheck,
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import api from "../services/api"

const ProfilePage = () => {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const { toast, showToast, hideToast } = useToast()

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileData, setProfileData] = useState({})
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false)
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
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  useEffect(() => {
    if (user) {
      setProfileData({
        fullName: user.fullName || "",
        institution: user.institution || "",
        // Student fields
        faculty: user.faculty || "",
        group: user.group || "",
        subjectArea: user.subjectArea || "",
        educationalProgram: user.educationalProgram || "",
        degreeLevel: user.degreeLevel || "bachelors",
        thesisTopic: user.thesisTopic || "",
        // Reviewer fields
        positions: user.positions || [""],
        // Admin fields
        position: user.position || "",
      })
    }
  }, [user])

  const handleProfileChange = (field, value) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handlePositionsChange = (index, value) => {
    const newPositions = [...profileData.positions]
    newPositions[index] = value
    setProfileData((prev) => ({
      ...prev,
      positions: newPositions,
    }))
  }

  const addPosition = () => {
    setProfileData((prev) => ({
      ...prev,
      positions: [...prev.positions, ""],
    }))
  }

  const removePosition = (index) => {
    if (profileData.positions.length > 1) {
      const newPositions = profileData.positions.filter((_, i) => i !== index)
      setProfileData((prev) => ({
        ...prev,
        positions: newPositions,
      }))
    }
  }

  const handlePasswordChange = (field, value) => {
    setPasswordData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }))
  }

  const validatePassword = (password) => {
    const minLength = password.length >= 6
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)

    return {
      minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      isValid: minLength && hasUpperCase && hasLowerCase && hasNumbers,
    }
  }

  const handleUpdateProfile = async () => {
    try {
      setIsUpdatingProfile(true)

      // Prepare data based on user role
      let updateData = {
        fullName: profileData.fullName,
        institution: profileData.institution,
      }

      if (user.role === "student") {
        updateData = {
          ...updateData,
          faculty: profileData.faculty,
          group: profileData.group,
          subjectArea: profileData.subjectArea,
          educationalProgram: profileData.educationalProgram,
          degreeLevel: profileData.degreeLevel,
          thesisTopic: profileData.thesisTopic,
        }
      } else if (user.role === "reviewer") {
        updateData = {
          ...updateData,
          positions: profileData.positions.filter((pos) => pos.trim() !== ""),
        }
      } else if (user.role === "admin") {
        updateData = {
          ...updateData,
          position: profileData.position,
        }
      }

      await api.patch("/profile", updateData)
      await refreshUser()
      setIsEditingProfile(false)
      showToast("Profile updated successfully!", "success")
    } catch (error) {
      showToast(error.response?.data?.error || "Failed to update profile", "error")
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!passwordData.currentPassword) {
      showToast("Please enter your current password", "error")
      return
    }

    if (!passwordData.newPassword) {
      showToast("Please enter a new password", "error")
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast("New passwords do not match", "error")
      return
    }

    const passwordValidation = validatePassword(passwordData.newPassword)
    if (!passwordValidation.isValid) {
      showToast("Password does not meet requirements", "error")
      return
    }

    try {
      setIsUpdatingPassword(true)

      await api.patch("/password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
      setIsChangingPassword(false)
      showToast("Password changed successfully!", "success")
    } catch (error) {
      showToast(error.response?.data?.error || "Failed to change password", "error")
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const renderStudentFields = () => (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Faculty</label>
          <input
            type="text"
            value={profileData.faculty}
            onChange={(e) => handleProfileChange("faculty", e.target.value)}
            disabled={!isEditingProfile}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
            placeholder="Enter faculty"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Group</label>
          <input
            type="text"
            value={profileData.group}
            onChange={(e) => handleProfileChange("group", e.target.value)}
            disabled={!isEditingProfile}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
            placeholder="Enter group"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Subject Area</label>
        <input
          type="text"
          value={profileData.subjectArea}
          onChange={(e) => handleProfileChange("subjectArea", e.target.value)}
          disabled={!isEditingProfile}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
          placeholder="Enter subject area"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Educational Program</label>
        <input
          type="text"
          value={profileData.educationalProgram}
          onChange={(e) => handleProfileChange("educationalProgram", e.target.value)}
          disabled={!isEditingProfile}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
          placeholder="Enter educational program"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Degree Level</label>
        <select
          value={profileData.degreeLevel}
          onChange={(e) => handleProfileChange("degreeLevel", e.target.value)}
          disabled={!isEditingProfile}
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
          value={profileData.thesisTopic}
          onChange={(e) => handleProfileChange("thesisTopic", e.target.value)}
          disabled={!isEditingProfile}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
          placeholder="Enter thesis topic"
        />
      </div>
    </>
  )

  const renderReviewerFields = () => (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">Positions</label>
      <div className="space-y-2">
        {profileData.positions?.map((position, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={position}
              onChange={(e) => handlePositionsChange(index, e.target.value)}
              disabled={!isEditingProfile}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
              placeholder="Enter position"
            />
            {isEditingProfile && profileData.positions.length > 1 && (
              <button
                type="button"
                onClick={() => removePosition(index)}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FiX className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {isEditingProfile && (
          <button
            type="button"
            onClick={addPosition}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
          >
            Add Position
          </button>
        )}
      </div>
    </div>
  )

  const renderAdminFields = () => (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">Position</label>
      <input
        type="text"
        value={profileData.position}
        onChange={(e) => handleProfileChange("position", e.target.value)}
        disabled={!isEditingProfile}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
        placeholder="Enter position"
      />
    </div>
  )

  const passwordValidation = validatePassword(passwordData.newPassword)

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

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/${user.role}`)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <FiArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-xs">
                {user.fullName
                  ?.split(" ")
                  .map((name) => name[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "U"}
              </span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">{user.fullName}</p>
              <p className="text-gray-400 text-xs capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-semibold text-xl">
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

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Profile Information */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Profile Information</h2>
                {!isEditingProfile ? (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
                  >
                    <FiEdit className="w-4 h-4" />
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditingProfile(false)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                    >
                      <FiX className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateProfile}
                      disabled={isUpdatingProfile}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {isUpdatingProfile ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FiSave className="w-4 h-4" />
                      )}
                      Save Changes
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {/* Basic Information */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-3 py-2 text-gray-400 opacity-50"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={profileData.fullName}
                      onChange={(e) => handleProfileChange("fullName", e.target.value)}
                      disabled={!isEditingProfile}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
                      placeholder="Enter full name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Institution</label>
                  <div className="relative">
                    <FiBook className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={profileData.institution}
                      onChange={(e) => handleProfileChange("institution", e.target.value)}
                      disabled={!isEditingProfile}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50"
                      placeholder="Enter institution"
                    />
                  </div>
                </div>

                {/* Role-specific fields */}
                {user.role === "student" && renderStudentFields()}
                {user.role === "reviewer" && renderReviewerFields()}
                {user.role === "admin" && renderAdminFields()}
              </div>
            </div>

            {/* Password Change */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Change Password</h2>
                {!isChangingPassword ? (
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                  >
                    <FiLock className="w-4 h-4" />
                    Change Password
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsChangingPassword(false)
                        setPasswordData({
                          currentPassword: "",
                          newPassword: "",
                          confirmPassword: "",
                        })
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                    >
                      <FiX className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdatePassword}
                      disabled={isUpdatingPassword}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {isUpdatingPassword ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FiCheck className="w-4 h-4" />
                      )}
                      Update Password
                    </button>
                  </div>
                )}
              </div>

              {isChangingPassword ? (
                <div className="space-y-4">
                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Current Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type={showPasswords.current ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-10 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("current")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showPasswords.current ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type={showPasswords.new ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-10 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("new")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showPasswords.new ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type={showPasswords.confirm ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-10 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("confirm")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showPasswords.confirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Requirements */}
                  {passwordData.newPassword && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <p className="text-gray-300 text-sm mb-2">Password Requirements:</p>
                      <div className="space-y-1 text-xs">
                        <div
                          className={`flex items-center gap-2 ${
                            passwordValidation.minLength ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          <FiCheck className="w-3 h-3" />
                          At least 6 characters
                        </div>
                        <div
                          className={`flex items-center gap-2 ${
                            passwordValidation.hasUpperCase ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          <FiCheck className="w-3 h-3" />
                          At least one uppercase letter
                        </div>
                        <div
                          className={`flex items-center gap-2 ${
                            passwordValidation.hasLowerCase ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          <FiCheck className="w-3 h-3" />
                          At least one lowercase letter
                        </div>
                        <div
                          className={`flex items-center gap-2 ${
                            passwordValidation.hasNumbers ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          <FiCheck className="w-3 h-3" />
                          At least one number
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Password Match Indicator */}
                  {passwordData.confirmPassword && (
                    <div
                      className={`text-sm ${
                        passwordData.newPassword === passwordData.confirmPassword ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {passwordData.newPassword === passwordData.confirmPassword
                        ? "✓ Passwords match"
                        : "✗ Passwords do not match"}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FiLock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Click "Change Password" to update your password</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
