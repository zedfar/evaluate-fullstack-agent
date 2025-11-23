import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { put, del, head } from '@vercel/blob';
import { ConfigService } from '@nestjs/config';

interface BlobUploadResult {
  url: string;
  pathname: string;
  downloadUrl: string;
  size: number;
  contentType: string;
}

@Injectable()
export class BlobStorageService {
  constructor(private configService: ConfigService) {}

  /**
   * Upload file to Vercel Blob
   * @param file - Multer file object
   * @param folder - Folder path (e.g., 'uploads/user-id')
   * @returns Blob URL and metadata
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<BlobUploadResult> {
    try {
      const token = this.configService.get<string>('BLOB_READ_WRITE_TOKEN');

      if (!token) {
        throw new Error(
          'BLOB_READ_WRITE_TOKEN is not configured. Please set it in .env file.',
        );
      }

      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const safeFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${folder}/${uniqueSuffix}-${safeFilename}`;

      // Upload to Vercel Blob
      const blob = await put(filename, file.buffer, {
        access: 'public',
        token,
        contentType: file.mimetype,
      });

      return {
        url: blob.url,
        pathname: blob.pathname,
        downloadUrl: blob.downloadUrl,
        size: file.size,
        contentType: file.mimetype,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload file to Vercel Blob: ${error.message}`,
      );
    }
  }

  /**
   * Delete file from Vercel Blob
   * @param blobUrl - URL of the file to delete
   */
  async deleteFile(blobUrl: string): Promise<void> {
    try {
      const token = this.configService.get<string>('BLOB_READ_WRITE_TOKEN');

      if (!token) {
        throw new Error(
          'BLOB_READ_WRITE_TOKEN is not configured. Please set it in .env file.',
        );
      }

      await del(blobUrl, { token });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to delete file from Vercel Blob: ${error.message}`,
      );
    }
  }

  /**
   * Get file metadata from Vercel Blob
   * @param blobUrl - URL of the file
   */
  async getFileMetadata(blobUrl: string) {
    try {
      const token = this.configService.get<string>('BLOB_READ_WRITE_TOKEN');

      if (!token) {
        throw new Error(
          'BLOB_READ_WRITE_TOKEN is not configured. Please set it in .env file.',
        );
      }

      const metadata = await head(blobUrl, { token });
      return metadata;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get file metadata: ${error.message}`,
      );
    }
  }
}
