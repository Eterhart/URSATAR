import type { Metadata } from 'next';
import { Prompt } from 'next/font/google';
import './globals.css';

const prompt = Prompt({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin', 'thai'],
  display: 'swap',
  variable: '--font-main',
});

export const metadata: Metadata = {
  title: 'BU Course Schedule Planner | มหาวิทยาลัยกรุงเทพ',
  description: 'เว็บแอปพลิเคชันวางแผนและจัดตารางเรียนสำหรับนักศึกษามหาวิทยาลัยกรุงเทพ (Bangkok University)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={prompt.variable}>
      <body className="min-h-screen bg-white text-[#1D1D1F] antialiased">
        {children}
      </body>
    </html>
  );
}
