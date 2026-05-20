import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MelonOps — Raymon J Land Internal Operations",
  description: "Internal operations system for Raymon J Land Watermelon Sales & Land Truck Brokers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-brand-dark text-brand-cream font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
