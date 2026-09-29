import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "X 게시 대기열",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
