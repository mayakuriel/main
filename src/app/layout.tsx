import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Company Intelligence Brief Generator",
  description: "AI-powered sales brief generator for enterprise account research.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
