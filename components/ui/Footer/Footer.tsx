import Link from 'next/link';

import Logo from '@/components/icons/Logo';
import GitHub from '@/components/icons/GitHub';

export default function Footer() {
  return (
    <footer className="mx-auto max-w-[1920px] px-6 bg-card/30 border-t border-border">
      <div className="grid grid-cols-1 gap-8 py-12 text-foreground transition-colors duration-150 lg:grid-cols-12">
        <div className="col-span-1 lg:col-span-2">
          <Link
            href="/"
            className="flex items-center flex-initial font-bold md:mr-24"
          >
            <span className="mr-2 border rounded-full border-border">
              <Logo />
            </span>
            <span>Logo<span className="text-gradient">Detect</span></span>
          </Link>
        </div>
        <div className="col-span-1 lg:col-span-2">
          <ul className="flex flex-col flex-initial md:flex-1">
            <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="/"
                className="text-muted-foreground transition duration-150 ease-in-out hover:text-foreground"
              >
                Home
              </Link>
            </li>
            <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="/"
                className="text-muted-foreground transition duration-150 ease-in-out hover:text-foreground"
              >
                About
              </Link>
            </li>
            <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="/"
                className="text-muted-foreground transition duration-150 ease-in-out hover:text-foreground"
              >
                Careers
              </Link>
            </li>
            <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="/"
                className="text-muted-foreground transition duration-150 ease-in-out hover:text-foreground"
              >
                Blog
              </Link>
            </li>
          </ul>
        </div>
        <div className="col-span-1 lg:col-span-2">
          <ul className="flex flex-col flex-initial md:flex-1">
            <li className="py-3 md:py-0 md:pb-4">
              <p className="font-bold text-foreground transition duration-150 ease-in-out">
                LEGAL
              </p>
            </li>
            <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="/"
                className="text-muted-foreground transition duration-150 ease-in-out hover:text-foreground"
              >
                Privacy Policy
              </Link>
            </li>
            <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="/"
                className="text-muted-foreground transition duration-150 ease-in-out hover:text-foreground"
              >
                Terms of Use
              </Link>
            </li>
          </ul>
        </div>
        <div className="flex items-start col-span-1 text-foreground lg:col-span-6 lg:justify-end">
          <div className="flex items-center h-10 space-x-6">
            <a
              aria-label="Github Repository"
              href="https://github.com/vercel/nextjs-subscription-payments"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <GitHub />
            </a>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-between py-12 space-y-4 md:flex-row border-t border-border">
        <div>
          <span className="text-muted-foreground">
            &copy; {new Date().getFullYear()} LogoDetect. All rights reserved.
          </span>
        </div>
        <div className="flex items-center">
          <span className="text-muted-foreground">Crafted by</span>
          <a href="https://vercel.com" aria-label="Vercel.com Link">
            <img
              src="/vercel.svg"
              alt="Vercel.com Logo"
              className="inline-block h-6 ml-4 text-foreground"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
