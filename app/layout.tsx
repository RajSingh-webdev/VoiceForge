import type { Metadata } from 'next';
import './globals.css';
import Stepper from '@/components/Stepper';

export const metadata: Metadata = {
  title: 'VoiceForge',
  description: 'Voice AI Agent Builder',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-white text-[#0F3D3E] min-h-screen flex flex-col">
        <Stepper />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          {children}
        </main>
      </body>
    </html>
  );
}
