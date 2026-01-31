import { Metadata } from 'next';
import Footer from '@/components/ui/Footer';
import Sidebar from '@/components/ui/Sidebar/Sidebar';
import SignInButton from '@/components/ui/SignInButton/SignInButton';
import { Toaster } from '@/components/ui/Toasts/toaster';
import { PropsWithChildren, Suspense } from 'react';
import { getURL } from '@/utils/helpers';
import { createClient } from '@/utils/supabase/server';
import { Analytics } from "@vercel/analytics/next"
import 'styles/main.css';

const title = 'Logo Detection Project';
const description = 'AI-driven logo detection and analysis tools.';

export const metadata: Metadata = {
  metadataBase: new URL(getURL()),
  title: title,
  description: description,
  openGraph: {
    title: title,
    description: description
  }
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-background">
        {user ? (
          // Authenticated layout with sidebar
          <div className="flex">
            <Sidebar user={user} />
            <main className="flex-1 ml-16">
              {children}
            </main>
          </div>
        ) : (
          // Unauthenticated layout with conditional sign-in button
          <div>
            <SignInButton />
            <main className="min-h-screen">
              {children}
            </main>
          </div>
        )}
        <Suspense>
          <Toaster />
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
