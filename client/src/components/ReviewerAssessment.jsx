import { useState, useEffect, useCallback } from "react"
import { FiDownload, FiSave, FiUser, FiEye } from "react-icons/fi"
import { Toast, useToast } from "./Toast"
import { thesisAPI } from "../services/api"

const ReviewerAssessment = ({ thesisId, student, mode = "new", onClose }) => {
  const [thesis, setThesis] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  const [assessment, setAssessment] = useState({
    topicCorrespondence: "",
    relevanceJustification: "",
    subjectAreaCorrespondence: "",
    researchMethodsCorrectness: "",
    materialPresentation: "",
    assertionsJustification: "",
    researchValue: "",
  })

  const [conclusion, setConclusion] = useState({
    finalAssessment: "",
    isComplete: false,
    isDeserving: false,
  })

  const [finalGrade, setFinalGrade] = useState("")

  const assessmentCriteria = [
    {
      key: "topicCorrespondence",
      labelRu: "Соответствие содержания работы утвержденной теме ВКР",
      labelEn: "Degree to which the contents of the thesis correspond to its declared topic",
    },
    {
      key: "relevanceJustification",
      labelRu: "Обоснование актуальности темы, корректность постановки цели и задач исследования",
      labelEn: "Justification for the relevance of the topic; correctness of the set research goals and objectives",
    },
    {
      key: "subjectAreaCorrespondence",
      labelRu: "Соответствие работы направлению, профилю и специализации подготовки",
      labelEn: "Degree to which the thesis corresponds to the student's subject area, major, and specialization",
    },
    {
      key: "researchMethodsCorrectness",
      labelRu: "Корректность выбора использования методов исследования",
      labelEn: "Correctness of the chosen research methods",
    },
    {
      key: "materialPresentation",
      labelRu: "Качество, логика и полнота изложения представленных материалов",
      labelEn: "Quality, logic, and fullness with which the collected material is presented",
    },
    {
      key: "assertionsJustification",
      labelRu: "Обоснованность положений, выносимых на защиту",
      labelEn: "Degree of justification for the assertions that are presented for defense",
    },
    {
      key: "researchValue",
      labelRu: "Научная и/или практическая значимость работы",
      labelEn: "Scientific and/or practical value of the research",
    },
  ]

  const gradeOptions = [
    { value: "high", label: "высокая / high" },
    { value: "above_average", label: "выше среднего / above average" },
    { value: "average", label: "средняя / average" },
    { value: "below_average", label: "ниже среднего / below average" },
    { value: "low", label: "низкая / low" },
  ]

  const finalGradeOptions = ["Excellent (5A)", "Excellent (5B)", "Good (4)", "Satisfactory (3)", "Unsatisfactory (2)"]

  const fetchThesisDetails = useCallback(async () => {
    try {
      const assignedTheses = await thesisAPI.getAssignedTheses()
      const completedTheses = await thesisAPI.getCompletedReviews()
      const allTheses = [...assignedTheses, ...completedTheses]

      const currentThesis = allTheses.find((t) => t._id === thesisId)

      if (currentThesis) {
        setThesis(currentThesis)
        if (currentThesis.assessment) {
          setAssessment(currentThesis.assessment)
        }
        if (currentThesis.conclusion) {
          setConclusion(currentThesis.conclusion)
        }
        if (currentThesis.finalGrade) {
          setFinalGrade(currentThesis.finalGrade)
        }
      }
    } catch (error) {
      showToast("Failed to fetch thesis details", "error")
    } finally {
      setIsLoading(false)
    }
  }, [thesisId, showToast])

  useEffect(() => {
    fetchThesisDetails()
  }, [fetchThesisDetails])

  const handleDownload = async () => {
    try {
      const blob = await thesisAPI.downloadThesis(thesisId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${thesis.title}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      showToast("Download started", "success")
    } catch (error) {
      showToast("Failed to download thesis", "error")
    }
  }

  const handleAssessmentChange = (key, value) => {
    setAssessment((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleConclusionChange = (key, value) => {
    setConclusion((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const isAssessmentComplete = () => {
    return Object.values(assessment).every((value) => value !== "")
  }

  const isConclusionComplete = () => {
    return conclusion.finalAssessment.trim() !== ""
  }

  const canSubmitReview = () => {
    return isAssessmentComplete() && isConclusionComplete() && finalGrade !== ""
  }

  const handleSubmitReview = async () => {
    if (!canSubmitReview()) {
      showToast("Please complete all assessment criteria and conclusion before submitting", "error")
      return
    }

    try {
      setIsSubmitting(true)
      await thesisAPI.submitReview(thesisId, {
        grade: finalGrade,
        assessment,
        conclusion,
      })
      showToast(mode === "edit" ? "Review updated successfully!" : "Review submitted successfully!", "success")

      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error) {
      showToast(error.response?.data?.error || "Failed to submit review", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!thesis) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-400 mb-2">Thesis not found</h3>
        <p className="text-gray-500">The requested thesis could not be found.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <Toast {...toast} onClose={hideToast} />

      {/* Fixed Header */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6 flex-shrink-0">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white mb-4">{thesis.title}</h2>
            <div className="flex items-center gap-3">
              <FiUser className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-gray-400 text-sm">Student</p>
                <p className="text-white font-medium">{student.fullName}</p>
                <p className="text-gray-400 text-sm">{student.institution}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Submitted on</p>
            <p className="text-white font-medium mb-4">{new Date(thesis.submissionDate).toLocaleDateString()}</p>
            {/* Download and View PDF buttons positioned on the right */}
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <FiDownload className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={() => window.open(`http://localhost:8000${thesis.fileUrl}`, "_blank")}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
              >
                <FiEye className="w-4 h-4" />
                View PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Assessment Criteria */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-6">Assessment Criteria</h3>
          <div className="space-y-6">
            {assessmentCriteria.map((criterion) => (
              <div key={criterion.key} className="space-y-2">
                <div>
                  <p className="text-white font-medium text-sm">{criterion.labelRu}</p>
                  <p className="text-gray-400 text-xs">{criterion.labelEn}</p>
                </div>
                <select
                  value={assessment[criterion.key]}
                  onChange={(e) => handleAssessmentChange(criterion.key, e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                >
                  <option value="">Select grade</option>
                  {gradeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Conclusion Section */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-6">Conclusion / Заключение</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-gray-300 text-sm mb-2">
                Final assessment of the thesis / Итоговая оценка ВКР
              </label>
              <textarea
                value={conclusion.finalAssessment}
                onChange={(e) => handleConclusionChange("finalAssessment", e.target.value)}
                placeholder="Enter your final assessment..."
                rows={4}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={conclusion.isComplete}
                    onChange={(e) => handleConclusionChange("isComplete", e.target.checked)}
                    className="w-4 h-4 text-white bg-gray-700 border-gray-600 rounded focus:ring-white"
                  />
                  <span className="text-gray-300 text-sm">
                    The present graduation thesis was found to be complete / Данная выпускная квалификационная работа
                    является законченной работой
                  </span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={conclusion.isDeserving}
                    onChange={(e) => handleConclusionChange("isDeserving", e.target.checked)}
                    className="w-4 h-4 text-white bg-gray-700 border-gray-600 rounded focus:ring-white"
                  />
                  <span className="text-gray-300 text-sm">
                    The author is deserving of being awarded a degree / Автор заслуживает присуждения квалификации
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Final Grade and Submit */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Final Grade</h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-gray-300 text-sm mb-2">Select Final Grade</label>
              <select
                value={finalGrade}
                onChange={(e) => setFinalGrade(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                disabled={!isAssessmentComplete() || !isConclusionComplete()}
              >
                <option value="">Select grade</option>
                {finalGradeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {(!isAssessmentComplete() || !isConclusionComplete()) && (
                <p className="text-yellow-400 text-xs mt-1">
                  Complete all assessment criteria and conclusion to enable grade selection
                </p>
              )}
            </div>
            <button
              onClick={handleSubmitReview}
              disabled={isSubmitting || !canSubmitReview()}
              className="bg-white text-black font-medium py-2 px-6 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <FiSave className="w-5 h-5" />
                  {mode === "edit" ? "Update Review" : "Submit Review"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewerAssessment
