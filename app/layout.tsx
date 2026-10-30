import type { Metadata, Viewport } from 'next';
import './globals.css';
import Stepper from '@/components/Stepper';

export const metadata: Metadata = {
  title: 'VoiceForge - Voice AI Agent Builder',
  description: 'Voice AI Agent Builder for Small Businesses with Real-Time Hindi & English Telephony',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0F3D3E',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="bg-white text-[#0F3D3E] min-h-screen flex flex-col overflow-x-hidden antialiased selection:bg-[#1F8A84]/20">
        <Stepper />
        <main className="flex-1 flex flex-col w-full overflow-x-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
