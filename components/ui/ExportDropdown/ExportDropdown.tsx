'use client';

import { Download, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface ExportDropdownProps {
  onExport: (format: 'csv' | 'json') => void;
}

export default function ExportDropdown({ onExport }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (format: 'csv' | 'json') => {
    onExport(format);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
      >
        <Download className="w-4 h-4" />
        Export
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-32 rounded-lg bg-card border border-border shadow-lg z-10">
          <button
            onClick={() => handleExport('csv')}
            className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-secondary transition-colors rounded-t-lg"
          >
            CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-secondary transition-colors rounded-b-lg"
          >
            JSON
          </button>
        </div>
      )}
    </div>
  );
}
