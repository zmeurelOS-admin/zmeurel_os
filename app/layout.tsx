import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from '@/components/Toaster';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Zmeurel OS",
  description: "ERP pentru plantații zmeură și mure",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <body className={inter.className}>
  {children}
  <Toaster />
</body>
    </html>
  );
}