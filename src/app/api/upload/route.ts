import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import {
  uploadImageToStorage,
  uploadAuthorPhotoToStorage,
} from '@/lib/storage/image-service';

const HEIC_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);

async function normalizeToJpeg(file: File): Promise<File> {
  const isHeic =
    HEIC_TYPES.has(file.type.toLowerCase()) ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name);

  if (!isHeic) return file;

  const buffer = Buffer.from(await file.arrayBuffer());
  const jpeg = await sharp(buffer).rotate().jpeg({ quality: 88 }).toBuffer();
  // Copy into a plain ArrayBuffer to satisfy BlobPart typing
  const ab = jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength) as ArrayBuffer;
  const baseName = file.name.replace(/\.(heic|heif)$/i, '');
  return new File([ab], `${baseName}.jpg`, { type: 'image/jpeg' });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const rawFile = formData.get('file') as File | null;
    const sessionId = formData.get('sessionId') as string | null;
    const type = (formData.get('type') as string) ?? 'trip';
    const email = formData.get('email') as string | null;

    if (!rawFile) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const file = await normalizeToJpeg(rawFile);

    if (type === 'author') {
      if (!email) {
        return NextResponse.json({ error: 'Email required for author photo' }, { status: 400 });
      }
      const result = await uploadAuthorPhotoToStorage(file, email);
      return NextResponse.json(result);
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required for trip images' }, { status: 400 });
    }

    const result = await uploadImageToStorage(file, sessionId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
