import { NextRequest, NextResponse } from 'next/server';
import { getCallerMemory, updateCallerMemory, clearCallerMemory } from '@/lib/callerMemory';

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.BOOKING_WEBHOOK_SECRET;
  if (!secret || !secret.trim()) return true; // If not configured, allow local testing

  const headerSecret =
    req.headers.get('x-webhook-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  return headerSecret === secret.trim();
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const agentId = (searchParams.get('agentId') || searchParams.get('agent_id') || 'default').trim();
  const phone = (searchParams.get('phone') || searchParams.get('callerPhone') || '').trim();

  if (!phone) {
    return NextResponse.json({ error: 'Caller phone parameter is required.' }, { status: 400 });
  }

  const result = await getCallerMemory(agentId, phone);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { agentId = 'default', callerPhone, displayName, preferredLanguage, note } = body;
  if (!callerPhone || typeof callerPhone !== 'string') {
    return NextResponse.json({ error: 'callerPhone is required.' }, { status: 400 });
  }

  const result = await updateCallerMemory(agentId, callerPhone, {
    displayName,
    preferredLanguage,
    note,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to update caller memory.' }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: 'Caller memory recorded.' });
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const agentId = (searchParams.get('agentId') || searchParams.get('agent_id') || 'default').trim();
  const phone = (searchParams.get('phone') || searchParams.get('callerPhone') || '').trim();

  if (!phone) {
    return NextResponse.json({ error: 'Caller phone parameter is required.' }, { status: 400 });
  }

  const result = await clearCallerMemory(agentId, phone);
  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to clear caller memory.' }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: 'Caller memory permanently cleared.' });
}
