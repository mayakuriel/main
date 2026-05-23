import type { Metadata } from "next";
import "./globals.css";

// Workaround for sporadic workStore invariant crashes in some environments.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Company Intelligence Brief Generator",
  description: "AI-powered sales brief generator for enterprise account research.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
