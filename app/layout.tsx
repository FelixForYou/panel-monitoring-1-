import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FXHL Ptero Monitor',
  description: 'PTLA-only Pterodactyl monitoring & cleanup dashboard',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
