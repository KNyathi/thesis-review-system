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
                end: { x: leftMargin + lineWidth, y: currentY - 2 },
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

    currentY -= 30;

//WORK ON THIS TABLE
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