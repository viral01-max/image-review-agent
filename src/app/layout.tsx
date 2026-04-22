import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Review Agent",
  description: "AI-powered product image validation, enhancement, and review pipeline",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-50">
        {children}
      </body>
    </html>
  );
}
