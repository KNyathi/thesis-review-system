require("dotenv").config();
import axios from 'axios';
import FormData from 'form-data';
import path from "path"
import fs from "fs"
import { Pool } from 'pg';
import { ThesisModel } from '../models/Thesis.model';
import UserModel from '../models/User.model';

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
    error?: string;
}

export class PlagiarismService {
    private apiKey: string;
    private baseUrl: string;

    constructor() {
        this.apiKey = process.env.ANTIPLAGIAT_API_KEY || '';
        this.baseUrl = process.env.ANTIPLAGIAT_URL || '';
    }

    async checkDocument(filePath: string, fileName: string): Promise<PlagiarismCheckResult> {
        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            // Create form data with proper Blob handling
            const formData = new FormData();

            // Create a readable stream instead of using Buffer directly
            const fileStream = fs.createReadStream(filePath);

            formData.append('file', fileStream, {
                filename: fileName,
                contentType: this.getContentType(fileName)
            });

            formData.append('apikey', this.apiKey);

            const response = await axios.post(`${this.baseUrl}/v1/check`, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
                timeout: 60000, // 60 seconds timeout for large files
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            });

            if (response.data.success) {
                // Save the checked file to a separate location
                const checkedFilePath = await this.saveCheckedFile(filePath, fileName);

                return {
                    success: true,
                    similarityScore: response.data.similarity || response.data.score || 0,
                    reportUrl: response.data.report_url || response.data.reportUrl || '',
                    checkedFileUrl: checkedFilePath,
                };
            } else {
                throw new Error(response.data.error || response.data.message || 'Plagiarism check failed');
            }
        } catch (error: any) {
            console.error('Plagiarism check error:', error);

            // Provide more specific error messages
            let errorMessage = 'Failed to check plagiarism';
            if (error.response) {
                errorMessage = `API Error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
            } else if (error.request) {
                errorMessage = 'No response from plagiarism service';
            } else if (error.message) {
                errorMessage = error.message;
            }

            return {
                success: false,
                similarityScore: 0,
                reportUrl: '',
                checkedFileUrl: '',
                error: errorMessage,
            };
        }
    }

    private getContentType(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const contentTypes: { [key: string]: string } = {
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.rtf': 'application/rtf',
        };

        return contentTypes[ext] || 'application/octet-stream';
    }

    private async saveCheckedFile(originalFilePath: string, originalFileName: string): Promise<string> {
        const timestamp = Date.now();
        const fileExt = path.extname(originalFileName);
        const baseName = path.basename(originalFileName, fileExt);
        const newFileName = `${baseName}_checked_${timestamp}${fileExt}`;

        const checkedDir = path.join(__dirname, '../../uploads/checked-theses');
        if (!fs.existsSync(checkedDir)) {
            fs.mkdirSync(checkedDir, { recursive: true });
        }

        const newFilePath = path.join(checkedDir, newFileName);

        // Copy the file to the checked directory
        await fs.promises.copyFile(originalFilePath, newFilePath);

        return newFilePath;
    }
}

export const plagiarismService = new PlagiarismService();