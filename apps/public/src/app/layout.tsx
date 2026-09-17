import '@/styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Next Gen Buildathon — Build the Future',
  description: 'Register for the Next Gen Buildathon — the premier hackathon for innovators, developers, and creators pushing the boundaries of technology.',
  keywords: 'hackathon, buildathon, coding, AI, web development, innovation, competition, registration',
  openGraph: {
    title: 'Next Gen Buildathon — Build the Future',
    description: 'Register for the premier hackathon for innovators and creators.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Aurora Background */}
        <div className="aurora">
          <div className="aurora-blob cyan" />
          <div className="aurora-blob purple" />
          <div className="aurora-blob pink" />
        </div>
        {children}
      </body>
    </html>
  );
}
