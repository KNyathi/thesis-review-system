import { PDFDocument, rgb, PDFPage, PDFFont } from "pdf-lib";
import { IThesis } from "../models/Thesis.model";
import { IStudent } from "../models/User.model";

export async function createVolumeExercisePage(
  pdfDoc: PDFDocument, 
  font: PDFFont, 
  boldFont: PDFFont, 
  thesis: IThesis,
  student: IStudent
): Promise<PDFPage> {
  let page = pdfDoc.addPage([595, 842]);
  const maxWidth = 500;
  const leftMargin = 50;
  let currentY = 800;

  // Function to check if we need a new page
  const checkNewPage = (requiredSpace: number): PDFPage => {
    if (currentY - requiredSpace < 50) {
      page = pdfDoc.addPage([595, 842]);
      currentY = 800;
    }
    return page;
  };

  // Text wrapping function
  const drawWrappedText = (
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
    font: PDFFont,
    lineHeight: number = 15,
    color = rgb(0, 0, 0)
  ): number => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + ' ' + word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);

    let currentY = y;
    lines.forEach(line => {
      page.drawText(line, {
        x,
        y: currentY,
        size: fontSize,
        font,
        color,
      });
      currentY -= lineHeight;
    });

    return currentY;
  };

  // Header
  checkNewPage(50);
  page.drawText("ОБЪЕМНОЕ ЗАДАНИЕ", {
    x: leftMargin,
    y: currentY,
    size: 14,
    font: boldFont,
  });
  currentY -= 30;

  // Ministry and University info
  currentY = drawWrappedText(
    page,
    "Министерство цифрового развития, связи и массовых коммуникаций Российской Федерации Ордена Трудового Красного Знамени федеральное государственное бюджетное образовательное учреждение высшего образования",
    leftMargin,
    currentY,
    maxWidth,
    10,
    font,
    12
  );

  currentY -= 20;

  page.drawText("«Московский технический университет связи и информатики»", {
    x: leftMargin,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 30;

  // Department
  checkNewPage(40);
  page.drawText("Кафедра ______ Математическая кибернетика и информационные технологии ______", {
    x: leftMargin,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 40;

  // Approval section
  const rightMargin = 400;
  page.drawText("«Утверждаю»", {
    x: rightMargin,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 20;

  page.drawText("Зав. кафедрой Городничев М.Г.", {
    x: rightMargin,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 20;

  page.drawText("«______»", {
    x: rightMargin,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 40;

  // Main title
  checkNewPage(50);
  page.drawText("ЗАДАНИЕ", {
    x: leftMargin,
    y: currentY,
    size: 12,
    font: boldFont,
  });
  currentY -= 20;

  page.drawText("на выпускную квалификационную работу", {
    x: leftMargin,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 30;

  // Student info
  const studentInfo = [
    `Студенту ${student.fullName} гр. ${student.group || '______'}`,
    `Направление (специальность) ______ 09.03.01 Информатика и вычислительная техника ______`,
    `Форма выполнения выпускной квалификационной работы ______ Бакалаврская работа ______`,
    `Тема выпускной квалификационной работы: ${thesis.title}`,
    `Утверждена приказом ректора № ______ 55-с ______ от ______ 21.01.2025 ______`
  ];

  studentInfo.forEach(info => {
    checkNewPage(20);
    page.drawText(info, {
      x: leftMargin,
      y: currentY,
      size: 10,
      font: font,
    });
    currentY -= 18;
  });

  currentY -= 20;

  // Section 1: Initial data
  checkNewPage(40);
  page.drawText("1. Исходные данные", {
    x: leftMargin,
    y: currentY,
    size: 10,
    font: boldFont,
  });
  currentY -= 20;

  const initialData = [
    "• Высокоуровневый язык программирования С#",
    "• Набор библиотек для задач: System, Zenject, OpenXR, XR ToolKit", 
    "• Движок: Unity 3D",
    "• Среда разработки: Visual Studio"
  ];

  initialData.forEach(data => {
    checkNewPage(20);
    currentY = drawWrappedText(
      page,
      data,
      leftMargin + 10,
      currentY,
      maxWidth - 10,
      10,
      font,
      14
    );
  });

  currentY -= 20;

  // Section 2: Content
  checkNewPage(40);
  page.drawText("2. Содержание расчетно-пояснительной записки (перечень подлежащих разработке вопросов)", {
    x: leftMargin,
    y: currentY,
    size: 10,
    font: boldFont,
  });
  currentY -= 20;

  const contentStructure = [
    "Введение",
    "Глава 1. Анализ предметной области",
    "Глава 2. Проектирование платформы", 
    "Глава 3. Разработка симулятора",
    "Заключение",
    "Список использованных источников",
    "Приложения"
  ];

  contentStructure.forEach(item => {
    checkNewPage(20);
    page.drawText(item, {
      x: leftMargin + 10,
      y: currentY,
      size: 10,
      font: font,
    });
    currentY -= 16;
  });

  currentY -= 20;

  // TABLE SECTION - With proper borders and 75%:25% ratio
  checkNewPage(100);
  page.drawText("Объем работы в % и сроки выполнения по разделам", {
    x: leftMargin,
    y: currentY,
    size: 10,
    font: boldFont,
  });
  currentY -= 30;

  // Table data
  const tableData = [
    { percent: "5%", date: "4.03.2025" },
    { percent: "25%", date: "26.03.2025" },
    { percent: "30%", date: "11.04.2025" },
    { percent: "35%", date: "29.04.2025" },
    { percent: "5%", date: "19.05.2025" }
  ];

  const tableLeft = leftMargin;
  const tableWidth = 400;
  const percentColWidth = tableWidth * 0.75; // 75% for content
  const dateColWidth = tableWidth * 0.25;    // 25% for dates
  const rowHeight = 20;
  const tableTop = currentY;

  // Draw table borders
  // Outer border
  page.drawRectangle({
    x: tableLeft,
    y: currentY - (tableData.length * rowHeight),
    width: tableWidth,
    height: tableData.length * rowHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });

  // Vertical line for column separation (75%:25%)
  const verticalLineX = tableLeft + percentColWidth;
  page.drawLine({
    start: { x: verticalLineX, y: currentY },
    end: { x: verticalLineX, y: currentY - (tableData.length * rowHeight) },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  // Horizontal lines for rows
  for (let i = 0; i <= tableData.length; i++) {
    const lineY = currentY - (i * rowHeight);
    page.drawLine({
      start: { x: tableLeft, y: lineY },
      end: { x: tableLeft + tableWidth, y: lineY },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
  }

  // Draw table content
  tableData.forEach((row, index) => {
    const rowY = currentY - (index * rowHeight) - (rowHeight / 2) + 5;
    
    // Percent column (centered in 75% section)
    const percentTextWidth = font.widthOfTextAtSize(row.percent, 10);
    const percentX = tableLeft + (percentColWidth / 2) - (percentTextWidth / 2);
    page.drawText(row.percent, {
      x: percentX,
      y: rowY,
      size: 10,
      font: font,
    });

    // Date column (centered in 25% section)
    const dateTextWidth = font.widthOfTextAtSize(row.date, 10);
    const dateX = verticalLineX + (dateColWidth / 2) - (dateTextWidth / 2);
    page.drawText(row.date, {
      x: dateX,
      y: rowY,
      size: 10,
      font: font,
    });
  });

  currentY -= (tableData.length * rowHeight) + 30;

  // Additional sections
  checkNewPage(150);
  page.drawText("3. Консультанты по BKP (с указанием относящихся к ним разделов проекта):", {
    x: leftMargin,
    y: currentY,
    size: 10,
    font: boldFont,
  });
  currentY -= 30;

  // Consultant table
  const consultantTableLeft = leftMargin + 20;
  page.drawText("Симонов Сергей Евгеньевич", {
    x: consultantTableLeft,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 15;

  page.drawText("(подпись)", {
    x: consultantTableLeft,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 15;

  page.drawText("(ФИО)", {
    x: consultantTableLeft,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 30;

  // Deadline section
  checkNewPage(100);
  page.drawText("4. Срок сдачи студентом законченной BKP:", {
    x: leftMargin,
    y: currentY,
    size: 10,
    font: boldFont,
  });
  currentY -= 30;

  // Date and signatures section
  const currentYear = new Date().getFullYear();
  page.drawText(`Дата выдачи задания: ______ ${currentYear}`, {
    x: leftMargin,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 40;

  // Supervisor signature
  checkNewPage(120);
  const signatureLeft = leftMargin + 150;
  page.drawText("Руководитель", {
    x: signatureLeft,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 15;

  page.drawText("Городничев Михаил Геннадьевич", {
    x: signatureLeft,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 15;

  page.drawText("(подпись)", {
    x: signatureLeft,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 15;

  page.drawText("(ФИО)", {
    x: signatureLeft,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 15;

  page.drawText("штатная", {
    x: signatureLeft,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 15;

  page.drawText("(штатная или почасовая)", {
    x: signatureLeft,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 15;

  page.drawText("нагрузка", {
    x: signatureLeft,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 30;

  // Student acceptance
  checkNewPage(60);
  page.drawText("Задание принял к исполнению", {
    x: leftMargin,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 30;

  page.drawText("(подпись студента)", {
    x: leftMargin,
    y: currentY,
    size: 10,
    font: font,
  });
  currentY -= 30;

  // Note at the bottom
  checkNewPage(30);
  page.drawText("Примечание: Настоящее задание прилагается к законченной BKP", {
    x: leftMargin,
    y: currentY,
    size: 10,
    font: font,
  });

  return page;
}