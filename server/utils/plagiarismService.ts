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
    detailedScores?: {
        legal?: number;
        plagiarism?: number;
        selfCite?: number;
    };
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

    private getDocData(filePath: string, fileName: string): any {
        const fileBuffer = fs.readFileSync(filePath);
        const data = fileBuffer.toString('base64');
        const fileType = path.extname(fileName);

        return {
            Data: data,
            FileName: path.basename(fileName, fileType),
            FileType: fileType,
            ExternalUserID: "nyathi"
        };
    }

    private createDocAttributes(studentData: any): DocAttributes {
        const personIds = {
            CustomID: "original"
        };

        const author: Author = {
            Surname: this.extractLastName(studentData.fullName) || "Иванов",
            OtherNames: this.extractFirstName(studentData.fullName) || "Иван Иванович",
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

    async checkDocument(filePath: string, fileName: string, thesisId: string, studentData: any): Promise<PlagiarismCheckResult> {
        let documentId: string | null = null;

        try {
            // Basic file validation
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const client = await this.getClient();
            const docData = this.getDocData(filePath, fileName);
            const docAttributes = this.createDocAttributes(studentData);

            console.log(`Uploading document to Antiplagiat...`);

            // Upload document
            const uploadResult = await client.UploadDocumentAsync({
                data: docData,
                docAttributes: docAttributes
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
                docId: documentId
                // To use specific services like in Python commented example:
                // checkServices: {
                //     string: ["wikipedia", this.companyName]
                // }
            });

            // Wait for completion with better status checking
            console.log(`Waiting for completion...`);
            const status = await this.waitForCompletion(client, documentId);

            if (status === 'Failed') {
                throw new Error(`Check failed for document ${documentId}`);
            }

            // Get detailed report view (like in Python)
            console.log(`Getting detailed report...`);
            const reportView = await client.GetReportViewAsync({
                id: documentId
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

            // Update thesis
            await this.updateThesis(thesisId, {
                documentId,
                similarityScore,
                detailedScores,
                reportUrl: webReportUrls.fullReport,
                shortReportUrl: webReportUrls.shortReport,
                readonlyReportUrl: webReportUrls.readonlyReport,
                checkedFileUrl: checkedFilePath,
                isApproved: similarityScore <= 15
            });

            return {
                success: true,
                similarityScore,
                reportUrl: webReportUrls.fullReport,
                checkedFileUrl: checkedFilePath,
                documentId,
                detailedScores
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

            const statusResult = await client.GetCheckStatusAsync({ id: documentId });
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
            const statusResult = await client.GetCheckStatusAsync({ id: documentId });
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
        return fullName?.split(' ')[0] || "Иван Иванович";
    }

    private extractLastName(fullName: string): string {
        const parts = fullName?.split(' ') || [];
        return parts.length > 1 ? parts[parts.length - 1] : "Иванов";
    }

    private async cleanupDocument(documentId: string): Promise<void> {
        try {
            const client = await this.getClient();
            await client.DeleteDocumentAsync({ id: documentId });
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
                    status: 'completed'
                } as any
            });
        } catch (error) {
            console.error('Error updating thesis:', error);
        }
    }

    private async saveCheckedFile(originalFilePath: string, originalFileName: string): Promise<string> {
        const timestamp = Date.now();
        const fileExt = path.extname(originalFileName);
        const baseName = path.basename(originalFileName, fileExt);
        const newFileName = `${baseName}_checked_${fileExt}`;

        const checkedDir = path.join(__dirname, '../../server/uploads/checked-theses');
        if (!fs.existsSync(checkedDir)) {
            fs.mkdirSync(checkedDir, { recursive: true });
        }

        const newFilePath = path.join(checkedDir, newFileName);
        await fs.promises.copyFile(originalFilePath, newFilePath);

        return newFilePath;
    }


    async enumerateReports(externalUserId: string = "nyathi"): Promise<any[]> {
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
            const result = await client.ExportReportToPdfAsync({ id: documentId });
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
}

export const plagiarismService = new PlagiarismService();


{/**
    
    
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
            console.log(`Buffer length: ${fileBuffer.length} bytes`);

            if (fileBuffer.length < 10) {
                throw new Error(`File is too small: ${fileBuffer.length} bytes (minimum 10 bytes required)`);
            }

            // Create SOAP client
            const client = await soap.createClientAsync(this.wsdlUrl, {
                disableCache: true,
                forceSoap12Headers: false, // Use SOAP 1.2

            });

            // Set authentication
            const basicAuth = new soap.BasicAuthSecurity(this.login, this.password);
            client.setSecurity(basicAuth);

            const fileBase64 = fileBuffer.toString('base64');
            console.log(`Base64 length: ${fileBase64.length} characters`);
            console.log(`Base64 first 100 chars: ${fileBase64.substring(0, 100)}`);

            // Upload document
            console.log(`Uploading document to Antiplagiat...`);
            const uploadResult = await client.UploadDocumentAsync({
                data: {
                    '$value': fileBase64,
                    '$attributes': {
                        'xmlns:xs': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        'xsi:type': 'xs:base64Binary'
                    }
                },
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

            console.log(`Upload response:`, JSON.stringify(uploadResult, null, 2));

            const documentId = uploadResult[0].UploadDocumentResult;

            if (!documentId) {
                throw new Error('Failed to upload document - no document ID returned');
            }

            console.log(`Document uploaded successfully. Document ID: ${documentId}`);

            // Start plagiarism check
            console.log(`Starting plagiarism check...`);

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
            console.log(`Waiting for completion...`);
            await this.waitForCompletion(client, documentId);

            // Get results
            console.log(`Getting report summary...`);
            const reportSummary = await client.GetReportSummaryAsync({ id: documentId });
            const summary = reportSummary[0].GetReportSummaryResult;
            const similarityScore = summary.DetailedScore?.Unknown || summary.Score || 0;

            console.log(`Plagiarism check completed. Similarity: ${similarityScore}%`);

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
            console.error('=== Plagiarism check FAILED ===');
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);

            if (error.response) {
                console.error('SOAP Response:', error.response);
            }
            if (error.body) {
                console.error('SOAP Body:', error.body);
            }
            if (error.request) {
                console.error('SOAP Request:', error.request);
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
            '.rtf': 'Rtf',
            '.odt': 'Odt',
            '.html': 'Html',
            '.htm': 'Html'
        };

        const fileType = types[ext] || 'Pdf';
        console.log(`Detected file type: ${fileType} for extension: ${ext}`);
        return fileType;
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
        const newFileName = `${baseName}_checked_${fileExt}`;

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
    
    
    
    
    */}
