'use client';

import { useState } from 'react';

export default function TopNavBar() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="bg-surface-container-lowest border-b border-surface-container shadow-sm flex justify-between items-center w-full px-margin-desktop h-16 sticky top-0 z-50 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-lg">
        {/* Mobile Menu Trigger */}
        <button className="md:hidden p-xs text-on-surface-variant hover:bg-surface-container-low transition-colors rounded">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="font-h3 text-h3 font-bold text-on-surface">LLM Observability</div>

        {/* Search Bar (desktop) */}
        <div className="hidden md:flex items-center relative w-64 group">
          <span className="material-symbols-outlined absolute left-sm text-on-surface-variant pointer-events-none group-focus-within:text-primary transition-colors text-[20px]">
            search
          </span>
          <input
            type="text"
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-xl pr-md py-xs font-body-sm text-body-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-on-surface-variant/70"
            placeholder="Search traces, prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-md">
        <button className="cursor-pointer active:opacity-80 p-xs rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors flex items-center justify-center h-8 w-8">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
        </button>
        <button className="cursor-pointer active:opacity-80 p-xs rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors flex items-center justify-center h-8 w-8">
          <span className="material-symbols-outlined text-[20px]">light_mode</span>
        </button>
        <div className="h-6 w-px bg-outline-variant mx-xs" />
        <button className="cursor-pointer active:opacity-80 p-xs rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors flex items-center justify-center h-8 w-8">
          <span className="material-symbols-outlined text-[24px]">account_circle</span>
        </button>
      </div>
    </header>
  );
}
