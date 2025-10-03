import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import fs from "fs";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { IThesis } from "../models/Thesis.model";
import {
  IReviewer,
  IStudent,
  UserModel,
  Student,
} from "../models/User.model";
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DB_URL
});

const userModel = new UserModel(pool);

export async function generateReviewPDF(
  thesis: IThesis,
  reviewer: IReviewer
): Promise<string> {

  // Ensure reviews directory exists
  const reviewsDir = path.join(__dirname, "../reviews/reviewer/unsigned");
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
  page.drawText("НАЦИОНАЛЬНЫЙ ИССЛЕДОВАТЕЛЬСКИЙ УНИВЕРСИТЕТ ИТМО", {
    x:
      centerX -
      boldFont.widthOfTextAtSize(
        "НАЦИОНАЛЬНЫЙ ИССЛЕДОВАТЕЛЬСКИЙ УНИВЕРСИТЕТ ИТМО",
        11
      ) /
        2,
    y: finalY - 4, // Space between lines
    size: 11,
    font: boldFont,
  });

  page.drawText("ITMO University", {
    x: centerX - boldFont.widthOfTextAtSize("ITMO University", 11) / 2,
    y: 730, // Space between lines
    size: 11,
    font: boldFont,
  });

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
      y: 700, // Adjusted y position for better spacing
      size: 11,
      font: boldFont,
    }
  );

  const student = await Student.findById(userModel, thesis.student);

  if (!student) {
    throw new Error("Student not found");
  }

  // Student information section
  const startY = 670;
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
    `${reviewer.fullName}, ${reviewer.institution}, ${reviewer.position}`,
    50,
    startY - 7 * lineHeight, // Extra space before reviewer section
    10
  );

  //Section 1
  const assessment = thesis.reviewerAssessment!.section1;

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

  const studentInfoBottomY = startY - 8 * lineHeight - 20;

  // Assessment table configuration
  let currentPage = page;
  let currentTableYStart = studentInfoBottomY - 20;
  const column1X = 50; // Criteria column start
  const column2X = 400; // Score column start
  const columnWidth = 350; // Width of first column
  const column2Width = 180; // Width of score column
  const lineThickness = 1;
  const minRowHeight = 20; // Minimum row height
  const padding = 6; // Cell padding
  const headerRowHeight = 25; // Separate height for header row

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

    return Math.max(minRowHeight, lineCount * 14 + padding * 2); // 12px per line
  };

  // Calculate total table height
  let tableHeight = headerRowHeight;
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
  // First calculate the width of the title text
  const sectionTitle = "РАЗДЕЛ I. Оценка BKP/Assessment of the thesis";
  const titleWidth = boldFont.widthOfTextAtSize(sectionTitle, 11);

  // Draw centered table title
  currentPage.drawText(sectionTitle, {
    x: centerX - titleWidth / 2, // Center calculation
    y: currentTableYStart + 20,
    size: 11,
    font: boldFont,
  });

  // Draw table headers on their own row
  const headerY = currentTableYStart - headerRowHeight;

  // Header background
  currentPage.drawRectangle({
    x: column1X,
    y: headerY,
    width: columnWidth + column2Width,
    height: headerRowHeight,
    color: rgb(1, 1, 1), // Light gray background for header
    opacity: 1,
  });

  // Criteria header (centered in its column)
  const criteriaHeaderWidth = boldFont.widthOfTextAtSize(
    "Критерии оценивания",
    10
  );
  currentPage.drawText("Критерии оценивания", {
    x: column1X + (columnWidth - criteriaHeaderWidth) / 2, // Center in column
    y: headerY + headerRowHeight / 2 - 5, // Vertically center
    size: 10,
    font: boldFont,
  });

  // Score header (centered in its column)
  const scoreHeaderWidth = boldFont.widthOfTextAtSize("Оценка", 10);
  currentPage.drawText("Оценка", {
    x: column2X + (column2Width - scoreHeaderWidth) / 2, // Center in column
    y: headerY + headerRowHeight / 2 - 5, // Vertically center
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
  let currentY = currentTableYStart - headerRowHeight; // Start below header
  criteria.forEach((item, index) => {
    const rowHeight = rowHeights[index];
    currentY -= rowHeight;

    // Draw cell background (lighter opacity for better readability)
    currentPage.drawRectangle({
      x: column1X,
      y: currentY,
      width: columnWidth + column2Width,
      height: rowHeight,
      color: index % 2 === 0 ? rgb(1, 1, 1) : rgb(1, 1, 1),
      opacity: 1,
    });

    // Draw criteria text with wrapping and better positioning
    currentPage.drawText(item.text, {
      x: column1X + padding,
      y: currentY + rowHeight - padding - 8, // Adjusted positioning
      size: 10,
      font,
      maxWidth: columnWidth - padding * 2,
      lineHeight: 14, // Increased from 12
    });

    // Draw score value (perfectly centered)
    currentPage.drawText(item.value.toString(), {
      x:
        column2X +
        (column2Width - font.widthOfTextAtSize(item.value.toString(), 10)) / 2,
      y: currentY + rowHeight / 2 - 5,
      size: 10,
      font: boldFont, // Made scores bold for better visibility
    });

    // Draw horizontal line
    currentPage.drawLine({
      start: { x: column1X, y: currentY },
      end: { x: column1X + columnWidth + column2Width, y: currentY },
      thickness: lineThickness,
      color: rgb(0, 0, 0),
    });
  });

  // Draw vertical borders (extended through header)
  currentPage.drawLine({
    start: { x: column1X, y: currentTableYStart },
    end: { x: column1X, y: currentY },
    thickness: lineThickness,
    color: rgb(0, 0, 0),
  });

  currentPage.drawLine({
    start: { x: column2X, y: currentTableYStart },
    end: { x: column2X, y: currentY },
    thickness: lineThickness,
    color: rgb(0, 0, 0),
  });

  currentPage.drawLine({
    start: { x: column1X + columnWidth + column2Width, y: currentTableYStart },
    end: { x: column1X + columnWidth + column2Width, y: currentY },
    thickness: lineThickness,
    color: rgb(0, 0, 0),
  });

  const tableBottomY = currentY;

  // Section 2: Results - with more space after table
  currentY = tableBottomY - 50; // Increased from 40 to 50

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

  thesis.reviewerAssessment!.section2.questions.forEach((question: any, i: number) => {
    // Calculate how much space this question will need
    const questionText = `${i + 1}. ${question}`;
    const words = questionText.split(" ");
    let lineCount = 1;
    let currentLineWidth = 0;

    for (const word of words) {
      const wordWidth = font.widthOfTextAtSize(word + " ", 10);
      if (currentLineWidth + wordWidth > 500) {
        lineCount++;
        currentLineWidth = wordWidth;
      } else {
        currentLineWidth += wordWidth;
      }
    }

    const questionHeight = lineCount * 15; // 12 lineHeight + 3 padding

    // Check if we need a new page before drawing
    if (currentY - questionHeight < 50) {
      currentPage = pdfDoc.addPage([595, 842]);
      currentY = 800;
    }

    // Draw the question with wrapping
    currentPage.drawText(questionText, {
      x: 50,
      y: currentY,
      size: 10,
      font,
      maxWidth: 500,
      lineHeight: 12,
    });

    // Update Y position based on actual lines used
    currentY -= questionHeight;
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

  // Advantages section with proper text wrapping
  currentPage.drawText("Достоинства / Advantages:", {
    x: 50,
    y: currentY,
    size: 10,
    font: boldFont,
  });
  currentY -= 20; // Space after header

 const advantages = Array.isArray(thesis.reviewerAssessment!.section2.advantages) 
  ? thesis.reviewerAssessment!.section2.advantages 
  : [thesis.reviewerAssessment!.section2.advantages].filter(Boolean);

advantages.forEach((advantage: any, index: number) => {
  const itemText = `${index + 1}. ${advantage}`;
    // Calculate required height for this advantage
    const words = itemText.split(" ");
    let lineCount = 1;
    let currentLineWidth = 0;

    for (const word of words) {
      const wordWidth = font.widthOfTextAtSize(word + " ", 10);
      if (currentLineWidth + wordWidth > 490) {
        lineCount++;
        currentLineWidth = wordWidth;
      } else {
        currentLineWidth += wordWidth;
      }
    }

    const itemHeight = lineCount * 15; // 12 lineHeight + 3 padding

    // Check page space before drawing
    if (currentY - itemHeight < 50) {
      // 50px bottom margin
      currentPage = pdfDoc.addPage([595, 842]);
      currentY = 800;
    }

    // Draw the advantage with text wrapping
    currentPage.drawText(itemText, {
      x: 60, // Indented
      y: currentY,
      size: 10,
      font,
      maxWidth: 490,
      lineHeight: 12,
    });

    // Update vertical position
    currentY -= itemHeight;
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

const disadvantages = Array.isArray(thesis.reviewerAssessment!.section2.disadvantages) 
  ? thesis.reviewerAssessment!.section2.disadvantages 
  : [thesis.reviewerAssessment!.section2.disadvantages].filter(Boolean);

disadvantages.forEach((disadvantage: any, index: number) => {
  const itemText = `${index + 1}. ${disadvantage}`;
    // Calculate how many lines this item will need
    const words = itemText.split(" ");
    let lineCount = 1;
    let currentLineWidth = 0;

    for (const word of words) {
      const wordWidth = font.widthOfTextAtSize(word + " ", 10);
      if (currentLineWidth + wordWidth > 490) {
        lineCount++;
        currentLineWidth = wordWidth;
      } else {
        currentLineWidth += wordWidth;
      }
    }

    const itemHeight = lineCount * 15; // 12 lineHeight + 3 padding

    // Check if we need a new page before drawing
    if (currentY - itemHeight < 50) {
      // 50px bottom margin
      currentPage = pdfDoc.addPage([595, 842]);
      currentY = 800;
    }

    // Draw the disadvantage with wrapping
    currentPage.drawText(itemText, {
      x: 60, // Indented slightly
      y: currentY,
      size: 10,
      font,
      maxWidth: 490, // Slightly less due to indentation
      lineHeight: 12,
    });

    // Update Y position based on actual lines used
    currentY -= itemHeight;
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

  // Conclusion text (Russian)
  const isCompleteTextRu = thesis.reviewerAssessment!.section2.conclusion.isComplete
    ? "Да"
    : "Нет";
  const isDeservingTextRu = thesis.reviewerAssessment!.section2.conclusion.isDeserving
    ? "Да"
    : "Нет";

  // Conclusion text (English)
  const isCompleteTextEn = thesis.reviewerAssessment!.section2.conclusion.isComplete
    ? "Yes"
    : "No";
  const isDeservingTextEn = thesis.reviewerAssessment!.section2.conclusion.isDeserving
    ? "Yes"
    : "No";

  currentY -= 20;


  // Helper function for wrapped text with bold capability
 const drawWrappedText = (
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  font: PDFFont,
  boldFont: PDFFont,
  boldParts: string[] = [],
  lineHeight = 15
) => {
  const words = text.split(' ');
  let currentLine = '';
  let currentY = y;

  // Modified regex to match all occurrences
  const boldRegex = new RegExp(`(${boldParts.map(escapeRegExp).join('|')})`, 'gi');

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, size);

    if (testWidth > maxWidth && currentLine) {
      // Draw the current line with all bold parts
      drawMixedFontLine(page, currentLine, x, currentY, size, font, boldFont, boldRegex);
      currentY -= lineHeight;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  // Draw the last line
  if (currentLine) {
    drawMixedFontLine(page, currentLine, x, currentY, size, font, boldFont, boldRegex);
  }

  return currentY - lineHeight;
};

// Helper to escape regex special characters
function escapeRegExp(string: any) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Improved mixed font line drawing
const drawMixedFontLine = (
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  boldFont: PDFFont,
  boldRegex: RegExp
) => {
  let currentX = x;
  let lastIndex = 0;
  let match;
  
  // Reset regex state
  boldRegex.lastIndex = 0;

  while ((match = boldRegex.exec(text)) !== null) {
    // Draw normal text before the bold part
    if (match.index > lastIndex) {
      const normalText = text.substring(lastIndex, match.index);
      page.drawText(normalText, {
        x: currentX,
        y,
        size,
        font
      });
      currentX += font.widthOfTextAtSize(normalText, size);
    }

    // Draw bold text (all occurrences)
    const boldText = match[0];
    page.drawText(boldText, {
      x: currentX,
      y,
      size,
      font: boldFont
    });
    currentX += boldFont.widthOfTextAtSize(boldText, size);
    lastIndex = match.index + match[0].length;
  }

  // Draw remaining normal text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    page.drawText(remainingText, {
      x: currentX,
      y,
      size,
      font
    });
  }
};

  if (!thesis.finalGrade) {
    throw new Error("Thesis final grade is required");
  }

  // Draw final grade with wrapping and bold grade
  const gradeText = `Итоговая оценка ВКР - ${thesis.finalGrade}. / Final Assessment of the thesis - ${thesis.finalGrade}.`;
  currentY = drawWrappedText(
    currentPage,
    gradeText,
    50,
    currentY,
    500, // maxWidth
    10, // size
    font,
    boldFont,
    ["Итоговая оценка", thesis.finalGrade, "Final Assessment", thesis.finalGrade] // parts to bold
  );

  currentY -= 10;
  // Draw Russian conclusion with wrapping and bold parts
  const russianConclusion = `Заключение: Считаю, что данная выпускная квалификационная работа является законченной работой - ${isCompleteTextRu}, а её автор заслуживает присуждения квалификации ${student.degreeLevel} - ${isDeservingTextRu}`;
  currentY = drawWrappedText(
    currentPage,
    russianConclusion,
    50,
    currentY,
    500,
    10,
    font,
    boldFont,
    ["Заключение:", isCompleteTextRu, student.degreeLevel, isDeservingTextRu]
  );

  currentY -= 5;

  // Draw English conclusion with wrapping and bold parts
  const englishConclusion = `Conclusion: I believe that the present graduation thesis is complete - ${isCompleteTextEn}, and its author is deserving of being awarded a ${student.degreeLevel} degree - ${isDeservingTextEn}`;
  currentY = drawWrappedText(
    currentPage,
    englishConclusion,
    50,
    currentY,
    500,
    10,
    font,
    boldFont,
    ["Conclusion:", isCompleteTextEn, student.degreeLevel, isDeservingTextEn]
  );

  currentY -= 30;

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
        y: yPos,
        size: 10,
        font: boldFont,
      });

      currentPage.drawText(signature.role, {
        x: signatureConfig.rightX,
        y: yPos - 10,
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
  const outputPath = path.join(reviewsDir, `unsigned_review_${thesis.student}.pdf`);
  fs.writeFileSync(outputPath, pdfBytes);

  return outputPath;
}
