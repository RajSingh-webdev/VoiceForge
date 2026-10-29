import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ reply: 'OK' });
}

export async function POST() {
  return NextResponse.json({ reply: 'OK' });
}
