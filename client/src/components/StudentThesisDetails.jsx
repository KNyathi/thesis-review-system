import { FiUser, FiCalendar, FiCheck, FiX } from "react-icons/fi"
import Modal from "./Modal"

const StudentThesisDetails = ({ thesis, isOpen, onClose }) => {
  if (!thesis || !thesis.assessment) {
    return null
  }

  const { assessment, finalGrade, assignedReviewer } = thesis
  const { section1, section2 } = assessment

  const gradeLabels = {
    high: "высокая / high",
    above_average: "выше среднего / above average",
    average: "средняя / average",
    below_average: "ниже среднего / below average",
    low: "низкая / low",
  }

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
      labelRu: "О��основанность положений, выносимых на защиту",
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Рецензия на ВКР / Thesis Review" size="large">
      <div className="p-6 space-y-6">
        {/* Header Information */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">{thesis.title}</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <FiUser className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-gray-400">Рецензент / Reviewer</p>
                <p className="text-white font-medium">{assignedReviewer?.fullName}</p>
                <p className="text-gray-400">{assignedReviewer?.institution}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FiCalendar className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-gray-400">Дата подачи / Submission Date</p>
                <p className="text-white font-medium">{new Date(thesis.submissionDate).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Final Grade */}
        <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FiCheck className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-green-400 font-medium text-lg">Итоговая оценка / Final Grade: {finalGrade}</p>
              <p className="text-gray-400 text-sm">Ваша работа была оценена / Your thesis has been evaluated</p>
            </div>
          </div>
        </div>

        {/* Section I: Assessment Criteria */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-6">РАЗДЕЛ I. Оценка ВКР / Assessment of the thesis</h3>
          <div className="space-y-4">
            {criteriaLabels.map((criterion) => (
              <div
                key={criterion.key}
                className="grid md:grid-cols-3 gap-4 py-3 border-b border-gray-700 last:border-b-0"
              >
                <div className="md:col-span-2">
                  <p className="text-white font-medium text-sm">{criterion.labelRu}</p>
                  <p className="text-gray-400 text-xs">{criterion.labelEn}</p>
                </div>
                <div className="flex items-center">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900/20 text-blue-400 border border-blue-800">
                    {gradeLabels[section1[criterion.key]] || section1[criterion.key]}
                  </span>
                </div>
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
          <div className="mb-6">
            <h4 className="text-white font-medium mb-3">Вопросы / Questions</h4>
            <div className="space-y-3">
              {section2.questions?.map((question, index) => (
                <div key={index} className="bg-gray-700 rounded-lg p-3">
                  <p className="text-gray-300 text-sm font-medium mb-1">
                    Вопрос {index + 1} / Question {index + 1}
                  </p>
                  <p className="text-white">{question}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Advantages */}
          <div className="mb-6">
            <h4 className="text-white font-medium mb-3">Достоинства / Advantages</h4>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-white whitespace-pre-wrap">{section2.advantages}</p>
            </div>
          </div>

          {/* Disadvantages */}
          <div className="mb-6">
            <h4 className="text-white font-medium mb-3">Недостатки, замечания / Disadvantages, critique</h4>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-white whitespace-pre-wrap">{section2.disadvantages}</p>
            </div>
          </div>

          {/* Conclusion */}
          <div className="space-y-4">
            <h4 className="text-white font-medium">Заключение / Conclusion</h4>

            <div className="bg-gray-700 rounded-lg p-4">
              <h5 className="text-gray-300 text-sm font-medium mb-2">
                Итоговая оценка ВКР / Final assessment of the thesis
              </h5>
              <p className="text-white whitespace-pre-wrap">{section2.conclusion?.finalAssessment}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  {section2.conclusion?.isComplete ? (
                    <FiCheck className="w-5 h-5 text-green-400" />
                  ) : (
                    <FiX className="w-5 h-5 text-red-400" />
                  )}
                  <div>
                    <p className="text-white font-medium text-sm">Законченная работа / Complete work</p>
                    <p className="text-gray-400 text-xs">{section2.conclusion?.isComplete ? "Да / Yes" : "Нет / No"}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <FiUser className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-white font-medium text-sm">Заслуживает квалификации / Deserves degree</p>
                    <p className="text-gray-400 text-xs">
                      {section2.conclusion?.degreeWorthy || "Не указано / Not specified"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default StudentThesisDetails
