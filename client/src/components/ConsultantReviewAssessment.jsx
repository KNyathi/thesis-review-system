import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { FiDownload, FiSend, FiAlertCircle } from "react-icons/fi"
import { Toast, useToast } from "./Toast"
import { thesisAPI } from "../services/api"
import { i18n } from "../utils/i18n.ts"

const ConsultantReviewAssessment = ({ thesisId, thesis, onClose }) => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [assessment, setAssessment] = useState("")
  const [comments, setComments] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reviewMode, setReviewMode] = useState("request_revisions")
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    loadThesisPDF()
  }, [thesisId])

  const loadThesisPDF = async () => {
    try {
      setIsLoading(true)
      const blob = await thesisAPI.viewThesis(thesisId)
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
    } catch (error) {
      console.error("Error loading thesis PDF:", error)
      showToast(i18n.errors.failedToLoadPdf, "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      const blob = await thesisAPI.downloadThesis(thesisId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${thesis.title || "thesis"}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      showToast(i18n.success.downloadComplete, "success")
    } catch (error) {
      console.error("Error downloading thesis:", error)
      showToast(i18n.errors.failedToDownload, "error")
    }
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()

    if (reviewMode === "request_revisions" && !comments.trim()) {
      showToast(i18n.errors.emptyComments, "error")
      return
    }

    if (reviewMode === "approve" && (!assessment.trim() || !comments.trim())) {
      showToast(i18n.errors.emptyAssessmentOrComments, "error")
      return
    }

    try {
      setIsSubmitting(true)
      console.log("Submitting review with mode:", reviewMode)

      const reviewData = {
        comments: comments.trim(),
        assessment: reviewMode === "approve" ? assessment.trim() : undefined,
        isFinalApproval: reviewMode === "approve",
      }

      console.log("Review data being sent:", reviewData)

      const response = await thesisAPI.submitConsultantReview(thesisId, reviewData)

      console.log("Server response:", response)

      showToast(reviewMode === "approve" ? i18n.success.reviewApproved : i18n.success.revisionsRequested, "success")

      if (reviewMode === "approve" && response.redirectToSign) {
        setTimeout(() => {
          navigate(`/consultant-sign/${thesisId}`)
        }, 500)
      } else {
        setTimeout(() => {
          onClose()
        }, 1500)
      }
    } catch (error) {
      console.error("Error submitting review:", error)

      let errorMessage = i18n.errors.failedToSubmitReview

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.message) {
        errorMessage = error.message
      }

      showToast(errorMessage, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Toast {...toast} onClose={hideToast} />

      <div className="flex-1 overflow-y-auto">
        {/* PDF Viewer Section */}
        <div className="bg-white p-4 mb-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{thesis.title}</h2>
                <p className="text-gray-600 text-sm mt-1">Студент: {thesis.student?.fullName}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  <FiDownload className="w-4 h-4" />
                  Скачать работу
                </button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden" style={{ height: "400px" }}>
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-[#372579] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">Загрузка PDF...</p>
                  </div>
                </div>
              ) : pdfUrl ? (
                <iframe src={pdfUrl} className="w-full h-full" title="Thesis PDF" />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <FiAlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">Не удалось загрузить PDF</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Review Assessment Form */}
        <div className="bg-white p-4">
          <div className="max-w-6xl mx-auto">
            <form onSubmit={handleSubmitReview} className="space-y-6">
              {/* Review Mode Selection */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">Тип консультации</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reviewMode"
                      value="request_revisions"
                      checked={reviewMode === "request_revisions"}
                      onChange={(e) => {
                        setReviewMode(e.target.value)
                        setAssessment("")
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-700 text-sm">Отправить на доработку</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reviewMode"
                      value="approve"
                      checked={reviewMode === "approve"}
                      onChange={(e) => setReviewMode(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-700 text-sm">Одобрить с заключением</span>
                  </label>
                </div>
              </div>

              {/* Assessment (only for approval) */}
              {reviewMode === "approve" && (
                <div>
                  <label htmlFor="assessment" className="block text-sm font-medium text-gray-700 mb-2">
                    Заключение консультанта *
                  </label>
                  <input
                    id="assessment"
                    type="text"
                    value={assessment}
                    onChange={(e) => setAssessment(e.target.value)}
                    placeholder="Например: Работа соответствует требованиям / Рекомендуется к защите"
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent transition-all"
                    required={reviewMode === "approve"}
                  />
                </div>
              )}

              {/* Comments */}
              <div>
                <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-2">
                  {reviewMode === "approve" ? "Комментарии и замечания" : "Замечания для доработки"} *
                </label>
                <textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={
                    reviewMode === "approve"
                      ? "Введите ваши консультативные замечания..."
                      : "Введите детальные замечания для исправления..."
                  }
                  rows="6"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:ring-offset-2 transition-all resize-none"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-100 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#372579] text-white font-medium py-3 px-4 rounded-lg hover:bg-[#2a1d5f] focus:outline-none focus:ring-2 focus:ring-[#372579] focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <FiSend className="w-5 h-5" />
                      Отправить консультацию
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConsultantReviewAssessment
