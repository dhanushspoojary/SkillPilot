import type { Metadata } from 'next';
import './globals.css';

// Nonce-based CSP needs a fresh render per request; statically prerendered HTML cannot carry a nonce.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'SkillPilot — Your career, continuously guided',
  description: 'An evidence-driven student career operating system that assesses, plans, mentors, verifies and adapts.',
  applicationName: 'SkillPilot',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  // Keep this consistent with app/robots.txt: crawling is disallowed.
  robots: { index: false, follow: false },
  openGraph: {
    title: 'SkillPilot — Your career, continuously guided',
    description: 'Assess. Diagnose. Act. Prove. Reassess.',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
