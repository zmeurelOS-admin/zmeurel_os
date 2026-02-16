import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Zmeurel OS - ERP Agricol',
  description: 'Aplicație ERP pentru plantații zmeură și mure',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
