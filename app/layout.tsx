import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'K-RERA Audit.OS',
  description: 'Statutory Intelligence Unit',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
