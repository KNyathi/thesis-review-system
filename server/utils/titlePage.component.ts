import { PDFDocument, rgb, PDFPage, PDFFont } from "pdf-lib";
import { IThesis } from "../models/Thesis.model";
import {
    IStudent,
    UserModel,
} from "../models/User.model";
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DB_URL
});

const userModel = new UserModel(pool);

export async function createTitlePage(
    pdfDoc: PDFDocument,
    font: PDFFont,
    boldFont: PDFFont,
    thesis: IThesis,
    student: IStudent
): Promise<PDFPage> {
    const page = pdfDoc.addPage([595, 842]);
    const maxWidth = 500;
    const centerX = 595 / 2;
    let currentY = 780;


    const hods = await userModel.getHeadsOfDepartment();
    const hod = hods.find(h => h.faculty === student.faculty);

    if (!hod) {
        throw new Error(`HOD not found for faculty: ${student.faculty}`);
    }
    const supervisorId = student?.supervisor || "";

    const supervisor = await userModel.getUserById(supervisorId);
    if (!supervisor) {
        throw new Error(`Supervisor not found for student: ${student.fullName}`);
    }

    const supervisorName = supervisor.fullName;

    const consultants = await userModel.getConsultants();
    const consultant = consultants.find(h => h.faculty === student.faculty);

    const hodName = hod.fullName;
    const consultantName = consultant?.fullName || "";

    // Centered wrapped text function
    const drawCenteredWrappedText = (
        page: PDFPage,
        text: string,
        y: number,
        maxWidth: number, // This should be the actual maximum width for the text
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
        const centerX = 595 / 2;

        lines.forEach(line => {
            const lineWidth = font.widthOfTextAtSize(line, fontSize);

            // Ensure the line doesn't extend beyond page boundaries
            const leftBound = centerX - (maxWidth / 2);
            const rightBound = centerX + (maxWidth / 2);
            const actualLeft = centerX - (lineWidth / 2);

            // If the line is too wide, we need to handle it differently
            if (lineWidth > maxWidth) {
                // For overly long lines, we need to break them further
                const longWords = line.split(' ');
                let subLine = '';
                const subLines: string[] = [];

                for (const word of longWords) {
                    const testSubLine = subLine ? subLine + ' ' + word : word;
                    const testSubWidth = font.widthOfTextAtSize(testSubLine, fontSize);

                    if (testSubWidth > maxWidth && subLine !== '') {
                        subLines.push(subLine);
                        subLine = word;
                    } else {
                        subLine = testSubLine;
                    }
                }
                if (subLine) subLines.push(subLine);

                // Draw the sublines
                subLines.forEach(subLine => {
                    const subLineWidth = font.widthOfTextAtSize(subLine, fontSize);
                    page.drawText(subLine, {
                        x: centerX - subLineWidth / 2,
                        y: currentY,
                        size: fontSize,
                        font,
                        color,
                    });
                    currentY -= lineHeight;
                });
            } else {
                // Normal line that fits within maxWidth
                page.drawText(line, {
                    x: centerX - lineWidth / 2,
                    y: currentY,
                    size: fontSize,
                    font,
                    color,
                });
                currentY -= lineHeight;
            }
        });

        return currentY;
    };

    currentY = drawCenteredWrappedText(
        page,
        "Министерство цифрового развития, связи и массовых коммуникаций",
        currentY,
        maxWidth,
        12,
        font,
        15
    );

    currentY = drawCenteredWrappedText(
        page,
        "Российской Федерации",
        currentY - 10,
        maxWidth,
        12,
        font,
        15
    );

    currentY = drawCenteredWrappedText(
        page,
        "Ордена Трудового Красного Знамени федеральное государственное",
        currentY - 10,
        maxWidth,
        12,
        font,
        15
    );

    currentY = drawCenteredWrappedText(
        page,
        "бюджетное образовательное учреждение высшего образования",
        currentY - 10,
        maxWidth,
        12,
        font,
        15
    );

    currentY = drawCenteredWrappedText(
        page,
        "«Московский технический университет связи и информатики»",
        currentY - 10,
        maxWidth,
        12,
        font,
        15
    );

    currentY -= 40;
    const leftMargin = 120;

    // "Разрешаю допустить к защите" section - LEFT ALIGNED but text centered within their lines
    const permitText = "Разрешаю";
    const permitWidth = font.widthOfTextAtSize(permitText, 12);
    page.drawText(permitText, {
        x: leftMargin - permitWidth / 2,
        y: currentY - 10,
        size: 12,
        font: font,
    });

    currentY -= 20;

    const admitText = "допустить к защите";
    const admitWidth = font.widthOfTextAtSize(admitText, 12);
    page.drawText(admitText, {
        x: leftMargin - admitWidth / 2,
        y: currentY - 10,
        size: 12,
        font: font,
    });

    currentY -= 20;

    // Department head signature section - LEFT ALIGNED but text centered
    const deptHeadText = "Зав. кафедрой";
    const deptHeadWidth = font.widthOfTextAtSize(deptHeadText, 12);
    page.drawText(deptHeadText, {
        x: leftMargin - deptHeadWidth / 2,
        y: currentY - 10,
        size: 12,
        font: font,
    });

    currentY -= 20;

    // Underlined department head name
    const deptHeadName = hodName;
    const deptHeadNameWidth = font.widthOfTextAtSize(deptHeadName, 12);
    page.drawText(deptHeadName, {
        x: leftMargin,
        y: currentY - 10,
        size: 12,
        font: font,
    });

    // Draw underline for department head name
    page.drawLine({
        start: { x: leftMargin - 120 / 2, y: currentY - 12 },
        end: { x: leftMargin + 200 / 2, y: currentY - 12 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });

    currentY -= 20;

    // Date line with current year - centered and underlined
    const currentYear = new Date().getFullYear();
    const dateText = `${currentYear} г.`;
    const dateWidth = font.widthOfTextAtSize(dateText, 12);
    page.drawText(dateText, {
        x: leftMargin,
        y: currentY - 10,
        size: 12,
        font: font,
    });

    // Draw underline for date
    page.drawLine({
        start: { x: leftMargin - 120 / 2, y: currentY - 12 },
        end: { x: leftMargin + 200 / 2, y: currentY - 12 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });


    currentY -= 120;


    const mainTitle = "ВЫПУСКНАЯ КВАЛИФИКАЦИОННАЯ РАБОТА";
    const mainTitleWidth = boldFont.widthOfTextAtSize(mainTitle, 20);
    page.drawText(mainTitle, {
        x: centerX - mainTitleWidth / 2,
        y: currentY,
        size: 20,
        font: boldFont,
    });

    currentY -= 50;

    // "НА ТЕМУ"
    const themeLabel = "НА ТЕМУ";
    const themeLabelWidth = font.widthOfTextAtSize(themeLabel, 12);
    page.drawText(themeLabel, {
        x: centerX - themeLabelWidth / 2,
        y: currentY,
        size: 12,
        font: font,
    });

    currentY -= 50;

    // Thesis topic in quotes
    const topicText = `«${thesis.title}»`;
    currentY = drawCenteredWrappedText(
        page,
        topicText,
        currentY,
        maxWidth - 50,
        14,
        font,
        18
    );

    currentY -= 130;

    // Student and supervisors table
    const tableLeft = 180;
    const valueLeft = 280;

    // Student row
    const permitWidth1 = font.widthOfTextAtSize(student.fullName, 12);
    page.drawText("Студент:", {
        x: tableLeft,
        y: currentY,
        size: 12,
        font: font,
    });
    page.drawText(student.fullName, {
        x: valueLeft,
        y: currentY,
        size: 12,
        font: font,
    });

    page.drawLine({
        start: { x: valueLeft, y: currentY - 2 },
        end: { x: valueLeft + permitWidth1, y: currentY - 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });
    currentY -= 25;

    // Supervisor row
    const permitWidth2 = font.widthOfTextAtSize(supervisorName, 12);

    page.drawText("Руководитель:", {
        x: tableLeft,
        y: currentY,
        size: 12,
        font: font,
    });
    page.drawText(supervisorName, {
        x: valueLeft,
        y: currentY,
        size: 12,
        font: font,
    });

    page.drawLine({
        start: { x: valueLeft, y: currentY - 2 },
        end: { x: valueLeft + permitWidth2, y: currentY - 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });

    currentY -= 25;

    const permitWidth3 = font.widthOfTextAtSize(consultantName, 12);
    // Consultant row - ONLY if consultant exists
    if (student.consultant) {
        page.drawText("Консультант:", {
            x: tableLeft,
            y: currentY,
            size: 12,
            font: font,
        });
        page.drawText(consultantName, {
            x: valueLeft,
            y: currentY,
            size: 12,
            font: font,
        });

        page.drawLine({
            start: { x: valueLeft, y: currentY - 2 },
            end: { x: valueLeft + permitWidth3, y: currentY - 2 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });
        currentY -= 25;
    }

    currentY -= 50;

    const locationText = `Москва, ${currentYear}г.`;
    const locationWidth = font.widthOfTextAtSize(locationText, 12);
    page.drawText(locationText, {
        x: centerX - locationWidth / 2,
        y: currentY,
        size: 12,
        font: font,
    });

    return page;
}