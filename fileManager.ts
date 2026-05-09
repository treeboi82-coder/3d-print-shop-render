import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createHash } from 'crypto';

// File manager class for handling file storage in sandbox directories
export class FileManager {
  private readonly baseUploadDir: string;
  private readonly maxFileSize: number = 100 * 1024 * 1024; // 100MB max file size
  private readonly allowedExtensions: string[] = ['.stl', '.obj', '.3mf', '.step', '.stp'];

  constructor(baseDir: string = 'uploads') {
    this.baseUploadDir = path.resolve(baseDir);
  }

  // Initialize the upload directory structure
  async initialize(): Promise<void> {
    try {
      await fs.access(this.baseUploadDir);
    } catch {
      await fs.mkdir(this.baseUploadDir, { recursive: true });
    }
  }

  // Create a sandbox directory for a specific order
  private getOrderDir(orderId: string): string {
    return path.join(this.baseUploadDir, orderId);
  }

  // Create sandbox directory for an order
  async createOrderDirectory(orderId: string): Promise<string> {
    const orderDir = this.getOrderDir(orderId);
    await fs.mkdir(orderDir, { recursive: true });
    return orderDir;
  }

  // Validate file before upload
  validateFile(filename: string, size: number): { valid: boolean; error?: string } {
    // Check file extension
    const ext = path.extname(filename).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      return { valid: false, error: `File type ${ext} not allowed. Allowed types: ${this.allowedExtensions.join(', ')}` };
    }

    // Check file size
    if (size > this.maxFileSize) {
      return { valid: false, error: `File size ${size} exceeds maximum allowed size of ${this.maxFileSize} bytes` };
    }

    return { valid: true };
  }

  // Save uploaded file to order's sandbox directory
  async saveFile(
    orderId: string, 
    filename: string, 
    fileData: Buffer | string,
    mimeType?: string
  ): Promise<{
    success: boolean;
    filePath?: string;
    checksum?: string;
    error?: string;
  }> {
    try {
      // Create order directory
      const orderDir = await this.createOrderDirectory(orderId);
      
      // Validate file
      const buffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData, 'base64');
      const validation = this.validateFile(filename, buffer.length);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Generate unique filename to prevent conflicts
      const uniqueFilename = this.generateUniqueFilename(filename);
      const filePath = path.join(orderDir, uniqueFilename);

      // Calculate checksum
      const checksum = createHash('sha256').update(buffer).digest('hex');

      // Save file
      await fs.writeFile(filePath, buffer);

      return {
        success: true,
        filePath,
        checksum,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while saving file'
      };
    }
  }

  // Retrieve file from order's sandbox directory
  async getFile(orderId: string, filename: string): Promise<{
    success: boolean;
    buffer?: Buffer;
    mimeType?: string;
    error?: string;
  }> {
    try {
      const orderDir = this.getOrderDir(orderId);
      const filePath = path.join(orderDir, filename);

      // Check if file exists
      await fs.access(filePath);

      // Read file
      const buffer = await fs.readFile(filePath);

      // Determine MIME type
      const mimeType = this.getMimeType(filename);

      return {
        success: true,
        buffer,
        mimeType,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'File not found or could not be read'
      };
    }
  }

  // Delete file from order's sandbox directory
  async deleteFile(orderId: string, filename: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const orderDir = this.getOrderDir(orderId);
      const filePath = path.join(orderDir, filename);

      await fs.unlink(filePath);

      // Try to remove order directory if it's empty
      try {
        await fs.rmdir(orderDir);
      } catch {
        // Directory not empty, that's fine
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not delete file'
      };
    }
  }

  // Delete entire order directory
  async deleteOrderDirectory(orderId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const orderDir = this.getOrderDir(orderId);
      await fs.rm(orderDir, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not delete order directory'
      };
    }
  }

  // List all files in an order directory
  async listOrderFiles(orderId: string): Promise<{
    success: boolean;
    files?: Array<{
      filename: string;
      size: number;
      type: string;
      modified: Date;
    }>;
    error?: string;
  }> {
    try {
      const orderDir = this.getOrderDir(orderId);
      const entries = await fs.readdir(orderDir, { withFileTypes: true });

      const files = [];
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(orderDir, entry.name);
          const stats = await fs.stat(filePath);
          files.push({
            filename: entry.name,
            size: stats.size,
            type: this.getMimeType(entry.name),
            modified: stats.mtime,
          });
        }
      }

      return { success: true, files };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not list files'
      };
    }
  }

  // Generate unique filename to prevent conflicts
  private generateUniqueFilename(originalFilename: string): string {
    const ext = path.extname(originalFilename);
    const name = path.basename(originalFilename, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${name}_${timestamp}_${random}${ext}`;
  }

  // Get MIME type based on file extension
  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.stl': 'application/octet-stream',
      '.obj': 'text/plain',
      '.3mf': 'application/octet-stream',
      '.step': 'application/octet-stream',
      '.stp': 'application/octet-stream',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // Get file statistics
  async getStats(): Promise<{
    totalOrders: number;
    totalFiles: number;
    totalSize: number;
  }> {
    try {
      const entries = await fs.readdir(this.baseUploadDir, { withFileTypes: true });
      let totalFiles = 0;
      let totalSize = 0;

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const orderFiles = await this.listOrderFiles(entry.name);
          if (orderFiles.success && orderFiles.files) {
            totalFiles += orderFiles.files.length;
            totalSize += orderFiles.files.reduce((sum, file) => sum + file.size, 0);
          }
        }
      }

      return {
        totalOrders: entries.length,
        totalFiles,
        totalSize,
      };
    } catch {
      return {
        totalOrders: 0,
        totalFiles: 0,
        totalSize: 0,
      };
    }
  }
}

// Export singleton instance
export const fileManager = new FileManager();
