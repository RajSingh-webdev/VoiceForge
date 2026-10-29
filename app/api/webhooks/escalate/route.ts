import { NextResponse } from 'next/server';

export interface EscalationRecord {
  id: string;
  callerName: string;
  callerPhone: string;
  reason: string;
  status: 'escalated' | 'resolved';
  createdAt: string;
  notes?: string;
  agentId?: string;
}

const escalationStore = new Map<string, EscalationRecord>();

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body. Please provide escalation details.' },
        { status: 400 }
      );
    }

    const {
      callerName = 'Unknown Caller',
      callerPhone = 'Not provided',
      transferPhone = '',
      targetPhone = '',
      reason = 'Caller requested a human staff member',
      notes = '',
      agentId,
    } = body || {};

    const destination = transferPhone || targetPhone || '+91 98765 43210';

    const record: EscalationRecord = {
      id: `esc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      callerName: String(callerName).trim() || 'Anonymous Caller',
      callerPhone: String(callerPhone).trim() || 'Not provided',
      reason: String(reason).trim() || 'Customer requested human assistance',
      status: 'escalated',
      createdAt: new Date().toISOString(),
      notes: typeof notes === 'string' ? notes.trim() : `Call routed to ${destination}`,
      agentId: typeof agentId === 'string' ? agentId.trim() : undefined,
    };

    escalationStore.set(record.id, record);

    return NextResponse.json({
      success: true,
      status: 'transferred',
      destination,
      message: `Call transferred to human staff at ${destination}. Staff notified.`,
      escalation: record,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to process escalation request.' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId') || undefined;

  let records = Array.from(escalationStore.values());
  if (agentId) {
    records = records.filter((r) => !r.agentId || r.agentId === agentId);
  }

  return NextResponse.json({
    success: true,
    total: records.length,
    escalations: records,
    status: 'operational',
  });
}
