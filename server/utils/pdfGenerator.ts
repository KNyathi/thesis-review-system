import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import fontkit from '@pdf-lib/fontkit';
import { IThesis } from '../models/Thesis.model';
import { IReviewer, IStudent } from '../models/User.model';

export async function generateReviewPDF(thesis: IThesis, reviewer: IReviewer): Promise<string> {
  // Ensure reviews directory exists
  const reviewsDir = path.join(__dirname, '../reviews');
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
    path.join(__dirname, '../assets/fonts/Arial_Cyr.ttf')
  );
  const boldFontBytes = fs.readFileSync(
    path.join(__dirname, '../assets/fonts/Arial_Cyr_Bold.ttf') // Bold variant
  );

  // Embed both fonts
  const font = await pdfDoc.embedFont(regularFontBytes);
  const boldFont = await pdfDoc.embedFont(boldFontBytes);


  // Draw header
  page.drawText('Министерство науки и высшего образования Российской Федерации', {
    x: 50,
    y: 800,
    size: 10,
    font: boldFont,
  });

  // Draw university info
  page.drawText('НАЦИОНАЛЬНЫЙ ИССЛЕДОВАТЕЛЬСКИЙ УНИВЕРСИТЕТ ИТМО', {
    x: 50,
    y: 780,
    size: 12,
    font: boldFont,
  });

  // Draw title
  page.drawText('РЕЦЕНЗИЯ НА ВЫПУСКНУЮ КВАЛИФИКАЦИОННУЮ РАБОТУ / REVIEW OF A GRADUATION THESIS', {
    x: 50,
    y: 750,
    size: 12,
    font: boldFont,
  });

  // Student information section
  const student = thesis.student as IStudent;
  page.drawText(`Обучающийся / Student: ${student.fullName}`, {
    x: 50,
    y: 700,
    size: 10,
    font,
  });
  // Continue with all student fields...

  // Reviewer information
  page.drawText(`Рецензент / Reviewer: ${reviewer.fullName}, ${reviewer.institution}, ${reviewer.positions.join(', ')}`, {
    x: 50,
    y: 650,
    size: 10,
    font,
  });

  // Section 1: Assessment
  page.drawText('РАЗДЕЛ I. Оценка BKP/Assessment of the thesis', {
    x: 50,
    y: 600,
    size: 12,
    font: boldFont,
  });

  // Draw assessment table
  const assessment = thesis.assessment!.section1;
  const tableYStart = 580;
  const rowHeight = 20;

  // Table headers
  page.drawText('Критерии оценивания', {
    x: 50,
    y: tableYStart,
    size: 10,
    font: boldFont,
  });
  page.drawText('Оценка', {
    x: 350,
    y: tableYStart,
    size: 10,
    font: boldFont,
  });

  // Table rows
  const criteria = [
    { text: 'Соответствие содержания работы утвержденной теме BKP', value: assessment.topicCorrespondence },
    { text: 'Обоснование актуальности темы', value: assessment.relevanceJustification },
    // Add all other criteria...
  ];

  criteria.forEach((item, index) => {
    const y = tableYStart - (index + 1) * rowHeight;
    page.drawText(item.text, { x: 50, y, size: 10, font });
    page.drawText(item.value, { x: 350, y, size: 10, font });
  });

  // Section 2: Results
  page.drawText('РАЗДЕЛ II. Результирующая часть отзыва / Results of the assessment', {
    x: 50,
    y: 400,
    size: 12,
    font: boldFont,
  });

  // Questions
  page.drawText('Вопросы / Questions:', { x: 50, y: 380, size: 10, font: boldFont });
  thesis.assessment!.section2.questions.forEach((question, i) => {
    page.drawText(`${i + 1}. ${question}`, { x: 50, y: 360 - i * 20, size: 10, font });
  });

  // Advantages/Disadvantages
  page.drawText('Достоинства, недостатки, замечания:', { x: 50, y: 300, size: 10, font: boldFont });
  // Add advantages and disadvantages...

  // Conclusion
  page.drawText('Заключение / Conclusion:', { x: 50, y: 200, size: 12, font: boldFont });
  page.drawText(`Итоговая оценка ВКР - ${thesis.assessment!.section2.conclusion.finalAssessment}`, {
    x: 50,
    y: 180,
    size: 10,
    font,
  });

  // Save PDF to file
  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(reviewsDir, `review_${thesis._id}.pdf`);
  fs.writeFileSync(outputPath, pdfBytes);

  return outputPath;
}