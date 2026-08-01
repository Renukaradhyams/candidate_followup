import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BSC Candidate CRM — Enterprise HRMS",
  description: "Enterprise HRMS & Recruitment Management System for BSC The Textile Mall",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#EDE8DE] text-[#1E2D4E] min-h-screen">
        {children}
      </body>
    </html>
  );
}
