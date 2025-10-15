import { PDFDocument, rgb, PDFPage, PDFFont } from "pdf-lib";
import { IThesis } from "../models/Thesis.model";
import UserModel, { IStudent } from "../models/User.model";
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DB_URL
});

const userModel = new UserModel(pool);

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
    let currentY = 780;


    // Function to check if we need a new page
    const checkNewPage = (requiredSpace: number): PDFPage => {
        if (currentY - requiredSpace < 50) {
            page = pdfDoc.addPage([595, 842]);
            currentY = 780;
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

    // Header
    checkNewPage(50);

    currentY = drawCenteredWrappedText(
        page,
        "ОБЪЕМНОЕ ЗАДАНИЕ",
        currentY,
        maxWidth,
        18,
        boldFont,
        15
    );

    currentY -= 15;

    currentY = drawCenteredWrappedText(
        page,
        "Министерство цифрового развития, связи и массовых коммуникаций Российской",
        currentY,
        maxWidth,
        12,
        font,
        15
    );

    currentY = drawCenteredWrappedText(
        page,
        "Федерации Ордена Трудового Красного Знамени",
        currentY - 5,
        maxWidth,
        12,
        font,
        15
    );

    currentY = drawCenteredWrappedText(
        page,
        "федеральное государственное бюджетное образовательное учреждение",
        currentY - 5,
        maxWidth,
        12,
        font,
        15
    );

    currentY = drawCenteredWrappedText(
        page,
        "высшего образования",
        currentY - 5,
        maxWidth,
        12,
        font,
        15
    );

    currentY = drawCenteredWrappedText(
        page,
        "«Московский технический университет связи и информатики»",
        currentY - 5,
        maxWidth,
        12,
        font,
        15
    );

    currentY -= 20;

    // Department - Underlined instead of underscores
    checkNewPage(40);
    const departmentText = "Кафедра             Математическая кибернетика и информационные технологии";
    const departmentWidth = font.widthOfTextAtSize(departmentText, 12);
    page.drawText(departmentText, {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
    });
    // Draw underline for HOD name only (not the whole line)
    const depNameStart = leftMargin + font.widthOfTextAtSize("Кафедра ", 12);
    const depNameWidth = font.widthOfTextAtSize(departmentText, 12);
    page.drawLine({
        start: { x: depNameStart, y: currentY - 2 },
        end: { x: depNameStart + depNameWidth, y: currentY - 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });


    currentY = drawCenteredWrappedText(
        page,
        "(название полностью)",
        currentY - 12,
        maxWidth,
        9,
        font,
        15
    );

    currentY -= 10;

    page.drawText("«Утверждаю»", {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
    });
    currentY -= 15;

    // Get HOD data and underline the name
    const hods = await userModel.getHeadsOfDepartment();
    const hod = hods.find(h => h.faculty === student.faculty);
    if (!hod) {
        throw new Error(`HOD not found for faculty: ${student.faculty}`);
    }

    const hodName = hod.fullName;

    const hodText = `Зав. кафедрой ${hodName}`;
    const hodWidth = font.widthOfTextAtSize(hodText, 12);
    page.drawText(hodText, {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
    });
    // Draw underline for HOD name only (not the whole line)
    const hodNameStart = leftMargin + font.widthOfTextAtSize("Зав. кафедрой ", 12);
    const hodNameWidth = font.widthOfTextAtSize(hodName, 12);
    page.drawLine({
        start: { x: hodNameStart, y: currentY - 2 },
        end: { x: hodNameStart + hodNameWidth, y: currentY - 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });
    currentY -= 15;

    // Date line with underline
    const currentYear = new Date().getFullYear();
    const dateText = `«______»_______________________${currentYear}г.`;
    const dateWidth = font.widthOfTextAtSize(dateText, 12);
    page.drawText(dateText, {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
    });
    // Draw underline for the date part only
    const dateUnderlineStart = leftMargin + font.widthOfTextAtSize("«______»_______________________", 12);
    const dateUnderlineWidth = font.widthOfTextAtSize(`${currentYear}г.`, 12);
    page.drawLine({
        start: { x: dateUnderlineStart, y: currentY - 1 },
        end: { x: dateUnderlineStart + dateUnderlineWidth, y: currentY - 1 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });
    currentY -= 40;

    // Main title
    checkNewPage(50);
    currentY = drawCenteredWrappedText(
        page,
        "ЗАДАНИЕ",
        currentY,
        maxWidth,
        14,
        boldFont,
        15
    );

    currentY -= 5;

    currentY = drawCenteredWrappedText(
        page,
        "на выпускную квалификационную работу",
        currentY,
        maxWidth,
        12,
        boldFont,
        15
    );

    currentY -= 20;

    // Student info with underlines
    checkNewPage(100);

    // Student name and group - WITH WRAPPING
    const studentPrefix = "Студенту   ";
    const groupPrefix = " гр. ";
    const studentPrefixWidth = font.widthOfTextAtSize(studentPrefix, 12);
    const groupPrefixWidth = font.widthOfTextAtSize(groupPrefix, 12);

    page.drawText(studentPrefix, {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
    });

    // Underline student name
    const studentName = student.fullName;
    const studentNameWidth = font.widthOfTextAtSize(studentName, 12);
    page.drawText(studentName, {
        x: leftMargin + studentPrefixWidth,
        y: currentY,
        size: 12,
        font: font,
    });
    page.drawLine({
        start: { x: leftMargin + studentPrefixWidth, y: currentY - 2 },
        end: { x: leftMargin + studentPrefixWidth + studentNameWidth, y: currentY - 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });

    // Group prefix
    page.drawText(groupPrefix, {
        x: leftMargin + studentPrefixWidth + studentNameWidth,
        y: currentY,
        size: 12,
        font: font,
    });

    // Underline group
    const groupText = student.group || '';
    const groupTextWidth = font.widthOfTextAtSize(groupText, 12);
    if (groupText) {
        page.drawText(groupText, {
            x: leftMargin + studentPrefixWidth + studentNameWidth + groupPrefixWidth,
            y: currentY,
            size: 12,
            font: font,
        });
        page.drawLine({
            start: { x: leftMargin + studentPrefixWidth + studentNameWidth + groupPrefixWidth, y: currentY - 2 },
            end: { x: leftMargin + studentPrefixWidth + studentNameWidth + groupPrefixWidth + groupTextWidth, y: currentY - 2 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });
    } else {
        // Empty group - draw long underline
        page.drawLine({
            start: { x: leftMargin + studentPrefixWidth + studentNameWidth + groupPrefixWidth, y: currentY - 2 },
            end: { x: leftMargin + studentPrefixWidth + studentNameWidth + groupPrefixWidth + 80, y: currentY - 2 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });
    }
    currentY -= 30;

    // Direction/specialty - WITH WRAPPING
    const directionPrefix = "Направление (специальность)    ";
    const directionText = student.subjectArea;
    const directionPrefixWidth = font.widthOfTextAtSize(directionPrefix, 12);
    const directionTextWidth = font.widthOfTextAtSize(directionText, 12);

    page.drawText(directionPrefix, {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
    });

    // Underline the entire specialty field
    page.drawText(directionText, {
        x: leftMargin + directionPrefixWidth,
        y: currentY,
        size: 12,
        font: font,
    });
    page.drawLine({
        start: { x: leftMargin + directionPrefixWidth, y: currentY - 2 },
        end: { x: leftMargin + directionPrefixWidth + directionTextWidth, y: currentY - 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });
    currentY -= 30;

    // Work form - WITH WRAPPING
    const workFormPrefix = "Форма выполнения выпускной квалификационной работы      ";
    const workFormText = "Бакалаврская работа"; //to change this
    const workFormPrefixWidth = font.widthOfTextAtSize(workFormPrefix, 12);
    const workFormTextWidth = font.widthOfTextAtSize(workFormText, 12);

    page.drawText(workFormPrefix, {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
    });

    // Underline the entire work form field
    page.drawText(workFormText, {
        x: leftMargin + workFormPrefixWidth,
        y: currentY,
        size: 12,
        font: font,
    });
    page.drawLine({
        start: { x: leftMargin + workFormPrefixWidth, y: currentY - 2 },
        end: { x: leftMargin + workFormPrefixWidth + workFormTextWidth, y: currentY - 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });
    page.drawLine({
        start: { x: leftMargin, y: currentY - 15 },
        end: { x: leftMargin + 490, y: currentY - 15 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });

    currentY = drawCenteredWrappedText(
        page,
        "(Дипломный проект, дипломная работа, магистерская дисссертация, бакалаврская работа)",
        currentY - 24,
        maxWidth,
        9,
        font,
        15
    );
    currentY -= 20;

    // Thesis topic - PROPER WRAPPING
    const topicPrefix = "Тема выпускной квалификационной работы:      ";
    const topicPrefixWidth = font.widthOfTextAtSize(topicPrefix, 12);
    const topicText = thesis.title;

    page.drawText(topicPrefix, {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
    });

    // Simple word wrapping function
    const wrapText = (text: string, maxWidth: number): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const testWidth = font.widthOfTextAtSize(testLine, 12);

            if (testWidth > maxWidth) {
                if (currentLine) {
                    lines.push(currentLine);
                }
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    };

    // First line - calculate with prefix space
    const availableWidthFirstLine = 500 - topicPrefixWidth;
    const firstLineWords: string[] = [];
    let firstLineText = '';

    // Build first line word by word
    const words = topicText.split(' ');
    for (const word of words) {
        const testLine = firstLineText ? firstLineText + ' ' + word : word;
        const testWidth = font.widthOfTextAtSize(testLine, 12);

        if (testWidth <= availableWidthFirstLine) {
            firstLineText = testLine;
            firstLineWords.push(word);
        } else {
            break;
        }
    }

    // Remaining text for other lines
    const remainingWords = words.slice(firstLineWords.length);
    const remainingText = remainingWords.join(' ');

    // Draw first line
    if (firstLineText) {
        const firstLineWidth = font.widthOfTextAtSize(firstLineText, 12);
        page.drawText(firstLineText, {
            x: leftMargin + topicPrefixWidth,
            y: currentY,
            size: 12,
            font: font,
        });
        page.drawLine({
            start: { x: leftMargin + topicPrefixWidth, y: currentY - 2 },
            end: { x: leftMargin + topicPrefixWidth + firstLineWidth, y: currentY - 2 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });
        currentY -= 18;
    }

    // Draw remaining lines with full width
    if (remainingText) {
        const remainingLines = wrapText(remainingText, 500); // Full width for remaining lines

        for (const line of remainingLines) {
            const lineWidth = font.widthOfTextAtSize(line, 12);
            page.drawText(line, {
                x: leftMargin,
                y: currentY,
                size: 12,
                font: font,
            });
            page.drawLine({
                start: { x: leftMargin, y: currentY - 2 },
                end: { x: leftMargin + lineWidth + 300, y: currentY - 2 },
                thickness: 1,
                color: rgb(0, 0, 0),
            });
            currentY -= 18;
        }
    }

    currentY -= 10;
    // Rector approval - WITH WRAPPING
    const rectorPrefix = "Утверждена приказом ректора №   ";
    const orderNumber = "55-с   ";
    const datePrefix = " от    ";
    const approvalDate = "21.01.2025";
    const rectorPrefixWidth = font.widthOfTextAtSize(rectorPrefix, 12);
    const orderNumberWidth = font.widthOfTextAtSize(orderNumber, 12);
    const datePrefixWidth = font.widthOfTextAtSize(datePrefix, 12);
    const approvalDateWidth = font.widthOfTextAtSize(approvalDate, 12);

    page.drawText(rectorPrefix, {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
    });

    // Underline order number
    const orderNumberStart = leftMargin + rectorPrefixWidth;
    page.drawText(orderNumber, {
        x: orderNumberStart,
        y: currentY,
        size: 12,
        font: font,
    });
    page.drawLine({
        start: { x: orderNumberStart, y: currentY - 2 },
        end: { x: orderNumberStart + orderNumberWidth, y: currentY - 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });

    // Date prefix
    page.drawText(datePrefix, {
        x: orderNumberStart + orderNumberWidth,
        y: currentY,
        size: 12,
        font: font,
    });

    // Underline date
    const dateStart = orderNumberStart + orderNumberWidth + datePrefixWidth;
    page.drawText(approvalDate, {
        x: dateStart,
        y: currentY,
        size: 12,
        font: font,
    });
    page.drawLine({
        start: { x: dateStart, y: currentY - 2 },
        end: { x: dateStart + approvalDateWidth, y: currentY - 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });

    currentY -= 300;

    //WORK ON THIS TABLE

    currentY -= 20;

    // WORK ON THIS TABLE - ADDING THE CHAPTER STRUCTURE TABLE
    checkNewPage(200);

    // Table headers
    const col1X = leftMargin; // Chapter column
    const col2X = leftMargin + 300; // Percentage column
    const col3X = leftMargin + 380; // Date column
    

    currentY -= 20;

    // Chapter 1 data
    page.drawText("Глава 1. Аналитический раздел", {
        x: col1X,
        y: currentY,
        size: 12,
        font: font,
    });
    
    page.drawText("1.1. Актуальность работы", {
        x: col1X + 20,
        y: currentY - 15,
        size: 12,
        font: font,
    });
    
    page.drawText("1.2. Анализ VR-Симуляторов", {
        x: col1X + 20,
        y: currentY - 30,
        size: 12,
        font: font,
    });
    
    page.drawText("1.3. Особенности сборки беспилотных летательных аппаратов (БПЛА)", {
        x: col1X + 20,
        y: currentY - 45,
        size: 12,
        font: font,
    });
    
    page.drawText("1.4. Анализ существующих решений", {
        x: col1X + 20,
        y: currentY - 60,
        size: 12,
        font: font,
    });

    // Percentage and date for Chapter 1
    page.drawText("30%", {
        x: col2X,
        y: currentY - 30,
        size: 12,
        font: font,
    });
    
    page.drawText("11.04.2025", {
        x: col3X,
        y: currentY - 30,
        size: 12,
        font: font,
    });

    currentY -= 80;

    // Chapter 2 data
    page.drawText("Глава 2. Проектирование платформы", {
        x: col1X,
        y: currentY,
        size: 12,
        font: font,
    });
    
    page.drawText("2.1. Цель и задачи главы", {
        x: col1X + 20,
        y: currentY - 15,
        size: 12,
        font: font,
    });
    
    page.drawText("2.2. Обоснование выбора инструментов и технологий", {
        x: col1X + 20,
        y: currentY - 30,
        size: 12,
        font: font,
    });
    
    page.drawText("2.3. Архитектура приложения", {
        x: col1X + 20,
        y: currentY - 45,
        size: 12,
        font: font,
    });
    
    page.drawText("2.4. Модули", {
        x: col1X + 20,
        y: currentY - 60,
        size: 12,
        font: font,
    });

    // Percentage and date for Chapter 2
    page.drawText("35%", {
        x: col2X,
        y: currentY - 30,
        size: 12,
        font: font,
    });
    
    page.drawText("29.04.2025", {
        x: col3X,
        y: currentY - 30,
        size: 12,
        font: font,
    });

    currentY -= 80;

    // Chapter 3 data
    page.drawText("Глава 3. Разработка симулятора", {
        x: col1X,
        y: currentY,
        size: 12,
        font: font,
    });
    
    page.drawText("3.1. Подготовительный план", {
        x: col1X + 20,
        y: currentY - 15,
        size: 12,
        font: font,
    });
    
    page.drawText("3.2. Проектирование взаимодействий в виртуальной среде", {
        x: col1X + 20,
        y: currentY - 30,
        size: 12,
        font: font,
    });
    
    page.drawText("3.3. Реализация механики сборки дрона", {
        x: col1X + 20,
        y: currentY - 45,
        size: 12,
        font: font,
    });
    
    page.drawText("3.4. Внедрение обучающих сценариев", {
        x: col1X + 20,
        y: currentY - 60,
        size: 12,
        font: font,
    });
    
    page.drawText("3.5. Интеграция Zenject и управление зависимостими", {
        x: col1X + 20,
        y: currentY - 75,
        size: 12,
        font: font,
    });
    
    page.drawText("3.6. Тестирование, отладка и оптимизация", {
        x: col1X + 20,
        y: currentY - 90,
        size: 12,
        font: font,
    });
    
    page.drawText("3.7. Пользовательский опыт", {
        x: col1X + 20,
        y: currentY - 105,
        size: 12,
        font: font,
    });

    // Percentage and date for Chapter 3
    page.drawText("5%", {
        x: col2X,
        y: currentY - 60,
        size: 12,
        font: font,
    });
    
    page.drawText("19.05.2025", {
        x: col3X,
        y: currentY - 60,
        size: 12,
        font: font,
    });

    currentY -= 125;

    // Final sections (no percentage/date)
    page.drawText("Заключение", {
        x: col1X,
        y: currentY,
        size: 12,
        font: font,
    });
    
    page.drawText("Список использованных источников", {
        x: col1X,
        y: currentY - 15,
        size: 12,
        font: font,
    });
    
    page.drawText("Приложения", {
        x: col1X,
        y: currentY - 30,
        size: 12,
        font: font,
    });

    currentY -= 50;

  
    // Additional sections
    checkNewPage(150);
    page.drawText("3. Консультанты по BKP (с указанием относящихся к ним разделов проекта):", {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
    });
    currentY -= 30;

    // Consultant table - HORIZONTAL LAYOUT
    const signatureLineLength = 120;
    const nameLeft = leftMargin + 150 + 220;

    // Get consultant data
    const consultants = await userModel.getConsultants();
    const consultant = consultants.find(c => c.id === student.consultant);

    if (consultant) {
        const consultantName = consultant.fullName;

        // First consultant - signature line and name in same row
        page.drawLine({
            start: { x: leftMargin + 220, y: currentY - 2 },
            end: { x: leftMargin + 220 + signatureLineLength, y: currentY - 2 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });

        page.drawText("(подпись)", {
            x: leftMargin + 220,
            y: currentY - 15,
            size: 9,
            font: font,
        });

        page.drawText(consultantName, {
            x: nameLeft,
            y: currentY,
            size: 12,
            font: font,
        });
        page.drawLine({
            start: { x: leftMargin + 220 + 150, y: currentY - 2 },
            end: { x: leftMargin + 220 + 150 + signatureLineLength, y: currentY - 2 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });

        page.drawText("(ФИО)", {
            x: nameLeft,
            y: currentY - 15,
            size: 9,
            font: font,
        });

        currentY -= 40;

        // Second consultant line (empty for now)
        page.drawLine({
            start: { x: leftMargin + 220, y: currentY - 2 },
            end: { x: leftMargin + signatureLineLength + 220, y: currentY - 2 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });

        page.drawText("(подпись)", {
            x: leftMargin + 220,
            y: currentY - 15,
            size: 10,
            font: font,
        });

        page.drawLine({
            start: { x: leftMargin + 220 + 150, y: currentY - 2 },
            end: { x: leftMargin + 220 + 150 + signatureLineLength, y: currentY - 2 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });

        page.drawText("(ФИО)", {
            x: nameLeft,
            y: currentY - 15,
            size: 10,
            font: font,
        });
    } else {
        // No consultant - show empty signature lines
        for (let i = 0; i < 2; i++) {
            page.drawLine({
                start: { x: leftMargin, y: currentY },
                end: { x: leftMargin + signatureLineLength, y: currentY },
                thickness: 1,
                color: rgb(0, 0, 0),
            });

            page.drawText("(подпись)", {
                x: leftMargin,
                y: currentY - 15,
                size: 10,
                font: font,
            });

            page.drawText("_________________________", {
                x: nameLeft,
                y: currentY,
                size: 12,
                font: font,
            });

            page.drawText("(ФИО)", {
                x: nameLeft,
                y: currentY - 15,
                size: 10,
                font: font,
            });

            currentY -= 40;
        }
    }

    currentY -= 50;

    // Deadline section
    checkNewPage(100);
    // Deadline - underline to right margin
    const deadlineText = "4. Срок сдачи студентом законченной BKP:";
    const deadlineTextWidth = font.widthOfTextAtSize(deadlineText, 12);

    page.drawText(deadlineText, {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
    });

    // Underline to right margin
    page.drawLine({
        start: { x: leftMargin + deadlineTextWidth, y: currentY - 2 },
        end: { x: leftMargin + 500, y: currentY - 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });

    currentY -= 20;

    // Date of issue - underline to right margin
    const dateIssueText = "Дата выдачи задания: ";
    const dateIssueTextWidth = font.widthOfTextAtSize(dateIssueText, 12);

    page.drawText(dateIssueText, {
        x: leftMargin + 10,
        y: currentY,
        size: 12,
        font: font,
    });

    // Underline to right margin
    page.drawLine({
        start: { x: leftMargin + dateIssueTextWidth + 10, y: currentY - 2 },
        end: { x: leftMargin + 500, y: currentY - 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });

    currentY -= 20;

    // Supervisor signature - HORIZONTAL LAYOUT
    checkNewPage(120);

    // Get supervisor data
    const supervisors = await userModel.getSupervisors();
    const supervisor = supervisors.find(s => s.id === student.supervisor);
    if (!supervisor) {
        throw new Error(`Supervisor not found for student: ${student.fullName}`);
    }

    const supervisorName = supervisor.fullName;

    // Supervisor signature line and name in same row - underline to right margin
    const supervisorSignatureLabel = "Руководитель";
    const supervisorSignatureWidth = font.widthOfTextAtSize(supervisorSignatureLabel, 12);

    page.drawText(supervisorSignatureLabel, {
        x: leftMargin + 10,
        y: currentY,
        size: 12,
        font: font,
    });

    // Signature line to right margin
    page.drawLine({
        start: { x: leftMargin + supervisorSignatureWidth + 10, y: currentY - 2 },
        end: { x: leftMargin + 500, y: currentY - 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });

    page.drawText("(подпись)", {
        x: leftMargin + 180,
        y: currentY - 15,
        size: 9,
        font: font,
    });

    // Supervisor name
    page.drawText(supervisorName, {
        x: leftMargin + supervisorSignatureWidth + 240,
        y: currentY,
        size: 12,
        font: font,
    });

    page.drawText("(ФИО)", {
        x: leftMargin + supervisorSignatureWidth + 240,
        y: currentY - 15,
        size: 9,
        font: font,
    });

    currentY -= 30;

    // Workload type - UNDERLINE ONLY "штатная"
    const workloadUnderlinePart = "штатная";
    const workloadNormalPart = " нагрузка";
    const workloadLabel = "(штатная или почасовая)";

    const workloadUnderlineWidth = font.widthOfTextAtSize(workloadUnderlinePart, 12);
    const workloadNormalWidth = font.widthOfTextAtSize(workloadNormalPart, 12);

    // Draw "штатная" with underline
    page.drawText(workloadUnderlinePart, {
        x: leftMargin+200,
        y: currentY,
        size: 12,
        font: font,
    });

    // Underline only "штатная"
    page.drawLine({
        start: { x: leftMargin +10, y: currentY - 2 },
        end: { x: leftMargin + workloadUnderlineWidth+ 400, y: currentY - 2 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });

    // Draw " нагрузка" without underline
    page.drawText(workloadNormalPart, {
        x: leftMargin + workloadUnderlineWidth + 400,
        y: currentY,
        size: 12,
        font: font,
    });

    // Draw the label below
    page.drawText(workloadLabel, {
        x: leftMargin +200,
        y: currentY - 15,
        size: 9,
        font: font,
    });

    currentY -= 40;

    // Student acceptance - HORIZONTAL LAYOUT
    checkNewPage(60);
    const acceptanceText = "Задание принял к исполнению";
    const acceptanceTextWidth = font.widthOfTextAtSize(acceptanceText, 12);

    page.drawText(acceptanceText, {
        x: leftMargin + 10,
        y: currentY,
        size: 12,
        font: font,
    });

    // Signature line to right margin
    page.drawLine({
        start: { x: leftMargin + acceptanceTextWidth + 10, y: currentY },
        end: { x: leftMargin + 500, y: currentY },
        thickness: 1,
        color: rgb(0, 0, 0),
    });

    page.drawText("(подпись студента)", {
        x: leftMargin + 250,
        y: currentY - 15,
        size: 9,
        font: font,
    });


    currentY -= 40;

    // Note at the bottom
    checkNewPage(30);
    page.drawText("Примечание: Настоящее задание прилагается к законченной BKP", {
        x: leftMargin,
        y: currentY,
        size: 12,
        font: font,
    });

    return page;
}