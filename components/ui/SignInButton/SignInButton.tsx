'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
        className="inline-flex items-center px-6 py-2 text-sm font-medium text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors duration-200"
      >
        Sign In
      </Link>
    </div>
  );
}