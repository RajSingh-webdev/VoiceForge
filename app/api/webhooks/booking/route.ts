import { NextResponse } from 'next/server';
import { BookingRecord } from '@/lib/types';

// In-memory store for deduplication and persistence fallback
const bookingStore = new Map<string, BookingRecord>();

export async function POST(req: Request) {
  try {
    // 1. Authentication via BOOKING_WEBHOOK_SECRET if configured
    const secret = process.env.BOOKING_WEBHOOK_SECRET;
    if (secret && secret.trim()) {
      const headerSecret =
        req.headers.get('x-webhook-secret') ||
        req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

      if (!headerSecret || headerSecret.trim() !== secret.trim()) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid or missing webhook secret.' },
          { status: 401 }
        );
      }
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const { callerName, callerPhone, appointmentDate, appointmentTime, service, notes } = body;

    // Validate required fields
    if (!callerName || typeof callerName !== 'string' || !callerName.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: callerName' },
        { status: 400 }
      );
    }

    if (!callerPhone || typeof callerPhone !== 'string' || !callerPhone.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: callerPhone' },
        { status: 400 }
      );
    }

    if (!appointmentDate || typeof appointmentDate !== 'string' || !appointmentDate.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: appointmentDate' },
        { status: 400 }
      );
    }

    if (!appointmentTime || typeof appointmentTime !== 'string' || !appointmentTime.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: appointmentTime' },
        { status: 400 }
      );
    }

    // Deduplication check
    const dedupKey = `${callerPhone.trim()}_${appointmentDate.trim()}_${appointmentTime.trim()}`;
    if (bookingStore.has(dedupKey)) {
      const existing = bookingStore.get(dedupKey)!;
      return NextResponse.json({
        success: true,
        status: 'confirmed',
        message: 'Duplicate booking detected; existing confirmation returned.',
        booking: existing,
      });
    }

    const newBooking: BookingRecord = {
      id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      callerName: callerName.trim(),
      callerPhone: callerPhone.trim(),
      appointmentDate: appointmentDate.trim(),
      appointmentTime: appointmentTime.trim(),
      service: service && typeof service === 'string' ? service.trim() : 'General Consultation',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      notes: notes && typeof notes === 'string' ? notes.trim() : undefined,
    };

    bookingStore.set(dedupKey, newBooking);

    return NextResponse.json({
      success: true,
      status: 'confirmed',
      message: 'Appointment successfully confirmed.',
      booking: newBooking,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to process booking request.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const bookings = Array.from(bookingStore.values());
  return NextResponse.json({
    total: bookings.length,
    bookings,
    secretConfigured: !!(process.env.BOOKING_WEBHOOK_SECRET && process.env.BOOKING_WEBHOOK_SECRET.trim()),
  });
}
