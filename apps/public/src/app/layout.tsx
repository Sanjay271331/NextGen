import '@/styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NextGen Build-a-thon 2026 | Chapter 02',
  description: 'NextGen Build-a-thon 2026 Chapter 02 - A 24-hour National-Level Hackathon powered by The Mind Mesh, Vidhyavardhaka College of Engineering (VVCE), Mysuru.',
  keywords: 'NextGen Buildathon, VVCE, The Mind Mesh, Hackathon 2026, AI, IoT, FinTech, Sustainability, Engineering, Innovation, Registration',
  openGraph: {
    title: 'NextGen Build-a-thon 2026 | Chapter 02',
    description: 'A 24-hour National-Level Hackathon with ₹11,00,000 Prize Pool. Powered by The Mind Mesh.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Cosmic Background */}
        <div className="cosmic-bg">
          <div className="bg-grid-pattern" />
          <div className="cosmic-orb cosmic-orb-1" />
          <div className="cosmic-orb cosmic-orb-2" />
          <div className="cosmic-orb cosmic-orb-3" />
        </div>
        {children}
      </body>
    </html>
  );
}
