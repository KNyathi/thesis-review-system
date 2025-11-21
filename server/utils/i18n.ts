export const i18n = {
  errors: {
    // General errors
    thesisNotFound: "Работа не найдена",
    notAuthorized: "Вы не авторизованы для выполнения этого действия",
    accessDenied: "Доступ запрещён",
    failedToSubmitReview: "Не удалось отправить консультацию",
    failedToFetchTheses: "Не удалось загрузить список работ",
    failedToFetchReviews: "Не удалось загрузить список консультаций",
    failedToReview: "Не удалось пересмотреть работу",
    failedToStreamReview: "Не удалось загрузить консультацию",
    failedToUploadReview: "Не удалось загрузить подписанную консультацию",
    failedToDownloadReview: "Не удалось скачать консультацию",
    failedToFinalizeReview: "Не удалось завершить консультацию",
    failedToFetchStats: "Не удалось загрузить статистику",

    // Specific errors
    invalidRequest:
      "Некорректный запрос. Пожалуйста, укажите либо только комментарии для доработки, либо заключение для одобрения.",
    unsignedReviewNotFound: "Неподписанная консультация не найдена",
    signedReviewNotFound: "Подписанная консультация не найдена",
    unsignedReviewFileNotFound: "Файл неподписанной консультации не найден",
    signedReviewFileNotFound: "Файл подписанной консультации не найден",
    signedPdfRequired: "Требуется файл подписанной консультации",
    fileNotAvailable: "Файл недоступен",
  },

  success: {
    revisionsRequested: "Замечания для доработки отправлены успешно!",
    reviewApproved: "Консультация с одобрением отправлена успешно!",
    reviewSubmitted: "Консультация отправлена успешно!",
    reviewUploaded: "Подписанная консультация загружена успешно!",
    reviewDownloaded: "Консультация скачана успешно!",
    rereviewStarted: "Работа отправлена на повторный пересмотр",
  },

  messages: {
    loadingConsultantPanel: "Загрузка панели консультанта...",
    loadingData: "Загрузка данных...",
    partialDataLoadWarning: "Не удалось загрузить некоторые данные",
  },
}
