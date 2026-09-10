import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Webchat · LINE inbox",
  description: "กล่องข้อความ LINE OA แบบเรียบง่าย",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
