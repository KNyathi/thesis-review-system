import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { FiDownload, FiSave, FiUser, FiEye, FiPlus, FiX } from "react-icons/fi"
import { Toast, useToast } from "./Toast"
import { thesisAPI } from "../services/api"
import { useAuth } from "../context/AuthContext"

const ReviewerAssessment = ({ thesisId, student, mode = "new", onClose }) => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [thesis, setThesis] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  // Section I: Assessment criteria - Initialize as strings
  const [assessmentCriteria, setAssessmentCriteria] = useState({
    topicCorrespondence: "",
    relevanceJustification: "",
    subjectAreaCorrespondence: "",
    researchMethodsCorrectness: "",
    materialPresentation: "",
    assertionsJustification: "",
    researchValue: "",
    researchFindingsIntegration: "",
  })

  // Section II: Results of assessment - Initialize as strings
  const [questions, setQuestions] = useState(["", ""])
  const [advantages, setAdvantages] = useState("")
  const [disadvantages, setDisadvantages] = useState("")
  const [finalAssessment, setFinalAssessment] = useState("")
  const [isComplete, setIsComplete] = useState(false)
  const [degreeWorthy, setDegreeWorthy] = useState(false)
  const [finalGrade, setFinalGrade] = useState("")

  const gradeOptions = [
    { value: "высокая / high", label: "высокая / high" },
    {
      value: "выше среднего / above average",
      label: "выше среднего / above average",
    },
    { value: "средняя / average", label: "средняя / average" },
    {
      value: "ниже среднего / below average",
      label: "ниже среднего / below average",
    },
    { value: "низкая / low", label: "низкая / low" },
  ]

  const finalGradeOptions = [
    "Отлично (5A) / Excellent (5A)",
    "Отлично (5B) / Excellent (5B)",
    "Хорошо (4) / Good (4)",
    "Удовлетворительно (3) / Satisfactory (3)",
    "Неудовлетворительно (2) / Unsatisfactory (2)",
  ]

  const criteriaLabels = [
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
    {
      key: "researchFindingsIntegration",
      labelRu: "Внедрение результатов работы",
      labelEn: "Integration of the research findings",
    },
  ]

  const fetchThesisDetails = useCallback(async () => {
    try {
      const assignedTheses = await thesisAPI.getAssignedTheses()
      const completedTheses = await thesisAPI.getCompletedReviews()
      const allTheses = [...assignedTheses, ...completedTheses]

      const currentThesis = allTheses.find((t) => t._id === thesisId)

      if (currentThesis) {
        setThesis(currentThesis)

        // Load existing assessment data if available
        if (currentThesis.assessment) {
          const assessment = currentThesis.assessment

          // Section I - Ensure all values are strings
          if (assessment.section1) {
            const section1 = {}
            Object.keys(assessmentCriteria).forEach((key) => {
              section1[key] = assessment.section1[key] || ""
            })
            setAssessmentCriteria(section1)
          }

          // Section II - Ensure all values are strings
          if (assessment.section2) {
            setQuestions(assessment.section2.questions || ["", ""])
            setAdvantages(assessment.section2.advantages || "")
            setDisadvantages(assessment.section2.disadvantages || "")
            setFinalAssessment(assessment.section2.conclusion?.finalAssessment || "")
            setIsComplete(assessment.section2.conclusion?.isComplete || false)
            setDegreeWorthy(assessment.section2.conclusion?.degreeWorthy || "")
          }
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

  const handleViewPDF = async () => {
    try {
      const blob = await thesisAPI.viewThesis(thesisId)
      const blobUrl = URL.createObjectURL(blob)

      const newWindow = window.open("", "_blank")
      if (newWindow) {
        newWindow.document.open()
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
        `)
        newWindow.document.close()
        newWindow.focus()
      } else {
        showToast("Popup blocked - please allow popups", "warning")
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
    } catch (error) {
      showToast("Failed to open thesis", "error")
    }
  }

  const handleCriteriaChange = (key, value) => {
    setAssessmentCriteria((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleQuestionChange = (index, value) => {
    const newQuestions = [...questions]
    newQuestions[index] = value
    setQuestions(newQuestions)
  }

  const addQuestion = () => {
    setQuestions([...questions, ""])
  }

  const removeQuestion = (index) => {
    if (questions.length > 2) {
      setQuestions(questions.filter((_, i) => i !== index))
    }
  }

  const isSection1Complete = () => {
    return Object.values(assessmentCriteria).every((value) => value && value.trim() !== "")
  }

  const isSection2Complete = () => {
    const validQuestions = questions.filter((q) => q && q.trim() !== "").length >= 2
    const validAdvantages = Array.isArray(advantages)
      ? advantages.some((adv) => adv && adv.trim() !== "")
      : advantages && advantages.trim() !== ""
    const validDisadvantages = Array.isArray(disadvantages)
      ? disadvantages.some((dis) => dis && dis.trim() !== "")
      : disadvantages && disadvantages.trim() !== ""

    return (
      validQuestions &&
      validAdvantages &&
      validDisadvantages &&
      finalAssessment &&
      finalAssessment.trim() !== "" &&
      degreeWorthy &&
      (typeof degreeWorthy === "string" ? degreeWorthy.trim() !== "" : true)
    )
  }

  const canSubmitReview = () => {
    return isSection1Complete() && isSection2Complete() && finalGrade && finalGrade.trim() !== ""
  }

  const handleSubmitReview = async () => {
    if (!canSubmitReview()) {
      showToast("Please complete all sections before submitting", "error")
      return
    }

    // Check profile completeness
    const requiredProfileFields = [
      { name: "positions", type: "array" },
      { name: "fullName", type: "string" },
      { name: "institution", type: "string" },
    ]

    const missingFields = requiredProfileFields.filter((field) => {
      const value = user[field.name]
      if (field.type === "array") {
        return !value || value.length === 0
      } else if (field.type === "string") {
        return !value || (typeof value === "string" && value.trim() === "")
      }
      return !value
    })

    if (missingFields.length > 0) {
      showToast(`Please complete your profile first (missing: ${missingFields.map((f) => f.name).join(", ")})`, "error")
      return
    }

    try {
      setIsSubmitting(true)

      const reviewData = {
        grade: finalGrade,
        assessment: {
          section1: assessmentCriteria,
          section2: {
            questions: questions.filter((q) => q && q.trim() !== ""),
            advantages: advantages || "",
            disadvantages: disadvantages || "",
            conclusion: {
              finalAssessment: finalAssessment || "",
              isComplete,
              degreeWorthy: degreeWorthy || "",
            },
          },
        },
      }

      const response = await thesisAPI.submitReview(thesisId, reviewData)
      showToast(
        mode === "edit"
          ? "Review updated successfully! Redirecting to sign..."
          : "Review submitted successfully! Redirecting to sign...",
        "success",
      )

      // Close modal first
      onClose()

      // Then redirect to sign page
      setTimeout(() => {
        navigate(`/sign/${thesisId}`)
      }, 1000)
    } catch (error) {
      showToast(error.response?.data?.error || "Failed to submit review", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if this is a completed review (read-only mode)
  const isReadOnly = thesis && thesis.status === "evaluated"

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
            {isReadOnly && (
              <div className="mt-4 px-3 py-2 bg-green-600 text-white rounded-lg inline-block">
                <span className="text-sm font-medium">Review Completed - Final Grade: {thesis.finalGrade}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Submitted on</p>
            <p className="text-white font-medium mb-4">{new Date(thesis.submissionDate).toLocaleDateString()}</p>
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <FiDownload className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={handleViewPDF}
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
        {/* Section I: Assessment Criteria */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-6">РАЗДЕЛ I. Оценка ВКР / Assessment of the thesis</h3>
          <div className="space-y-6">
            {criteriaLabels.map((criterion) => (
              <div key={criterion.key} className="space-y-2">
                <div>
                  <p className="text-white font-medium text-sm">{criterion.labelRu}</p>
                  <p className="text-gray-400 text-xs">{criterion.labelEn}</p>
                </div>
                <select
                  value={assessmentCriteria[criterion.key] || ""}
                  onChange={(e) => handleCriteriaChange(criterion.key, e.target.value)}
                  disabled={isReadOnly}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Выберите оценку / Select grade</option>
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

        {/* Section II: Results of Assessment */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-6">
            РАЗДЕЛ II. Результирующая часть отзыва / Results of the assessment
          </h3>

          {/* Questions */}
          <div className="space-y-4 mb-6">
            <div>
              <h4 className="text-white font-medium mb-2">Вопросы / Questions</h4>
              <p className="text-gray-400 text-sm mb-4">
                Необходимо указать не менее 2 вопросов. / You must include at least 2 questions.
              </p>
            </div>

            {questions.map((question, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-gray-300 text-sm mb-1">
                    Вопрос {index + 1} / Question {index + 1}
                  </label>
                  <textarea
                    value={question || ""}
                    onChange={(e) => handleQuestionChange(index, e.target.value)}
                    placeholder="Введите вопрос / Enter question"
                    rows={2}
                    disabled={isReadOnly}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                {questions.length > 2 && !isReadOnly && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="mt-6 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {!isReadOnly && (
              <button
                type="button"
                onClick={addQuestion}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <FiPlus className="w-4 h-4" />
                Добавить вопрос / Add question
              </button>
            )}
          </div>

          {/* Advantages */}
          <div className="mb-6">
            <label className="block text-gray-300 text-sm mb-2">Достоинства / Advantages</label>
            <textarea
              value={advantages || ""}
              onChange={(e) => setAdvantages(e.target.value)}
              placeholder="Укажите достоинства работы / Specify advantages of the work"
              rows={4}
              disabled={isReadOnly}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Disadvantages */}
          <div className="mb-6">
            <label className="block text-gray-300 text-sm mb-2">Недостатки, замечания / Disadvantages, critique</label>
            <textarea
              value={disadvantages || ""}
              onChange={(e) => setDisadvantages(e.target.value)}
              placeholder="Укажите недостатки и замечания / Specify disadvantages and critique"
              rows={4}
              disabled={isReadOnly}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Conclusion */}
          <div className="space-y-4">
            <h4 className="text-white font-medium">Заключение / Conclusion</h4>

            <div>
              <label className="block text-gray-300 text-sm mb-2">
                Итоговая оценка ВКР / Final assessment of the thesis
              </label>
              <textarea
                value={finalAssessment || ""}
                onChange={(e) => setFinalAssessment(e.target.value)}
                placeholder="Введите итоговую оценку / Enter final assessment"
                rows={3}
                disabled={isReadOnly}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isComplete}
                    onChange={(e) => setIsComplete(e.target.checked)}
                    disabled={isReadOnly}
                    className="w-4 h-4 text-white bg-gray-700 border-gray-600 rounded focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-gray-300 text-sm">
                    Данная выпускная квалификационная работа является законченной работой / The present graduation
                    thesis was found to be complete
                  </span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={degreeWorthy}
                    onChange={(e) => setDegreeWorthy(e.target.checked)}
                    disabled={isReadOnly}
                    className="w-4 h-4 text-white bg-gray-700 border-gray-600 rounded focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-gray-300 text-sm">
                    Автор заслуживает присуждения квалификации / The author is deserving of being awarded a degree
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Final Grade and Submit */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Итоговая оценка / Final Grade</h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-gray-300 text-sm mb-2">Выберите итоговую оценку / Select Final Grade</label>
              <select
                value={finalGrade || ""}
                onChange={(e) => setFinalGrade(e.target.value)}
                disabled={isReadOnly || !isSection1Complete() || !isSection2Complete()}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Выберите оценку / Select grade</option>
                {finalGradeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {!isReadOnly && (!isSection1Complete() || !isSection2Complete()) && (
                <p className="text-yellow-400 text-xs mt-1">
                  Завершите все разделы для выбора оценки / Complete all sections to enable grade selection
                </p>
              )}
            </div>
            {!isReadOnly && (
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
                    {mode === "edit" ? "Обновить отзыв / Update Review" : "Отправить отзыв / Submit Review"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewerAssessment
