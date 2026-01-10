'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { SignOut } from '@/utils/auth-helpers/server';
import { handleRequest } from '@/utils/auth-helpers/client';
import { getRedirectMethod } from '@/utils/auth-helpers/settings';
import { 
  LayoutDashboard, 
  CreditCard, 
  FileText, 
  LogOut 
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
      href: '/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard'
    },
    {
      href: '/subscriptions',
      icon: CreditCard,
      label: 'Pricing'
    }
  ];

  const bottomItems = [
    {
      href: '/files',
      icon: FileText,
      label: 'Files'
    }
  ];

  return (
    <div 
      className={`fixed left-0 top-0 h-full bg-zinc-900 border-r border-zinc-800 transition-all duration-300 z-50 ${
        isExpanded ? 'w-64' : 'w-16'
      }`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="flex flex-col h-full py-6">
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
                  className={`flex items-center px-3 py-3 rounded-lg transition-colors duration-200 ${
                    !isExpanded ? 'justify-center' : ''
                  } ${
                    isActive 
                      ? 'bg-zinc-800 text-white' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {isExpanded && (
                    <span className="ml-3 whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom menu items */}
        <div>
          <nav className="space-y-2 px-3">
            {bottomItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-3 rounded-lg transition-colors duration-200 ${
                    !isExpanded ? 'justify-center' : ''
                  } ${
                    isActive 
                      ? 'bg-zinc-800 text-white' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {isExpanded && (
                    <span className="ml-3 whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
            
            {/* Sign out button */}
            <form onSubmit={(e) => handleRequest(e, SignOut, router)}>
              <input type="hidden" name="pathName" value={pathname} />
              <button 
                type="submit"
                className={`w-full flex items-center px-3 py-3 rounded-lg transition-colors duration-200 text-zinc-400 hover:text-white hover:bg-zinc-800 ${
                  !isExpanded ? 'justify-center' : ''
                }`}
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {isExpanded && (
                  <span className="ml-3 whitespace-nowrap">
                    Sign out
                  </span>
                )}
              </button>
            </form>
          </nav>
        </div>
      </div>
    </div>
  );
}