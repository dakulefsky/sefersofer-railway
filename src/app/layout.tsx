import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SeferSofer — Hebrew Manuscript Transcription",
  description: "AI-powered transcription of handwritten Hebrew manuscripts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={inter.variable}>
      <body className="bg-stone-50 text-stone-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
