'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { SignOut } from '@/utils/auth-helpers/server';
import { handleRequest } from '@/utils/auth-helpers/client';
import { getRedirectMethod } from '@/utils/auth-helpers/settings';
import {  
  CreditCard, 
  LogOut,
  Scan,
  Sparkles,
  Code2,
  Terminal,
  Braces,
  Server,
  Key
} from 'lucide-react';

interface SidebarProps {
  user?: any;
}

export default function Sidebar({ user }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = getRedirectMethod() === 'client' ? useRouter() : null;
  const pathname = usePathname();

  const menuItems = [
    {
      href: '/assets',
      icon: Scan,
      label: 'Assets'
    },
    {
      href: '/dev',
      icon: Code2,
      label: 'API'
    }
  ];

  const bottomMenuItems = [
    {
      href: '/subscriptions',
      icon: CreditCard,
      label: 'Subscription'
    }
  ];

  return (
    <div 
      className={`fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 z-50 overflow-hidden ${
        isExpanded ? 'w-64' : 'w-16'
      }`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="flex flex-col h-full py-6 w-64">
        {/* Logo */}
        <div className="mb-8 px-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-9 flex justify-center">
              <img src="/icon.svg" alt="ld" className="w-8 h-8" />
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
              <div className="whitespace-nowrap">
                <h1 className="text-lg font-bold text-primary tracking-tight">
                  logodetekt
                </h1>
                <p className="text-[10px] text-muted-foreground">AI-Powered Analysis</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top menu items */}
        <div className="flex-1">
          <nav className="space-y-2 px-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center rounded-lg transition-all duration-200 h-11 ${
                    isExpanded ? 'px-3' : 'p-3 w-11'
                  } ${
                    isActive 
                      ? 'bg-sidebar-accent text-sidebar-primary glow-primary' 
                      : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                  }`}
                >
                  <div className="w-5 flex justify-center flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`ml-3 whitespace-nowrap font-medium overflow-hidden transition-all duration-300 ${isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom menu items */}
        <div>
          <nav className="space-y-2 px-3">
            {bottomMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center rounded-lg transition-all duration-200 h-11 ${
                    isExpanded ? 'px-3' : 'p-3 w-11'
                  } ${
                    isActive 
                      ? 'bg-sidebar-accent text-sidebar-primary glow-primary' 
                      : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                  }`}
                >
                  <div className="w-5 flex justify-center flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`ml-3 whitespace-nowrap font-medium overflow-hidden transition-all duration-300 ${isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
            {/* Sign out button */}
            <form onSubmit={(e) => handleRequest(e, SignOut, router)}>
              <input type="hidden" name="pathName" value={pathname} />
              <button 
                type="submit"
                className={`flex items-center rounded-lg transition-all duration-200 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 h-11 ${
                  isExpanded ? 'w-full px-3' : 'p-3 w-11'
                }`}
              >
                <div className="w-5 flex justify-center flex-shrink-0">
                  <LogOut className="w-5 h-5" />
                </div>
                <span className={`ml-3 whitespace-nowrap font-medium overflow-hidden transition-all duration-300 ${isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
                  Sign out
                </span>
              </button>
            </form>
          </nav>
        </div>
      </div>
    </div>
  );
}
