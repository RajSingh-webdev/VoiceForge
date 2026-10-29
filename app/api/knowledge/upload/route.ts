import { NextResponse } from 'next/server';
import { uploadKnowledgeBaseFile, deleteKnowledgeBaseDocument } from '@/lib/elevenlabs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt', '.docx', '.doc', '.md']);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in upload.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds maximum allowed size of 10MB.' },
        { status: 400 }
      );
    }

    const fileName = file.name || 'document.pdf';
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error:
            'Unsupported file format. Please upload a PDF (.pdf), Text (.txt), or Word (.docx) document.',
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || 'application/pdf';

    const document = await uploadKnowledgeBaseFile(buffer, fileName, mimeType);

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to upload knowledge base document.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('id') || searchParams.get('documentId');

    if (!documentId || !documentId.trim()) {
      return NextResponse.json(
        { error: 'Document ID is required for deletion.' },
        { status: 400 }
      );
    }

    await deleteKnowledgeBaseDocument(documentId.trim());

    return NextResponse.json({
      success: true,
      deletedId: documentId.trim(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to delete knowledge base document.' },
      { status: 500 }
    );
  }
}
