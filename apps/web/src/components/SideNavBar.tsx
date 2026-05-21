'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: 'dashboard' },
  { href: '/traces', label: 'Traces', icon: 'analytics' },
  { href: '/evaluations', label: 'Evaluations', icon: 'rule' },
  { href: '/datasets', label: 'Datasets', icon: 'database' },
];

export default function SideNavBar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="hidden md:flex flex-col w-60 shrink-0 bg-surface-container-lowest border-r border-surface-container sticky top-0 h-screen py-lg gap-sm">
      {/* Header */}
      <div className="px-lg pb-md mb-sm flex flex-col gap-xs border-b border-surface-container">
        <h2 className="font-h2 text-h2 text-on-surface">Project Workspace</h2>
        <span className="font-body-sm text-body-sm text-on-surface-variant">Enterprise LLM</span>
      </div>

      {/* Navigation Items */}
      <ul className="flex flex-col gap-xs px-sm flex-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`group cursor-pointer flex items-center gap-md px-md py-sm rounded-lg transition-all ${
                  active
                    ? 'text-primary font-bold bg-primary-container/10'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${active ? 'fill' : ''}`}
                >
                  {item.icon}
                </span>
                <span className="font-body-sm text-body-sm">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Bottom: Settings */}
      <div className="px-sm pt-sm border-t border-surface-container">
        <Link
          href="/settings"
          className={`group cursor-pointer flex items-center gap-md px-md py-sm rounded-lg transition-all ${
            isActive('/settings')
              ? 'text-primary font-bold bg-primary-container/10'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="font-body-sm text-body-sm">Settings</span>
        </Link>
      </div>
    </nav>
  );
}
