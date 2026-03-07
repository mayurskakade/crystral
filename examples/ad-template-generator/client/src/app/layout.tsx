import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ad Template Generator — Crystal AI',
  description: 'AI-powered social media ad template generator built with Crystal AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
