import type { Metadata } from 'next';
import './globals.css';
import SideNavBar from '@/components/SideNavBar';
import TopNavBar from '@/components/TopNavBar';

export const metadata: Metadata = {
  title: 'LLM Observability',
  description: 'LLM observability dashboard — Trace viewer for AI engineers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-on-surface font-body-md h-screen flex overflow-hidden">
        <SideNavBar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopNavBar />
          <main className="flex-1 overflow-y-auto p-margin-desktop bg-background">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
