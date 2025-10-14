import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import fs from "fs";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { IThesis } from "../models/Thesis.model";
import {
  IStudent,
  UserModel,
  Student,
  IConsultant,
  ISupervisor,
} from "../models/User.model";
import { createTitlePage } from "./titlePage.component";
import { createVolumeExercisePage } from "./volumeExercise.component";
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DB_URL
});

const userModel = new UserModel(pool);

export async function generateConsultantReviewPDF(
  thesis: IThesis,
  reviewer: IConsultant | ISupervisor,
  isSupervisor: boolean = false
): Promise<string> {
  // Get student data
  const student = await Student.findById(userModel, thesis.student);
  if (!student) {
    throw new Error("Student not found");
  }

  // Determine the directory based on role
  const role = isSupervisor ? 'supervisor' : 'consultant';
  const reviewsDir = path.join(__dirname, `../reviews/${role}/unsigned`);

  if (!fs.existsSync(reviewsDir)) {
    fs.mkdirSync(reviewsDir, { recursive: true });
  }

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();

  // Register fontkit
  pdfDoc.registerFontkit(fontkit);

  // Register fonts
  const regularFontBytes = fs.readFileSync(
    path.join(__dirname, "../assets/fonts/Arial_Cyr.ttf")
  );
  const boldFontBytes = fs.readFileSync(
    path.join(__dirname, "../assets/fonts/Arial_Cyr_Bold.ttf")
  );

  // Embed both fonts
  const font = await pdfDoc.embedFont(regularFontBytes);
  const boldFont = await pdfDoc.embedFont(boldFontBytes);

  // Create Component 1: Title Page
  await createTitlePage(pdfDoc, font, boldFont, thesis, student);

  // Create Component 2: Volume Exercise Page
  await createVolumeExercisePage(pdfDoc, font, boldFont, thesis, student);


  // Add a new page
  const page = pdfDoc.addPage([595, 842]); // A4 size



  // Improved text wrapping function with basic bold support
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
    // Simple bold formatting using asterisks
    const segments: { text: string; bold?: boolean }[] = [];
    const parts = text.split(/(\*\*.*?\*\*)/g); // Split by **bold** patterns

    parts.forEach(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // This is a bold segment
        segments.push({ text: part.slice(2, -2), bold: true });
      } else if (part) {
        // Regular text segment
        segments.push({ text: part });
      }
    });

    let currentY = y;
    let currentX = x;
    let currentLine: { text: string; bold?: boolean }[] = [];

    const flushLine = () => {
      if (currentLine.length === 0) return;

      // Draw each segment in the current line
      currentLine.forEach(segment => {
        page.drawText(segment.text, {
          x: currentX,
          y: currentY,
          size: fontSize,
          font: segment.bold ? boldFont : font,
          color,
        });
        // Move x position for next segment
        currentX += font.widthOfTextAtSize(segment.text, fontSize);
      });

      currentY -= lineHeight;
      currentX = x;
      currentLine = [];
    };

    // Simple word wrapping logic
    segments.forEach(segment => {
      const words = segment.text.split(' ');

      words.forEach(word => {
        const testLine = [...currentLine, { text: word + ' ', bold: segment.bold }];
        const testText = testLine.map(s => s.text).join('');
        const testWidth = font.widthOfTextAtSize(testText, fontSize);

        if (testWidth > maxWidth && currentLine.length > 0) {
          flushLine();
        }

        currentLine.push({ text: word + ' ', bold: segment.bold });
      });
    });

    flushLine(); // Draw any remaining text
    return currentY;
  };

  // Centered wrapped text function
  const drawCenteredWrappedText = (
    page: PDFPage,
    text: string,
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

    // Draw each line centered
    let currentY = y;
    const centerX = 595 / 2;

    lines.forEach(line => {
      const lineWidth = font.widthOfTextAtSize(line, fontSize);
      page.drawText(line, {
        x: centerX - lineWidth / 2,
        y: currentY,
        size: fontSize,
        font,
        color,
      });
      currentY -= lineHeight;
    });

    return currentY;
  };

  // Mixed text with wrapping (bold + regular)
  const drawMixedWrappedText = (
    page: PDFPage,
    boldText: string,
    regularText: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
    font: PDFFont,
    boldFont: PDFFont,
    lineHeight: number = 15
  ): number => {
    const fullText = boldText + regularText;
    const words = fullText.split(' ');
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

    // Draw lines with mixed formatting
    let currentY = y;
    lines.forEach(line => {
      if (line.startsWith(boldText) && line.length > boldText.length) {
        // Line starts with bold and continues with regular
        const boldPart = boldText;
        const regularPart = line.substring(boldText.length);

        const boldWidth = boldFont.widthOfTextAtSize(boldPart, fontSize);

        page.drawText(boldPart, {
          x,
          y: currentY,
          size: fontSize,
          font: boldFont,
        });

        page.drawText(regularPart, {
          x: x + boldWidth,
          y: currentY,
          size: fontSize,
          font: font,
        });
      } else if (line.startsWith(boldText)) {
        // Entire line is bold
        page.drawText(line, {
          x,
          y: currentY,
          size: fontSize,
          font: boldFont,
        });
      } else {
        // Entire line is regular (continuation from previous line)
        page.drawText(line, {
          x,
          y: currentY,
          size: fontSize,
          font: font,
        });
      }
      currentY -= lineHeight;
    });

    return currentY;
  };

  // Header section with proper wrapping
  const maxWidth = 500;
  const centerX = 595 / 2;
  let currentY = 800;

  // Ministry line 1
  currentY = drawCenteredWrappedText(
    page,
    "Министерство цифрового развития, связи и массовых коммуникаций",
    currentY,
    maxWidth,
    12,
    font,
    15
  );

  // Ministry line 2
  currentY = drawCenteredWrappedText(
    page,
    "Российской Федерации",
    currentY,
    maxWidth,
    12,
    font,
    15
  );

  // University description
  currentY = drawCenteredWrappedText(
    page,
    "Ордена Трудового Красного Знамени федеральное государственное бюджетное образовательное учреждение высшего образования",
    currentY,
    maxWidth,
    12,
    font,
    15
  );

  // University name
  currentY = drawCenteredWrappedText(
    page,
    "«МОСКОВСКИЙ ТЕХНИЧЕСКИЙ УНИВЕРСИТЕТ СВЯЗИ И ИНФОРМАТИКИ»",
    currentY,
    maxWidth,
    12,
    font,
    15
  );

  // University abbreviation
  currentY = drawCenteredWrappedText(
    page,
    "(МТУСИ)",
    currentY,
    maxWidth,
    12,
    font,
    15
  );

  currentY -= 30;

  // Title - ОТЗЫВ
  const titleWidth = boldFont.widthOfTextAtSize("ОТЗЫВ", 12);
  page.drawText("ОТЗЫВ", {
    x: centerX - titleWidth / 2,
    y: currentY,
    size: 12,
    font: boldFont,
  });

  currentY -= 20;

  // Subtitle
  currentY = drawCenteredWrappedText(
    page,
    "о работе обучающегося в период подготовки выпускной квалификационной работы",
    currentY,
    maxWidth,
    12,
    font,
    15
  );

  currentY -= 30;

  // Student information section with proper wrapping
  const leftMargin = 50;
  const studentInfoWidth = 500;

  // Student name with wrapping
  currentY = drawMixedWrappedText(
    page,
    "Обучающийся: ",
    student.fullName,
    leftMargin,
    currentY,
    studentInfoWidth,
    12,
    font,
    boldFont,
    18
  );

  // Subject area with wrapping
  currentY = drawMixedWrappedText(
    page,
    "Направление подготовки: ",
    student.subjectArea || "Не указано",
    leftMargin,
    currentY,
    studentInfoWidth,
    12,
    font,
    boldFont,
    18
  );

  // Thesis topic with wrapping
  currentY = drawMixedWrappedText(
    page,
    "Тема ВКР: ",
    student.thesisTopic || "Не указана",
    leftMargin,
    currentY,
    studentInfoWidth,
    12,
    font,
    boldFont,
    18
  );


  // Reviewer information with wrapping - only show for supervisors
  if (!isSupervisor) {
    const reviewerRole = "Руководитель ВКР";
    const reviewerPosition = 'position' in reviewer ? reviewer.position : '';
    const reviewerInfo = `${reviewer.fullName}, ${reviewer.institution}${reviewerPosition ? ', ' + reviewerPosition : ''}`;

    currentY = drawMixedWrappedText(
      page,
      `${reviewerRole}: `,
      reviewerInfo,
      leftMargin,
      currentY,
      studentInfoWidth,
      12,
      font,
      boldFont,
      18
    );
  }

  currentY -= 50;

  // Section 1 - Assessment criteria
  const assessment = thesis.consultantAssessment!.section1;

  // Table rows
  const criteria = [
    {
      text: "Соответствие содержания работы утвержденной теме BKP",
      value: assessment.topicCorrespondence,
    },
    {
      text: "Обоснование актуальности темы, корректность постановки цели и задач исследования",
      value: assessment.relevanceJustification,
    },
    {
      text: "Соответствие работы направлению, профилю и специализации подготовки",
      value: assessment.subjectAreaCorrespondence,
    },
    {
      text: "Корректность выбора использования методов исследования",
      value: assessment.researchMethodsCorrectness,
    },
    {
      text: "Качество, логика и полнота изложения представленных материалов",
      value: assessment.materialPresentation,
    },
    {
      text: "Обоснованность положений, выносимых на защиту",
      value: assessment.assertionsJustification,
    },
    {
      text: "Научная и/или практическая значимость работы",
      value: assessment.researchValue,
    },
    {
      text: "Внедрение результатов работы",
      value: assessment.researchFindingsIntegration,
    },
  ];

  // Table configuration
  let currentPage = page;
  const column1X = 50;
  const column2X = 400;
  const columnWidth = 350;
  const column2Width = 180;
  const lineThickness = 1;
  const minRowHeight = 20;
  const padding = 6;
  const headerRowHeight = 25;

  // Improved function to draw wrapped text in table cells
  const drawWrappedTextInCell = (
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
    font: PDFFont,
    lineHeight: number = 14
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

    // Draw each line
    let currentY = y;
    lines.forEach(line => {
      page.drawText(line, {
        x,
        y: currentY,
        size: fontSize,
        font,
      });
      currentY -= lineHeight;
    });

    return lines.length;
  };

  // Calculate required space for each row
  const calculateRowHeight = (
    text: string,
    font: PDFFont,
    fontSize: number,
    maxWidth: number
  ) => {
    const words = text.split(' ');
    let lineCount = 1;
    let currentLineWidth = 0;

    for (const word of words) {
      const wordWidth = font.widthOfTextAtSize(word + ' ', fontSize);
      if (currentLineWidth + wordWidth > maxWidth) {
        lineCount++;
        currentLineWidth = wordWidth;
      } else {
        currentLineWidth += wordWidth;
      }
    }

    return Math.max(minRowHeight, lineCount * 14 + padding * 2);
  };

  // Calculate row heights for all criteria
  const rowHeights: number[] = [];
  criteria.forEach((item) => {
    const height = calculateRowHeight(
      item.text,
      font,
      12,
      columnWidth - padding * 2
    );
    rowHeights.push(height);
  });

  // Function to draw table with pagination that returns current page and Y position
  const drawTableWithPagination = async (
    startY: number,
    criteria: any[],
    rowHeights: number[]
  ) => {
    let currentPage = page;
    let currentY = startY;
    const minPageBottom = 50; // Minimum Y position before creating new page

    currentPage.drawText("РАЗДЕЛ I. Оценка BKP", {
      x: 50,
      y: currentY + 20,
      size: 12,
      font: boldFont,
    });

    let currentTableYStart = currentY;
    let remainingCriteria = [...criteria];
    let remainingRowHeights = [...rowHeights];
    let currentIndex = 0;

    while (remainingCriteria.length > 0) {
      // Calculate how many rows we can fit on current page
      let rowsToDraw = 0;
      let totalHeight = headerRowHeight;

      for (let i = 0; i < remainingCriteria.length; i++) {
        if (currentTableYStart - (totalHeight + remainingRowHeights[i]) < minPageBottom) {
          break;
        }
        totalHeight += remainingRowHeights[i];
        rowsToDraw++;
      }

      // If no rows can fit, create new page
      if (rowsToDraw === 0) {
        currentPage = pdfDoc.addPage([595, 842]);
        currentTableYStart = 800;
        currentY = currentTableYStart;

        // Recalculate how many rows we can fit on new page
        totalHeight = headerRowHeight;
        for (let i = 0; i < remainingCriteria.length; i++) {
          if (currentTableYStart - (totalHeight + remainingRowHeights[i]) < minPageBottom) {
            break;
          }
          totalHeight += remainingRowHeights[i];
          rowsToDraw++;
        }
      }

      // Draw the rows that fit on current page
      const currentBatch = remainingCriteria.slice(0, rowsToDraw);
      const currentBatchHeights = remainingRowHeights.slice(0, rowsToDraw);

      // Draw table headers
      const headerY = currentTableYStart - headerRowHeight;

      // Header background
      currentPage.drawRectangle({
        x: column1X,
        y: headerY,
        width: columnWidth + column2Width,
        height: headerRowHeight,
        color: rgb(1, 1, 1),
        opacity: 1,
      });

      // Criteria header
      const criteriaHeaderWidth = boldFont.widthOfTextAtSize("Критерии оценивания", 10);
      currentPage.drawText("Критерии оценивания", {
        x: column1X + (columnWidth - criteriaHeaderWidth) / 2,
        y: headerY + headerRowHeight / 2 - 5,
        size: 12,
        font: boldFont,
      });

      // Score header
      const scoreHeaderWidth = boldFont.widthOfTextAtSize("Оценка", 10);
      currentPage.drawText("Оценка", {
        x: column2X + (column2Width - scoreHeaderWidth) / 2,
        y: headerY + headerRowHeight / 2 - 5,
        size: 12,
        font: boldFont,
      });

      // Draw header border
      currentPage.drawLine({
        start: { x: column1X, y: currentTableYStart },
        end: { x: column1X + columnWidth + column2Width, y: currentTableYStart },
        thickness: lineThickness,
        color: rgb(0, 0, 0),
      });

      // Draw header border - BOTTOM
      currentPage.drawLine({
        start: { x: column1X, y: headerY },
        end: { x: column1X + columnWidth + column2Width, y: headerY },
        thickness: lineThickness,
        color: rgb(0, 0, 0),
      });

      // Draw rows
      let currentYTable = currentTableYStart - headerRowHeight;

      currentBatch.forEach((item, index) => {
        const rowHeight = currentBatchHeights[index];
        currentYTable -= rowHeight;

        // Draw cell background
        currentPage.drawRectangle({
          x: column1X,
          y: currentYTable,
          width: columnWidth + column2Width,
          height: rowHeight,
          color: (currentIndex + index) % 2 === 0 ? rgb(1, 1, 1) : rgb(1, 1, 1),
          opacity: 1,
        });

        // Draw criteria text with PROPER wrapping
        const lineCount = drawWrappedTextInCell(
          currentPage,
          item.text,
          column1X + padding,
          currentYTable + rowHeight - padding - 8, // Start from top of cell
          columnWidth - padding * 2,
          12, // Smaller font size for better fit
          font,
          12 // Line height
        );

        // Draw score value (centered vertically and horizontally)
        const scoreText = item.value.toString();
        const scoreTextWidth = font.widthOfTextAtSize(scoreText, 10);
        const scoreX = column2X + (column2Width - scoreTextWidth) / 2;
        const scoreY = currentYTable + (rowHeight / 2) - 4; // Center vertically

        currentPage.drawText(scoreText, {
          x: scoreX,
          y: scoreY,
          size: 12,
          font: font,
        });

        // Draw horizontal line
        currentPage.drawLine({
          start: { x: column1X, y: currentYTable },
          end: { x: column1X + columnWidth + column2Width, y: currentYTable },
          thickness: lineThickness,
          color: rgb(0, 0, 0),
        });
      });

      // Draw vertical borders for this batch
      const batchBottomY = currentYTable;

      currentPage.drawLine({
        start: { x: column1X, y: currentTableYStart },
        end: { x: column1X, y: batchBottomY },
        thickness: lineThickness,
        color: rgb(0, 0, 0),
      });

      currentPage.drawLine({
        start: { x: column2X, y: currentTableYStart },
        end: { x: column2X, y: batchBottomY },
        thickness: lineThickness,
        color: rgb(0, 0, 0),
      });

      currentPage.drawLine({
        start: { x: column1X + columnWidth + column2Width, y: currentTableYStart },
        end: { x: column1X + columnWidth + column2Width, y: batchBottomY },
        thickness: lineThickness,
        color: rgb(0, 0, 0),
      });

      // Update remaining criteria and current position
      remainingCriteria = remainingCriteria.slice(rowsToDraw);
      remainingRowHeights = remainingRowHeights.slice(rowsToDraw);
      currentIndex += rowsToDraw;
      currentTableYStart = batchBottomY;
    }

    // Return both the current page and Y position
    return { currentPage, currentY: currentTableYStart };
  };

  // Draw the table with pagination and get the updated page and Y position
  const tableResult = await drawTableWithPagination(currentY, criteria, rowHeights);
  currentPage = tableResult.currentPage;
  currentY = tableResult.currentY - 50; // Add some space after the table

  // Section 2: Results - Now we use the correct currentPage and currentY
  // Check if we need a new page for Section 2
  if (currentY < 150) {
    currentPage = pdfDoc.addPage([595, 842]);
    currentY = 800;
  }

  // Section 2 Header
  currentPage.drawText(
    "РАЗДЕЛ II. Результирующая часть отзыва",
    {
      x: 50,
      y: currentY,
      size: 12,
      font: boldFont,
    }
  );
  currentY -= 30;

  // Questions section
  currentPage.drawText("Вопросы: ", {
    x: 50,
    y: currentY,
    size: 12,
    font: boldFont,
  });
  currentY -= 20;

  thesis.consultantAssessment!.section2.questions.forEach((question: any, i: number) => {
    const questionText = `${i + 1}. ${question}`;

    // Check if we need a new page before drawing
    if (currentY < 50) {
      currentPage = pdfDoc.addPage([595, 842]);
      currentY = 800;
    }

    // Draw the question with wrapping
    currentY = drawWrappedText(
      currentPage,
      questionText,
      50,
      currentY,
      500,
      12,
      font,
      15
    );
  });

  // Advantages/Disadvantages section
  currentY -= 20;

  if (currentY < 100) {
    currentPage = pdfDoc.addPage([595, 842]);
    currentY = 800;
  }

  currentPage.drawText(
    "Достоинства, недостатки, замечания: ",
    {
      x: 50,
      y: currentY,
      size: 12,
      font: boldFont,
    }
  );
  currentY -= 25;

  // Advantages section
  currentPage.drawText("Достоинства: ", {
    x: 50,
    y: currentY,
    size: 12,
    font: boldFont,
  });
  currentY -= 20;

  const advantages = Array.isArray(thesis.consultantAssessment!.section2.advantages)
    ? thesis.consultantAssessment!.section2.advantages
    : [thesis.consultantAssessment!.section2.advantages].filter(Boolean);

  advantages.forEach((advantage: any, index: number) => {
    const itemText = `${index + 1}. ${advantage}`;

    // Check page space before drawing
    if (currentY < 50) {
      currentPage = pdfDoc.addPage([595, 842]);
      currentY = 800;
    }

    // Draw the advantage with text wrapping
    currentY = drawWrappedText(
      currentPage,
      itemText,
      60,
      currentY,
      490,
      12,
      font,
      15
    );
  });

  // Disadvantages
  currentY -= 20;

  if (currentY < 100) {
    currentPage = pdfDoc.addPage([595, 842]);
    currentY = 800;
  }

  currentPage.drawText("Недостатки, замечания: ", {
    x: 50,
    y: currentY,
    size: 12,
    font: boldFont,
  });
  currentY -= 20;

  const disadvantages = Array.isArray(thesis.consultantAssessment!.section2.disadvantages)
    ? thesis.consultantAssessment!.section2.disadvantages
    : [thesis.consultantAssessment!.section2.disadvantages].filter(Boolean);

  disadvantages.forEach((disadvantage: any, index: number) => {
    const itemText = `${index + 1}. ${disadvantage}`;

    // Check if we need a new page before drawing
    if (currentY < 50) {
      currentPage = pdfDoc.addPage([595, 842]);
      currentY = 800;
    }

    // Draw the disadvantage with wrapping
    currentY = drawWrappedText(
      currentPage,
      itemText,
      60,
      currentY,
      490,
      12,
      font,
      15
    );
  });

  // Conclusion section
  currentY -= 30;
  if (currentY < 150) {
    currentPage = pdfDoc.addPage([595, 842]);
    currentY = 800;
  }

  currentPage.drawText("Заключение:", {
    x: 50,
    y: currentY,
    size: 12,
    font: boldFont,
  });

  currentY -= 20;

  const isCompleteTextRu = thesis.consultantAssessment!.section2.conclusion.isComplete ? "Да" : "Нет";
  const isDeservingTextRu = thesis.consultantAssessment!.section2.conclusion.isDeserving ? "Да" : "Нет";

  // Use **text** for bold formatting
  const russianConclusion = `Заключение: Считаю, что данная выпускная квалификационная работа является законченной работой - **${isCompleteTextRu}**, а её автор заслуживает присуждения квалификации ${student.degreeLevel} - **${isDeservingTextRu}**`;
  currentY = drawWrappedText(
    currentPage,
    russianConclusion,
    50,
    currentY,
    500,
    12,
    font,
    15
  );


  currentY -= 40;

  // Signature functionality
  const drawSignatureBlocks = async (
    currentPage: PDFPage,
    currentY: number,
    currentReviewer: IConsultant | ISupervisor,
    student: IStudent,
    isSupervisor: boolean
  ) => {
    const signatureConfig = {
      blockHeight: 60,
      leftX: 50,
      rightX: 300,
      lineLength: 120,
      labelYOffset: 15,
      roleYOffset: 35,
    };

    // Check if we need a new page for signatures
    if (currentY - signatureConfig.blockHeight < 50) {
      currentPage = pdfDoc.addPage([595, 842]);
      currentY = 800;
    }

    // Determine which signatures to show
    const signatures = [];

    signatures.push({
      role: "(Ф.И.О научного руководителя)",
      name: currentReviewer.fullName,
      label: "(эл. подпись научного руководителя)",
      roleType: 'supervisor'
    });

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
        size: 9,
        font: font,
      });

      // Right column - Name and role
      currentPage.drawText(signature.name, {
        x: signatureConfig.rightX,
        y: yPos,
        size: 12,
        font: font,
      });

      currentPage.drawText(signature.role, {
        x: signatureConfig.rightX,
        y: yPos - 10,
        size: 9,
        font: font,
      });
    });

    return currentY - signatures.length * signatureConfig.blockHeight - 20;
  };

  // Draw signatures
  await drawSignatureBlocks(
    currentPage,
    currentY,
    reviewer,
    student,
    isSupervisor
  );

  // Save PDF to file
  const pdfBytes = await pdfDoc.save();
  const fileName = `unsigned_review1_${thesis.student}.pdf`;
  const outputPath = path.join(reviewsDir, fileName);
  fs.writeFileSync(outputPath, pdfBytes);

  return outputPath;
}