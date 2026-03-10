import { Metadata } from 'next';
import './globals.css';

export const metadata = {
  title: '$SATA — Strive Asset Management',
  description: 'Interactive visualization of SATA price movement toward par value.',
  openGraph: {
    title: '$SATA Black Hole Visualizer',
    description: 'Real-time tracking of SATA preferred stock with dynamic yield calculations.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}