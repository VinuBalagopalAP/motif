import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const font = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Motif | UGC Video Generator",
  description: "Drop a URL. Get a viral, highly-produced vertical short-form video in 15 seconds. Powered by Gemini 2.5 Flash, Pexels, and Giphy.",
  openGraph: {
    title: "Motif | UGC Video Generator",
    description: "Drop a URL. Get a viral, highly-produced vertical short-form video in 15 seconds. Powered by Gemini 2.5 Flash.",
    url: "https://motif-rho-wine.vercel.app/",
    siteName: "Motif",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Motif | UGC Video Generator",
    description: "Drop a URL. Get a viral, highly-produced vertical short-form video in 15 seconds.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={font.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
