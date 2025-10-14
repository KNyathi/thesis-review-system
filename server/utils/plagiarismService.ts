require("dotenv").config();
import * as soap from 'soap';
import path from "path";
import fs from "fs";
import { ThesisModel } from '../models/Thesis.model';
import UserModel from '../models/User.model';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DB_URL
});

const thesisModel = new ThesisModel(pool);
const userModel = new UserModel(pool);

export interface PlagiarismCheckResult {
    success: boolean;
    similarityScore: number;
    reportUrl: string;
    checkedFileUrl: string;
    documentId?: string;
    status?: string;
    error?: string;
}

export class PlagiarismService {
    private wsdlUrl: string;
    private login: string;
    private password: string;
    private baseUrl: string;

    constructor() {
        this.wsdlUrl = process.env.ANTIPLAGIAT_WSDL_URL || 'https://api.antiplagiat.ru:4959/apiCorp/testapi?wsdl';
        this.login = process.env.ANTIPLAGIAT_LOGIN || 'testapi@antiplagiat.ru';
        this.password = process.env.ANTIPLAGIAT_PASSWORD || 'testapi';
        this.baseUrl = process.env.ANTIPLAGIAT_BASE_URL || 'https://testapi.antiplagiat.ru';
    }

    async checkDocument(filePath: string, fileName: string, thesisId: string, studentData: any): Promise<PlagiarismCheckResult> {
        try {
            // Basic file validation
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const fileBuffer = fs.readFileSync(filePath);
            if (fileBuffer.length < 10) {
                throw new Error('File is too small (minimum 10 bytes required)');
            }

            // Create SOAP client
            const client = await soap.createClientAsync(this.wsdlUrl, {
                disableCache: true
            });

            // Set authentication
            const basicAuth = new soap.BasicAuthSecurity(this.login, this.password);
            client.setSecurity(basicAuth);

            // Upload document
            const uploadResult = await client.UploadDocumentAsync({
                data: fileBuffer.toString('base64'),
                fileName: fileName,
                docAttributes: {
                    DocumentDescription: {
                        Work: fileName,
                        Authors: {
                            Author: [
                                {
                                    FirstName: this.extractFirstName(studentData.fullName) || "Student",
                                    LastName: this.extractLastName(studentData.fullName) || "Use",
                                    CustomID: `uni_${studentData.id || 'unknown'}`
                                }
                            ]
                        }
                    },
                    ExternalUserID: `uni_${studentData.id || 'unknown'}`,
                    FileType: this.getFileType(fileName)
                }
            });

            const documentId = uploadResult[0].UploadDocumentResult;

            if (!documentId) {
                throw new Error('Failed to upload document - no document ID returned');
            }

            // Start plagiarism check
            await client.CheckDocumentAsync({
                id: documentId,
                checkDocParams: {
                    Sources: {
                        Source: [
                            { Id: 'testapi' },
                            { Id: 'wikipedia' }
                        ]
                    }
                }
            });

            // Wait for completion
            await this.waitForCompletion(client, documentId);

            // Get results
            const reportSummary = await client.GetReportSummaryAsync({ id: documentId });
            const summary = reportSummary[0].GetReportSummaryResult;
            const similarityScore = summary.DetailedScore?.Unknown || summary.Score || 0;

            // Save checked file
            const checkedFilePath = await this.saveCheckedFile(filePath, fileName);

            // Update thesis
            await this.updateThesis(thesisId, {
                documentId,
                similarityScore,
                reportUrl: this.generateReportUrl(documentId),
                checkedFileUrl: checkedFilePath,
                isApproved: similarityScore <= 15
            });

            return {
                success: true,
                similarityScore,
                reportUrl: this.generateReportUrl(documentId),
                checkedFileUrl: checkedFilePath,
                documentId,
            };

        } catch (error: any) {
            console.error('Plagiarism check failed:', error.message);
            
            // Simple error result
            return {
                success: false,
                similarityScore: 0,
                reportUrl: '',
                checkedFileUrl: '',
                error: error.message,
                status: 'failed'
            };
        }
    }

    private async waitForCompletion(client: any, documentId: string): Promise<void> {
        for (let attempt = 0; attempt < 30; attempt++) {
            const statusResult = await client.GetCheckStatusAsync({ id: documentId });
            const status = statusResult[0].GetCheckStatusResult;

            if (status.State === 'Done') return;
            if (status.State === 'Failed') throw new Error(`Check failed: ${status.FailDetails}`);
            
            await new Promise(resolve => setTimeout(resolve, 10000));
        }

        throw new Error('Check timeout');
    }

    private extractFirstName(fullName: string): string {
        return fullName?.split(' ')[0] || "Student";
    }

    private extractLastName(fullName: string): string {
        const parts = fullName?.split(' ') || [];
        return parts.length > 1 ? parts[parts.length - 1] : "User";
    }

    private getFileType(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const types: { [key: string]: string } = {
            '.pdf': 'Pdf',
            '.doc': 'Doc',
            '.docx': 'Docx',
            '.txt': 'Txt',
            '.rtf': 'Rtf'
        };
        return types[ext] || 'Pdf';
    }

    private generateReportUrl(documentId: string): string {
        return `${this.baseUrl}/Reports/Short/${documentId}`;
    }

    private async updateThesis(
        thesisId: string,
        results: {
            documentId: string;
            similarityScore: number;
            reportUrl: string;
            checkedFileUrl: string;
            isApproved: boolean;
        }
    ): Promise<void> {
        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) return;

        await thesisModel.updateThesis(thesisId, {
            plagiarismCheck: {
                ...thesis.data.plagiarismCheck,
                isChecked: true,
                checkedFileUrl: results.checkedFileUrl,
                attempts: thesis.data.plagiarismCheck.attempts + 1,
                lastCheckDate: new Date(),
                similarityScore: results.similarityScore,
                reportUrl: results.reportUrl,
                isApproved: results.isApproved,
                documentId: results.documentId
            }
        });
    }

    private async saveCheckedFile(originalFilePath: string, originalFileName: string): Promise<string> {
        const timestamp = Date.now();
        const fileExt = path.extname(originalFileName);
        const baseName = path.basename(originalFileName, fileExt);
        const newFileName = `${baseName}_checked_${timestamp}${fileExt}`;

        const checkedDir = path.join(__dirname, '../../server/uploads/checked-theses');
        if (!fs.existsSync(checkedDir)) {
            fs.mkdirSync(checkedDir, { recursive: true });
        }

        const newFilePath = path.join(checkedDir, newFileName);
        await fs.promises.copyFile(originalFilePath, newFilePath);

        return newFilePath;
    }
}

export const plagiarismService = new PlagiarismService();