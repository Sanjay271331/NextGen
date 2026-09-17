import '@/styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Next Gen Buildathon — Admin Dashboard',
  description: 'Administration dashboard for Next Gen Buildathon platform',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>{children}</body>
    </html>
  );
}
