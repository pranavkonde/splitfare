import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { createServerStorachaService } from '@/lib/storacha-server';
import { AppError, ValidationError } from '@/lib/errors';

const MAX_FILE_BYTES = 1024 * 1024; // 1MB — keep aligned with client receipt flow
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const uploadFile = async (req: AuthenticatedRequest) => {
  try {
    const formData = await req.formData();
    const uploaded = formData.get('file');

    if (!(uploaded instanceof File)) {
      return createErrorResponse(new ValidationError('Missing file'));
    }

    if (!ALLOWED_TYPES.has(uploaded.type)) {
      return createErrorResponse(new ValidationError('Unsupported file type'));
    }

    if (uploaded.size > MAX_FILE_BYTES) {
      return createErrorResponse(new ValidationError('File too large'));
    }

    try {
      const storacha = await createServerStorachaService();
      const cid = await storacha.uploadFile(uploaded as unknown as Blob);
      return createResponse({ cid }, 201);
    } catch (storachaError) {
      if (process.env.NODE_ENV === 'production') {
        console.error('Storacha upload failed:', storachaError);
        return createErrorResponse(new AppError('Upload failed', 503, 'STORAGE_UNAVAILABLE'));
      }

      const buffer = Buffer.from(await uploaded.arrayBuffer());
      const safeName = uploaded.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}-${randomUUID()}-${safeName}`;
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadsDir, { recursive: true });
      await writeFile(path.join(uploadsDir, fileName), buffer);
      const url = `/uploads/${fileName}`;
      console.warn('Storacha upload failed; used local upload fallback (development only):', storachaError);
      return createResponse({ cid: url }, 201);
    }
  } catch (error) {
    console.error('Error in POST /api/upload:', error);
    return createErrorResponse(error);
  }
};

export const POST = withMiddleware(uploadFile, { auth: true });
