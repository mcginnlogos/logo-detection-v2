'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogIn } from 'lucide-react';

export default function SignInButton() {
  const pathname = usePathname();
  
  // Don't show the sign-in button on the sign-in page
  if (pathname === '/signin') {
    return null;
  }

  return (
    <div className="flex justify-end p-6 absolute top-0 right-0 z-10">
      <Link
        href="/signin"
        className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-foreground bg-card/50 hover:bg-card border border-border hover:border-primary/50 rounded-lg transition-all duration-200 backdrop-blur-sm hover:glow-primary"
      >
        <LogIn className="w-4 h-4" />
        Sign In
      </Link>
    </div>
  );
}
