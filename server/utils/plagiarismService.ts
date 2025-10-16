require("dotenv").config();
import * as soap from 'soap';
import path from "path";
import fs from "fs";
import { ThesisModel } from '../models/Thesis.model';
import UserModel from '../models/User.model';
import { Pool } from 'pg';
import axios from 'axios';

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
    detailedScores?: {
        legal?: number;
        plagiarism?: number;
        selfCite?: number;
    };
    downloadedPdfUrl?: string;
}

export interface Author {
    Surname: string;
    OtherNames: string;
    PersonIDs: {
        CustomID: string;
    };
}

export interface DocAttributes {
    DocumentDescription?: {
        Authors?: {
            AuthorName: Author[];
        };
    };
    ExternalUserID?: string;
    Custom?: Array<{
        AttrName: string;
        AttrValue: string;
    }>;
}

export interface DownloadResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
    fileSize?: number;
}

export class PlagiarismService {
    private wsdlUrl: string;
    private login: string;
    private password: string;
    private companyName: string;
    private baseUrl: string;
    private client: any;

    constructor() {
        this.wsdlUrl = process.env.ANTIPLAGIAT_WSDL_URL || 'https://api.antiplagiat.ru:44902/apiCorp/testapi?singleWsdl';
        this.login = process.env.ANTIPLAGIAT_LOGIN || 'testapi@antiplagiat.ru';
        this.password = process.env.ANTIPLAGIAT_PASSWORD || 'testapi';
        this.companyName = process.env.ANTIPLAGIAT_COMPANY_NAME || 'testapi';
        this.baseUrl = process.env.ANTIPLAGIAT_BASE_URL || 'https://testapi.antiplagiat.ru';
    }
    
    
    private async getClient(): Promise<any> {
        if (!this.client) {
            this.client = await soap.createClientAsync(this.wsdlUrl, {
                disableCache: true,
                endpoint: `https://api.antiplagiat.ru:4959/apiCorp/${this.companyName}`,
                envelopeKey: 'soap'
            });

            this.client.on('request', (xml: string) => {
                console.log('=== SOAP REQUEST ===');
                console.log(xml);
                console.log('=== END SOAP REQUEST ===');
            });

            this.client.on('response', (xml: string) => {
                console.log('=== SOAP RESPONSE ===');
                console.log(xml);
                console.log('=== END SOAP RESPONSE ===');
            });

            const basicAuth = new soap.BasicAuthSecurity(this.login, this.password);
            this.client.setSecurity(basicAuth);
        }
        return this.client;
    }

    private getDocData(filePath: string, fileName: string, externalUserId: string): any {
        const fileBuffer = fs.readFileSync(filePath);
        const data = fileBuffer.toString('base64');
        const fileType = path.extname(fileName);

        return {
            Data: data,
            FileName: path.basename(fileName, fileType),
            FileType: fileType,
            ExternalUserID: externalUserId 
        };
    }

    private createDocAttributes(studentData: any): DocAttributes {
        const personIds = {
            CustomID: "original"
        };

        const author: Author = {
            Surname: this.extractLastName(studentData.fullName) || "",
            OtherNames: this.extractFirstName(studentData.fullName) || "",
            PersonIDs: personIds
        };

        return {
            DocumentDescription: {
                Authors: {
                    AuthorName: [author]
                }
            }
        };
    }

    /**
     * Download PDF report from Antiplagiat
     */
    async downloadPdfReport(documentId: string, thesisId: string, studentName: string): Promise<DownloadResult> {
        try {
            const client = await this.getClient();

            console.log(`Exporting PDF report for document: ${documentId}`);

            // Request PDF export
            const exportResult = await client.ExportReportToPdfAsync({
                docId: {
                    Id: documentId
                }
            });

            let exportInfo = exportResult[0].ExportReportToPdfResult;

            // Wait for PDF export to complete
            console.log(`PDF export status: ${exportInfo.Status}, waiting for completion...`);

            const maxAttempts = 60; // 10 minutes max with 10 second intervals
            let attempts = 0;

            while (exportInfo.Status === 'InProgress' && attempts < maxAttempts) {
                attempts++;

                // Wait before checking status again
                const waitTime = exportInfo.EstimatedWaitTime ? exportInfo.EstimatedWaitTime * 1000 : 10000;
                await new Promise(resolve => setTimeout(resolve, waitTime));

                // Check export status again
                const statusResult = await client.ExportReportToPdfAsync({
                    docId: {
                        Id: documentId
                    }
                });

                exportInfo = statusResult[0].ExportReportToPdfResult;
                console.log(`PDF export status: ${exportInfo.Status}, attempt: ${attempts}/${maxAttempts}`);
            }

            if (exportInfo.Status !== 'Ready') {
                throw new Error(`PDF export failed: ${exportInfo.FailDetails || 'Export timed out or failed'}`);
            }

            if (!exportInfo.DownloadLink) {
                throw new Error('PDF export completed but no download link provided');
            }

            const pdfUrl = `${this.baseUrl}${exportInfo.DownloadLink}`;
            console.log(`Downloading PDF report from: ${pdfUrl}`);

            // Download the PDF file
            const response = await axios.get(pdfUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 30000
            });

            // Create PDF downloads directory
            const pdfDir = path.join(__dirname, '../../server/uploads/plagiarism-reports');
            if (!fs.existsSync(pdfDir)) {
                fs.mkdirSync(pdfDir, { recursive: true });
            }

            // Generate filename
            const fileName = `plagiarism_report_${thesisId}.pdf`;
            const filePath = path.join(pdfDir, fileName);

            // Save the PDF file
            fs.writeFileSync(filePath, response.data);

            const fileSize = fs.statSync(filePath).size;

            console.log(`PDF report downloaded successfully: ${filePath} (${fileSize} bytes)`);

            // Update thesis with PDF download path
            await this.updateThesisWithPdfUrl(thesisId, `/uploads/plagiarism-reports/${fileName}`);

            return {
                success: true,
                filePath,
                fileName,
                fileSize
            };

        } catch (error: any) {
            console.error('Error downloading PDF report:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async checkDocument(filePath: string, fileName: string, thesisId: string, studentData: any): Promise<PlagiarismCheckResult> {
        let documentId: string | null = null;

        try {
            // Basic file validation
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const client = await this.getClient();
            const docData = this.getDocData(filePath, fileName, studentData.id);
            const docAttributes = this.createDocAttributes(studentData);

            console.log(`Uploading document to Antiplagiat...`);

            // Upload document
            const uploadResult = await client.UploadDocumentAsync({
                data: docData,
                attributes: docAttributes
            });

            console.log(`Upload response:`, JSON.stringify(uploadResult, null, 2));

            // Extract document ID from response (following Python pattern)
            documentId = uploadResult[0].UploadDocumentResult?.Uploaded?.[0]?.Id?.Id;

            if (!documentId) {
                // Alternative response format
                documentId = uploadResult[0]?.UploadDocumentResult?.Id;
            }

            if (!documentId) {
                console.log('Full upload response:', JSON.stringify(uploadResult, null, 2));
                throw new Error('Failed to upload document - no document ID returned');
            }

            console.log(`Document uploaded successfully. Document ID: ${documentId}`);

            // Start plagiarism check - using all available services (as in Python)
            console.log(`Starting plagiarism check...`);
            await client.CheckDocumentAsync({
                docId: {
                    Id: documentId
                }

            });

            // Wait for completion with better status checking
            console.log(`Waiting for completion...`);
            const status = await this.waitForCompletion(client, documentId);

            if (status === 'Failed') {
                throw new Error(`Check failed for document ${documentId}`);
            }

            // Get detailed report view 
            console.log(`Getting detailed report...`);
            const reportView = await client.GetReportViewAsync({
                docId: {
                    Id: documentId
                }
            });

            const report = reportView[0].GetReportViewResult;
            const similarityScore = report.Summary?.Score || 0;

            console.log(`Plagiarism check completed. Similarity: ${similarityScore}%`);

            // Extract detailed scores from different services
            const detailedScores = this.extractDetailedScores(report);

            // Get web report URLs
            const webReportUrls = await this.getWebReportUrls(client, documentId);

            // Save checked file
            const checkedFilePath = await this.saveCheckedFile(filePath, fileName);

            // Download PDF report automatically
            let downloadedPdfUrl: string | undefined;

            try {
                const downloadResult = await this.downloadPdfReport(documentId, thesisId, studentData.fullName);

                if (downloadResult.success) {
                    downloadedPdfUrl = `/uploads/plagiarism-reports/plagiarism_report_${thesisId}.pdf`;
                }

                console.log(`PDF report downloaded: ${downloadResult.success}`);
            } catch (downloadError) {
                console.error('Automatic PDF download failed, but plagiarism check completed:', downloadError);
            }

            // Update thesis
            await this.updateThesis(thesisId, {
                documentId,
                similarityScore,
                detailedScores,
                reportUrl: webReportUrls.fullReport,
                shortReportUrl: webReportUrls.shortReport,
                readonlyReportUrl: webReportUrls.readonlyReport,
                checkedFileUrl: checkedFilePath,
                isApproved: similarityScore <= 15,
                downloadedPdfUrl
            });

            return {
                success: true,
                similarityScore,
                reportUrl: webReportUrls.fullReport,
                checkedFileUrl: checkedFilePath,
                documentId,
                detailedScores,
                downloadedPdfUrl
            };

        } catch (error: any) {
            console.error('=== Plagiarism check FAILED ===');
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);

            if (error.response) {
                console.error('SOAP Response:', error.response);
            }
            if (error.body) {
                console.error('SOAP Body:', error.body);
            }
            if (error.root) {
                console.error('SOAP Envelope:', error.root.Envelope);
            }

            // Clean up on failure
            if (documentId) {
                await this.cleanupDocument(documentId);
            }

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

    private async waitForCompletion(client: any, documentId: string): Promise<string> {
        const maxAttempts = 60; // 10 minutes max with 10 second intervals
        let attempts = 0;

        while (attempts < maxAttempts) {
            attempts++;

            const statusResult = await client.GetCheckStatusAsync({
                docId: {
                    Id: documentId
                }
            });
            const status = statusResult[0].GetCheckStatusResult;

            console.log(`Check status: ${status.Status}, Attempt: ${attempts}/${maxAttempts}`);

            if (status.Status === 'Ready') return 'Ready';
            if (status.Status === 'Failed') {
                console.error(`Check failed: ${status.FailDetails}`);
                return 'Failed';
            }
            if (status.Status === 'NotChecked') return 'NotChecked';

            // Use estimated wait time from API or default to 10 seconds
            const waitTime = status.EstimatedWaitTime ? status.EstimatedWaitTime * 1000 * 0.1 : 10000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        throw new Error('Check timeout - maximum attempts exceeded');
    }

    private extractDetailedScores(report: any): { legal?: number; plagiarism?: number; selfCite?: number } {
        const scores: { legal?: number; plagiarism?: number; selfCite?: number } = {};

        if (report.CheckServiceResults && report.CheckServiceResults.CheckServiceResult) {
            const services = Array.isArray(report.CheckServiceResults.CheckServiceResult)
                ? report.CheckServiceResults.CheckServiceResult
                : [report.CheckServiceResults.CheckServiceResult];

            for (const service of services) {
                console.log(`Service: ${service.CheckServiceName}, Legal: ${service.ScoreByReport?.Legal}, Plagiarism: ${service.ScoreByReport?.Plagiarism}`);

                if (service.ScoreByReport) {
                    scores.legal = (scores.legal || 0) + (service.ScoreByReport.Legal || 0);
                    scores.plagiarism = (scores.plagiarism || 0) + (service.ScoreByReport.Plagiarism || 0);
                }
            }
        }

        // Extract self-citation score if available
        if (report.Summary?.DetailedScore?.SelfCite !== undefined) {
            scores.selfCite = report.Summary.DetailedScore.SelfCite;
        }

        return scores;
    }

    private async getWebReportUrls(client: any, documentId: string): Promise<{
        fullReport: string;
        shortReport: string;
        readonlyReport: string;
    }> {
        try {
            const statusResult = await client.GetCheckStatusAsync({
                docId: {
                    Id: documentId
                }
            });
            const status = statusResult[0].GetCheckStatusResult;

            return {
                fullReport: status.Summary?.ReportWebId ? `${this.baseUrl}${status.Summary.ReportWebId}` : '',
                shortReport: status.Summary?.ShortReportWebId ? `${this.baseUrl}${status.Summary.ShortReportWebId}` : '',
                readonlyReport: status.Summary?.ReadonlyReportWebId ? `${this.baseUrl}${status.Summary.ReadonlyReportWebId}` : ''
            };
        } catch (error) {
            console.error('Error getting web report URLs:', error);
            return { fullReport: '', shortReport: '', readonlyReport: '' };
        }
    }

    private extractFirstName(fullName: string): string {
        return fullName?.split(' ')[0] || "";
    }

    private extractLastName(fullName: string): string {
        const parts = fullName?.split(' ') || [];
        return parts.length > 1 ? parts[parts.length - 1] : "";
    }

    private async cleanupDocument(documentId: string): Promise<void> {
        try {
            const client = await this.getClient();
            await client.DeleteDocumentAsync({
                docId: {
                    Id: documentId
                }
            });
            console.log(`Cleaned up document: ${documentId}`);
        } catch (error) {
            console.error(`Error cleaning up document ${documentId}:`, error);
        }
    }

    private async updateThesis(
        thesisId: string,
        results: {
            documentId: string;
            similarityScore: number;
            detailedScores?: any;
            reportUrl: string;
            shortReportUrl: string;
            readonlyReportUrl: string;
            checkedFileUrl: string;
            isApproved: boolean;
            downloadedPdfUrl?: string;
        }
    ): Promise<void> {
        try {
            const thesis = await thesisModel.getThesisById(thesisId);
            if (!thesis) return;

            await thesisModel.updateThesis(thesisId, {
                plagiarismCheck: {
                    ...thesis.data.plagiarismCheck,
                    isChecked: true,
                    checkedFileUrl: results.checkedFileUrl,
                    attempts: (thesis.data.plagiarismCheck?.attempts || 0) + 1,
                    lastCheckDate: new Date(),
                    similarityScore: results.similarityScore,
                    detailedScores: results.detailedScores,
                    reportUrl: results.reportUrl,
                    shortReportUrl: results.shortReportUrl,
                    readonlyReportUrl: results.readonlyReportUrl,
                    isApproved: results.isApproved,
                    documentId: results.documentId,
                    status: 'completed',
                    downloadedPdfUrl: results.downloadedPdfUrl
                } as any
            });
        } catch (error) {
            console.error('Error updating thesis:', error);
        }
    }

    private async updateThesisWithPdfUrl(
        thesisId: string,
        downloadedPdfUrl: string
    ): Promise<void> {
        try {
            const thesis = await thesisModel.getThesisById(thesisId);
            if (!thesis) return;

            await thesisModel.updateThesis(thesisId, {
                plagiarismCheck: {
                    ...thesis.data.plagiarismCheck,
                    downloadedPdfUrl
                } as any
            });
        } catch (error) {
            console.error('Error updating thesis PDF URL:', error);
        }
    }

    private async saveCheckedFile(originalFilePath: string, originalFileName: string): Promise<string> {
        const timestamp = Date.now();
        const fileExt = path.extname(originalFileName);
        const baseName = path.basename(originalFileName, fileExt);
        const newFileName = `${baseName}_checked${fileExt}`;

        const checkedDir = path.join(__dirname, '../../server/uploads/checked-theses');
        if (!fs.existsSync(checkedDir)) {
            fs.mkdirSync(checkedDir, { recursive: true });
        }

        const newFilePath = path.join(checkedDir, newFileName);
        await fs.promises.copyFile(originalFilePath, newFilePath);

        return newFilePath;
    }

    async enumerateReports(externalUserId: string): Promise<any[]> {
        try {
            const client = await this.getClient();
            const options = {
                ExternalUserID: externalUserId,
                Count: 10,
                Skip: 0
            };

            const result = await client.EnumerateReportInfosAsync({ options });
            return result[0].EnumerateReportInfosResult || [];
        } catch (error) {
            console.error('Error enumerating reports:', error);
            return [];
        }
    }

    async getTariffInfo(): Promise<any> {
        try {
            const client = await this.getClient();
            const result = await client.GetTariffInfoAsync({});
            return result[0].GetTariffInfoResult;
        } catch (error) {
            console.error('Error getting tariff info:', error);
            return null;
        }
    }

    async exportReportToPdf(documentId: string): Promise<string> {
        try {
            const client = await this.getClient();
            const result = await client.ExportReportToPdfAsync({
                docId: {
                    Id: documentId
                }
            });
            const exportInfo = result[0].ExportReportToPdfResult;

            if (exportInfo.Status === 'Ready') {
                return `${this.baseUrl}${exportInfo.DownloadLink}`;
            } else {
                throw new Error(`PDF export failed: ${exportInfo.FailDetails}`);
            }
        } catch (error) {
            console.error('Error exporting report to PDF:', error);
            throw error;
        }
    }

    /**
     * Get downloaded PDF report URL for a thesis
     */
    async getDownloadedPdfUrl(thesisId: string): Promise<string | null> {
        try {
            const thesis = await thesisModel.getThesisById(thesisId);
            if (!thesis || !thesis.data.plagiarismCheck) {
                return null;
            }

            return thesis.data.plagiarismCheck.downloadedPdfUrl || null;
        } catch (error) {
            console.error('Error getting downloaded PDF URL:', error);
            return null;
        }
    }

    /**
     * Delete downloaded PDF report for a thesis
     */
    async deleteDownloadedPdfReport(thesisId: string): Promise<boolean> {
        try {
            const pdfUrl = await this.getDownloadedPdfUrl(thesisId);
            if (!pdfUrl) return false;

            // Extract filename from URL
            const fileName = path.basename(pdfUrl);
            const filePath = path.join(__dirname, '../../server/uploads/plagiarism-reports', fileName);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            // Update thesis to remove download URL
            const thesis = await thesisModel.getThesisById(thesisId);
            if (thesis) {
                await thesisModel.updateThesis(thesisId, {
                    plagiarismCheck: {
                        ...thesis.data.plagiarismCheck,
                        downloadedPdfUrl: null
                    } as any
                });
            }

            console.log(`Deleted PDF report for thesis ${thesisId}`);
            return true;
        } catch (error) {
            console.error('Error deleting downloaded PDF report:', error);
            return false;
        }
    }
}

export const plagiarismService = new PlagiarismService();