import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { FiDownload, FiSend, FiAlertCircle, FiCheck, FiX, FiLoader } from "react-icons/fi"
import { Toast, useToast } from "./Toast"
import { thesisAPI } from "../services/api"

const ConsultantReviewAssessment = ({ thesisId, thesis, onClose }) => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [comments, setComments] = useState("")
  const [assessment, setAssessment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reviewMode, setReviewMode] = useState("revisions") // 'revisions' or 'approve'
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
      showToast("Не удалось загрузить PDF работы", "error")
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
      showToast("Работа загружена успешно!", "success")
    } catch (error) {
      showToast("Не удалось загрузить работу", "error")
    }
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()

    if (reviewMode === "revisions" && !comments.trim()) {
      showToast("Пожалуйста, введите комментарий для отправки на доработку", "error")
      return
    }

    if (reviewMode === "approve" && !comments.trim()) {
      showToast("Пожалуйста, введите заключение для одобрения", "error")
      return
    }

    try {
      setIsSubmitting(true)

      if (reviewMode === "approve") {
        const reviewData = {
          comments: comments.trim(),
          assessment: assessment.trim(),
          isFinalApproval: true
        }
        
        const response = await thesisAPI.submitConsultantReview(thesisId, reviewData)
        
        showToast("Работа одобрена! Передана научному руководителю.", "success")
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        const reviewData = {
          comments: comments.trim(),
          isFinalApproval: false
        }
        
        await thesisAPI.submitConsultantReview(thesisId, reviewData)
        showToast("Работа отправлена на доработку", "success")
        setTimeout(() => {
          onClose()
        }, 1500)
      }
    } catch (error) {
      console.error("Error submitting review:", error)
      const errorMsg = error.response?.data?.error || "Не удалось отправить консультацию"
      showToast(errorMsg, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Toast {...toast} onClose={hideToast} />

      <div className="flex-1 overflow-y-auto p-4">
        {/* PDF Viewer Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{thesis.title}</h2>
                <p className="text-gray-600 text-sm mt-1">Студент: {thesis.student?.fullName}</p>
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                <FiDownload className="w-4 h-4" />
                Скачать работу
              </button>
            </div>
          </div>

          <div className="p-4">
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
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Консультирование работы</h3>
            <p className="text-gray-600 text-sm mt-1">Выберите действие и заполните форму</p>
          </div>

          <form onSubmit={handleSubmitReview} className="p-4 space-y-6">
            {/* Review Mode Selection */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-3">Действие</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reviewMode"
                    value="revisions"
                    checked={reviewMode === "revisions"}
                    onChange={() => {
                      setReviewMode("revisions")
                      setAssessment("")
                    }}
                    className="w-4 h-4 text-[#372579]"
                  />
                  <span className="text-gray-700 text-sm flex items-center gap-1">
                    <FiX className="w-4 h-4 text-red-500" />
                    Отправить на доработку
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reviewMode"
                    value="approve"
                    checked={reviewMode === "approve"}
                    onChange={() => setReviewMode("approve")}
                    className="w-4 h-4 text-[#372579]"
                  />
                  <span className="text-gray-700 text-sm flex items-center gap-1">
                    <FiCheck className="w-4 h-4 text-green-500" />
                    Одобрить и передать руководителю
                  </span>
                </label>
              </div>
            </div>

            {/* Assessment (only for approval) */}
            {reviewMode === "approve" && (
              <div>
                <label htmlFor="assessment" className="block text-sm font-medium text-gray-700 mb-2">
                  Заключение консультанта
                </label>
                <textarea
                  id="assessment"
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  rows={3}
                  placeholder="Введите заключение по работе (например: Работа соответствует требованиям, рекомендуется к передаче руководителю)"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent transition-all resize-none"
                />
              </div>
            )}

            {/* Comments */}
            <div>
              <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-2">
                {reviewMode === "approve" ? "Заключительный комментарий" : "Замечания для доработки"} *
              </label>
              <textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={
                  reviewMode === "approve"
                    ? "Введите ваше заключение по работе..."
                    : "Введите детальные замечания для исправления..."
                }
                rows="6"
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent transition-all resize-none"
                required
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
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
                    {reviewMode === "approve" ? "Одобрить и передать" : "Отправить на доработку"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ConsultantReviewAssessment
