import { NextResponse } from 'next/server';
import { BookingRecord } from '@/lib/types';
import { isSupabaseConfigured, saveBookingToDb, getBookingsFromDb } from '@/lib/supabase';
import { updateCallerMemory } from '@/lib/callerMemory';

// In-memory store for fast deduplication and local persistence fallback
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

    const {
      callerName,
      callerPhone,
      appointmentDate,
      appointmentTime,
      service,
      notes,
      agentId,
    } = body;

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

    // Basic format validation
    const cleanPhone = callerPhone.replace(/[\s\-\(\)\.]/g, '');
    if (cleanPhone.length < 7 || !/^\+?[0-9]+$/.test(cleanPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Please provide a valid phone number.' },
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
    const dedupKey = `${cleanPhone}_${appointmentDate.trim()}_${appointmentTime.trim()}`;
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
      callerPhone: cleanPhone,
      appointmentDate: appointmentDate.trim(),
      appointmentTime: appointmentTime.trim(),
      service: service && typeof service === 'string' ? service.trim() : 'General Consultation',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      notes: notes && typeof notes === 'string' ? notes.trim() : undefined,
    };

    bookingStore.set(dedupKey, newBooking);

    // Persist to Supabase if configured
    let cloudPersisted = false;
    if (isSupabaseConfigured()) {
      const dbResult = await saveBookingToDb(newBooking, agentId);
      cloudPersisted = dbResult.success;

      // Also update privacy-preserving caller memory
      await updateCallerMemory(agentId || 'default', cleanPhone, {
        displayName: callerName.trim(),
        note: `Booked ${newBooking.service} on ${newBooking.appointmentDate} at ${newBooking.appointmentTime}`,
      }).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      status: 'confirmed',
      message: 'Appointment successfully confirmed.',
      booking: newBooking,
      cloudPersisted,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to process booking request.' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId') || undefined;

  let bookings = Array.from(bookingStore.values());
  let fromDb = false;

  if (isSupabaseConfigured()) {
    const dbRes = await getBookingsFromDb(agentId);
    if (!dbRes.error && dbRes.bookings.length > 0) {
      bookings = dbRes.bookings.map((b) => ({
        id: b.id,
        callerName: b.caller_name,
        callerPhone: b.caller_phone,
        appointmentDate: b.appointment_date,
        appointmentTime: b.appointment_time,
        service: b.service,
        status: b.status,
        createdAt: b.created_at,
        notes: b.notes,
      }));
      fromDb = true;
    }
  }

  return NextResponse.json({
    total: bookings.length,
    bookings,
    fromDb,
    secretConfigured: !!(
      process.env.BOOKING_WEBHOOK_SECRET && process.env.BOOKING_WEBHOOK_SECRET.trim()
    ),
  });
}
