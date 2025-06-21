import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import fs from "fs";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { IThesis } from "../models/Thesis.model";
import {
  IReviewer,
  IStudent,
  IAdmin,
  Admin,
  Student,
} from "../models/User.model";

export async function generateReviewPDF(
  thesis: IThesis,
  reviewer: IReviewer
): Promise<string> {
  // Ensure reviews directory exists
  const reviewsDir = path.join(__dirname, "../reviews/unsigned");
  if (!fs.existsSync(reviewsDir)) {
    fs.mkdirSync(reviewsDir, { recursive: true });
  }

  // Load the existing PDF template (if you have one)
  // Or create a new document from scratch
  const pdfDoc = await PDFDocument.create();

  // Register fontkit
  pdfDoc.registerFontkit(fontkit);

  // Add a new page
  const page = pdfDoc.addPage([595, 842]); // A4 size

  // Register fonts
  const regularFontBytes = fs.readFileSync(
    path.join(__dirname, "../assets/fonts/Arial_Cyr.ttf")
  );
  const boldFontBytes = fs.readFileSync(
    path.join(__dirname, "../assets/fonts/Arial_Cyr_Bold.ttf") // Bold variant
  );

  // Embed both fonts
  const font = await pdfDoc.embedFont(regularFontBytes);
  const boldFont = await pdfDoc.embedFont(boldFontBytes);

  // Draw header - centered
  const centerX = 595 / 2; // Center of A4 page (595mm width)

  const drawCenteredWrappedText = (
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    size: number,
    font: PDFFont,
    lineHeight: number = 15
  ) => {
    const lines = [];
    const words = text.split(" ");
    let currentLine = "";

    // Split text into lines that fit within maxWidth
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    // Draw each line centered
    let currentY = y;
    for (const line of lines) {
      const lineWidth = font.widthOfTextAtSize(line, size);
      page.drawText(line, {
        x: centerX - lineWidth / 2, // Center each line individually
        y: currentY,
        size,
        font,
      });
      currentY -= lineHeight;
    }

    return currentY; // Return final Y position
  };

  const maxWidth = 500; // Maximum allowed width for text

  page.drawText(
    "Министерство науки и высшего образования Российской Федерации",
    {
      x:
        centerX -
        boldFont.widthOfTextAtSize(
          "Министерство науки и высшего образования Российской Федерации",
          10
        ) /
          2,
      y: 800,
      size: 10,
      font: boldFont,
    }
  );

  const finalY = drawCenteredWrappedText(
    page,
    "ФЕДЕРАЛЬНОЕ ГОСУДАРСТВЕННОЕ АВТОНОМНОЕ ОБРАЗОВАТЕЛЬНОЕ УЧРЕЖДЕНИЕ ВЫСШЕГО ОБРАЗОВАНИЯ",
    centerX, // Now using centerX directly
    780,
    maxWidth,
    11,
    font
  );
  // Then draw the university name below it
  page.drawText(
    "НАЦИОНАЛЬНЫЙ ИССЛЕДОВАТЕЛЬСКИЙ УНИВЕРСИТЕТ ИТМО ITMO University",
    {
      x:
        centerX -
        boldFont.widthOfTextAtSize(
          "НАЦИОНАЛЬНЫЙ ИССЛЕДОВАТЕЛЬСКИЙ УНИВЕРСИТЕТ ИТМО ITMO University",
          11
        ) /
          2,
      y: finalY - 5, // Space between lines
      size: 11,
      font: boldFont,
    }
  );

  // Draw title - centered
  page.drawText(
    "РЕЦЕНЗИЯ НА ВЫПУСКНУЮ КВАЛИФИКАЦИОННУЮ РАБОТУ / REVIEW OF A GRADUATION THESIS",
    {
      x:
        centerX -
        boldFont.widthOfTextAtSize(
          "РЕЦЕНЗИЯ НА ВЫПУСКНУЮ КВАЛИФИКАЦИОННУЮ РАБОТУ / REVIEW OF A GRADUATION THESIS",
          11
        ) /
          2,
      y: 715, // Adjusted y position for better spacing
      size: 11,
      font: boldFont,
    }
  );

  const student = await Student.findById(thesis.student);

  if (!student) {
    throw new Error("Student not found");
  }

  // Student information section
  const startY = 700;
  const lineHeight = 15;

  // Helper function to draw mixed bold/regular text
  const drawMixedText = (
    page: PDFPage,
    boldPart: string,
    regularPart: string | undefined,
    x: number,
    y: number,
    size: number
  ) => {
    const boldWidth = boldFont.widthOfTextAtSize(boldPart, size);

    // Draw bold part
    page.drawText(boldPart, {
      x,
      y,
      size,
      font: boldFont,
    });

    // Draw regular part
    page.drawText(regularPart ?? "", {
      x: x + boldWidth,
      y,
      size,
      font,
    });
  };

  // Draw all student information with proper line spacing
  drawMixedText(
    page,
    "Обучающийся / Student: ",
    student.fullName,
    50,
    startY,
    10
  );

  drawMixedText(
    page,
    "Факультет / институт / кластер / Faculty / Institute / Cluster: ",
    student.faculty,
    50,
    startY - lineHeight,
    10
  );

  drawMixedText(
    page,
    "Группа / Group: ",
    student.group,
    50,
    startY - 2 * lineHeight,
    10
  );

  drawMixedText(
    page,
    "Направление подготовки / Subject area: ",
    student.subjectArea,
    50,
    startY - 3 * lineHeight,
    10
  );

  drawMixedText(
    page,
    "Образовательная программа / Educational program: ",
    student.educationalProgram,
    50,
    startY - 4 * lineHeight,
    10
  );

  drawMixedText(
    page,
    "Квалификация / Degree level: ",
    student.degreeLevel,
    50,
    startY - 5 * lineHeight,
    10
  );

  drawMixedText(
    page,
    "Тема ВКР / Thesis topic: ",
    student.thesisTopic ?? "Not specified", //provide fallback
    50,
    startY - 6 * lineHeight,
    10
  );

  // Reviewer information
  drawMixedText(
    page,
    "Рецензент / Reviewer: ",
    `${reviewer.fullName}, ${reviewer.institution}, ${reviewer.positions.join(
      ", "
    )}`,
    50,
    startY - 7 * lineHeight, // Extra space before reviewer section
    10
  );

  //Section 1
  const assessment = thesis.assessment!.section1;

  // Table rows
  const criteria = [
    {
      text: "Соответствие содержания работы утвержденной теме BKP / Degree to which the contents of the thesis correspond to its declared topic",
      value: assessment.topicCorrespondence,
    },
    {
      text: "Обоснование актуальности темы, корректность постановки цели и задач исследования / Justification for the relevance of the topic; correctness of the set research goals and objectives",
      value: assessment.relevanceJustification,
    },

    {
      text: "Соответствие работы направлению, профилю и специализации подготовки / Degree to which the thesis corresponds to the student's subject area, major, and specialization",
      value: assessment.subjectAreaCorrespondence,
    },

    {
      text: "Корректность выбора использования методов исследования / Correctness of the chosen research methods",
      value: assessment.researchMethodsCorrectness,
    },
    {
      text: "Качество, логика и полнота изложения представленных материалов / Quality, logic, and fullness with which the collected material is presented",
      value: assessment.materialPresentation,
    },
    {
      text: "Обоснованность положений, выносимых на защиту / Degree of justification for the assertions that are presented for defense",
      value: assessment.assertionsJustification,
    },
    {
      text: "Научная и/или практическая значимость работы / Scientific and/or practical value of the research",
      value: assessment.researchValue,
    },
    {
      text: "Внедрение результатов работы / Integration of the research findings",
      value: assessment.researchFindingsIntegration,
    },
  ];

  const studentInfoBottomY = startY - 8 * lineHeight - 30;

  // Assessment table configuration
  let currentPage = page;
  let currentTableYStart = studentInfoBottomY - 40;
  const column1X = 50; // Criteria column start
  const column2X = 350; // Score column start
  const columnWidth = 300; // Width of first column
  const column2Width = 50; // Width of score column
  const lineThickness = 1;
  const minRowHeight = 25; // Minimum row height
  const padding = 5; // Cell padding

  // Calculate required space for each row
  const calculateRowHeight = (
    text: string,
    font: PDFFont,
    fontSize: number,
    maxWidth: number
  ) => {
    const words = text.split(" ");
    let lineCount = 1;
    let currentLineWidth = 0;

    for (const word of words) {
      const wordWidth = font.widthOfTextAtSize(word + " ", fontSize);
      if (currentLineWidth + wordWidth > maxWidth) {
        lineCount++;
        currentLineWidth = wordWidth;
      } else {
        currentLineWidth += wordWidth;
      }
    }

    return Math.max(minRowHeight, lineCount * 12 + padding * 2); // 12px per line
  };

  // Calculate total table height
  let tableHeight = 0;
  const rowHeights: number[] = [];

  criteria.forEach((item) => {
    const height = calculateRowHeight(
      item.text,
      font,
      10,
      columnWidth - padding * 2
    );
    rowHeights.push(height);
    tableHeight += height;
  });

  // Add header row height
  tableHeight += minRowHeight;

  // Check if we need a new page
  if (currentTableYStart - tableHeight < 50) {
    currentPage = pdfDoc.addPage([595, 842]);
    currentTableYStart = 800;
  }

  // Draw table title
  currentPage.drawText("РАЗДЕЛ I. Оценка BKP/Assessment of the thesis", {
    x: column1X,
    y: currentTableYStart + 20,
    size: 11,
    font: boldFont,
  });

  // Draw table headers
  currentPage.drawText("Критерии оценивания", {
    x: column1X + padding,
    y: currentTableYStart - 15,
    size: 10,
    font: boldFont,
  });

  currentPage.drawText("Оценка", {
    x: column2X + padding,
    y: currentTableYStart - 15,
    size: 10,
    font: boldFont,
  });

  // Draw header border
  currentPage.drawLine({
    start: { x: column1X, y: currentTableYStart },
    end: { x: column1X + columnWidth + column2Width, y: currentTableYStart },
    thickness: lineThickness,
    color: rgb(0, 0, 0),
  });

  // Draw each row with dynamic height
  let currentY = currentTableYStart;
  criteria.forEach((item, index) => {
    const rowHeight = rowHeights[index];
    currentY -= rowHeight;

    // Draw cell background (optional for better readability)
    currentPage.drawRectangle({
      x: column1X,
      y: currentY,
      width: columnWidth + column2Width,
      height: rowHeight,
      color: index % 2 === 0 ? rgb(0.95, 0.95, 0.95) : rgb(1, 1, 1),
      opacity: 0.5,
    });

    // Draw criteria text with wrapping
    currentPage.drawText(item.text, {
      x: column1X + padding,
      y: currentY + rowHeight - padding - 10, // Position text at top of cell
      size: 10,
      font,
      maxWidth: columnWidth - padding * 2,
      lineHeight: 12,
    });

    // Draw score value (centered vertically)
    currentPage.drawText(item.value.toString(), {
      x: column2X + padding,
      y: currentY + rowHeight / 2 - 5, // Center vertically
      size: 10,
      font,
    });

    // Draw horizontal line
    currentPage.drawLine({
      start: { x: column1X, y: currentY },
      end: { x: column1X + columnWidth + column2Width, y: currentY },
      thickness: lineThickness,
      color: rgb(0, 0, 0),
    });
  });

  // Draw vertical borders
  currentPage.drawLine({
    start: { x: column1X, y: currentTableYStart },
    end: { x: column1X, y: currentTableYStart - tableHeight },
    thickness: lineThickness,
    color: rgb(0, 0, 0),
  });

  currentPage.drawLine({
    start: { x: column2X, y: currentTableYStart },
    end: { x: column2X, y: currentTableYStart - tableHeight },
    thickness: lineThickness,
    color: rgb(0, 0, 0),
  });

  currentPage.drawLine({
    start: { x: column1X + columnWidth + column2Width, y: currentTableYStart },
    end: {
      x: column1X + columnWidth + column2Width,
      y: currentTableYStart - tableHeight,
    },
    thickness: lineThickness,
    color: rgb(0, 0, 0),
  });

  // Draw bottom border
  currentPage.drawLine({
    start: { x: column1X, y: currentTableYStart - tableHeight },
    end: {
      x: column1X + columnWidth + column2Width,
      y: currentTableYStart - tableHeight,
    },
    thickness: lineThickness,
    color: rgb(0, 0, 0),
  });

  const tableBottomY = currentTableYStart - tableHeight;

  // Section 2: Results
  currentY = tableBottomY - 40; // Space after the table

  // Check if we need a new page before starting Section 2
  if (currentY < 150) {
    // If less than 150px left on page
    currentPage = pdfDoc.addPage([595, 842]);
    currentY = 800; // Reset to top of new page
  }

  // Section 2 Header
  currentPage.drawText(
    "РАЗДЕЛ II. Результирующая часть отзыва / Results of the assessment",
    {
      x: 50,
      y: currentY,
      size: 12,
      font: boldFont,
    }
  );
  currentY -= 30;

  // Questions section
  currentPage.drawText("Вопросы / Questions:", {
    x: 50,
    y: currentY,
    size: 10,
    font: boldFont,
  });
  currentY -= 20;

  thesis.assessment!.section2.questions.forEach((question, i) => {
    // Check if we need a new page
    if (currentY < 100) {
      currentPage = pdfDoc.addPage([595, 842]);
      currentY = 800;
    }

    currentPage.drawText(`${i + 1}. ${question}`, {
      x: 50,
      y: currentY,
      size: 10,
      font,
      maxWidth: 500, // Add text wrapping
      lineHeight: 12,
    });
    currentY -= 15;
  });

  // Advantages/Disadvantages section - with extra space before
  currentY -= 20; // Extra space before new section
  currentPage.drawText(
    "Достоинства, недостатки, замечания / Advantages, disadvantages, critique:",
    {
      x: 50,
      y: currentY,
      size: 10,
      font: boldFont,
    }
  );
  currentY -= 25;

  // Advantages
  currentPage.drawText("Достоинства / Advantages:", {
    x: 50,
    y: currentY,
    size: 10,
    font: boldFont,
  });
  currentY -= 20;

  thesis.assessment!.section2.advantages.forEach((advantage, index) => {
    if (currentY < 100) {
      currentPage = pdfDoc.addPage([595, 842]);
      currentY = 800;
    }

    currentPage.drawText(`${index + 1}. ${advantage}`, {
      x: 60,
      y: currentY,
      size: 10,
      font,
      maxWidth: 490, // Slightly less due to indentation
      lineHeight: 12,
    });
    currentY -= 15;
  });

  // Disadvantages - with extra space
  currentY -= 20;
  currentPage.drawText("Недостатки, замечания / Disadvantages, critique:", {
    x: 50,
    y: currentY,
    size: 10,
    font: boldFont,
  });
  currentY -= 20;

  thesis.assessment!.section2.disadvantages.forEach((disadvantage, index) => {
    if (currentY < 100) {
      currentPage = pdfDoc.addPage([595, 842]);
      currentY = 800;
    }

    currentPage.drawText(`${index + 1}. ${disadvantage}`, {
      x: 60,
      y: currentY,
      size: 10,
      font,
      maxWidth: 490,
      lineHeight: 12,
    });
    currentY -= 15;
  });

  // Conclusion section - with extra space
  currentY -= 30;
  if (currentY < 150) {
    // Ensure enough space for conclusion
    currentPage = pdfDoc.addPage([595, 842]);
    currentY = 800;
  }

  currentPage.drawText("Заключение / Conclusion:", {
    x: 50,
    y: currentY,
    size: 12,
    font: boldFont,
  });
  currentY -= 25;

  // Final grade
  currentPage.drawText(
    `Итоговая оценка ВКР - ${thesis.finalGrade}. / Final Assessment of the thesis - ${thesis.finalGrade}.`,
    {
      x: 50,
      y: currentY,
      size: 10,
      font,
    }
  );
  currentY -= 20;

  // Conclusion text (Russian)
  const isCompleteTextRu = thesis.assessment!.section2.conclusion.isComplete
    ? "Да"
    : "Нет";
  const isDeservingTextRu = thesis.assessment!.section2.conclusion.isDeserving
    ? "Да"
    : "Нет";

  currentPage.drawText(
    `Заключение: Считаю что данная выпускная квалификационная работа является законченной работой - ${isCompleteTextRu}, а её автор заслуживает присуждения квалификации ${student.degreeLevel} - ${isDeservingTextRu}`,
    {
      x: 50,
      y: currentY,
      size: 10,
      font,
      maxWidth: 500,
      lineHeight: 12,
    }
  );
  currentY -= 20;

  // Conclusion text (English)
  const isCompleteTextEn = thesis.assessment!.section2.conclusion.isComplete
    ? "Yes"
    : "No";
  const isDeservingTextEn = thesis.assessment!.section2.conclusion.isDeserving
    ? "Yes"
    : "No";

  currentPage.drawText(
    `Conclusion: I believe that the present graduation thesis is complete - ${isCompleteTextEn}, and its author is deserving of being awarded a ${student.degreeLevel} degree - ${isDeservingTextEn}`,
    {
      x: 50,
      y: currentY,
      size: 10,
      font,
      maxWidth: 500,
      lineHeight: 12,
    }
  );

  //Signature functionality

  const drawSignatureBlocks = (
    currentPage: PDFPage,
    currentY: number, // Track vertical position
    reviewer: IReviewer,
    student: IStudent,
    admin: string
  ) => {
    const signatureConfig = {
      blockHeight: 60, // Increased height for better spacing
      leftX: 50,
      rightX: 300, // Moved right column further right
      lineLength: 120, // Longer signature lines
      labelYOffset: 15, // Space between line and label
      roleYOffset: 35, // Space between line and role
    };

    // Check if we need a new page for signatures
    if (currentY - 3 * signatureConfig.blockHeight < 50) {
      currentPage = pdfDoc.addPage([595, 842]);
      currentY = 800;
    }

    // Signature data for all three parties
    const signatures = [
      {
        role: "(Ф.И.О рецензента)",
        name: reviewer.fullName,
        label: "(эл. подпись рецензента)",
      },
      {
        role: "(Ф.И.О обучающегося)",
        name: student.fullName,
        label: "(эл. подпись обучающегося)",
      },
      {
        role: "(Ф.И.О секретаря ГЕК)",
        name: admin,
        label: "(эл. подпись секретаря ГЕК)",
      },
    ];

    // Draw each signature block with proper spacing
    signatures.forEach((signature, index) => {
      const yPos = currentY - index * signatureConfig.blockHeight;

      // Left column - Signature line and label
      currentPage.drawLine({
        start: { x: signatureConfig.leftX, y: yPos },
        end: { x: signatureConfig.leftX + signatureConfig.lineLength, y: yPos },
        thickness: 1,
        color: rgb(0, 0, 0),
      });

      currentPage.drawText(signature.label, {
        x: signatureConfig.leftX,
        y: yPos - signatureConfig.labelYOffset,
        size: 8,
        font: font,
      });

      // Right column - Name and role
      currentPage.drawText(signature.name, {
        x: signatureConfig.rightX,
        y: yPos + 5,
        size: 10,
        font: boldFont,
      });

      // Add date field for each signature
      currentPage.drawLine({
        start: { x: signatureConfig.rightX + 150, y: yPos },
        end: { x: signatureConfig.rightX + 250, y: yPos },
        thickness: 1,
        color: rgb(0, 0, 0),
      });

      currentPage.drawText(signature.role, {
        x: signatureConfig.rightX,
        y: yPos - signatureConfig.roleYOffset,
        size: 8,
        font: font,
      });
    });

    return currentY - 3 * signatureConfig.blockHeight - 20; // Return new Y position
  };

  drawSignatureBlocks(
    currentPage,
    currentY,
    reviewer,
    student,
    "Khayelihle Nyathi"
  );

  // Save PDF to file
  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(reviewsDir, `unsigned_review_${thesis._id}.pdf`);
  fs.writeFileSync(outputPath, pdfBytes);

  return outputPath;
}
