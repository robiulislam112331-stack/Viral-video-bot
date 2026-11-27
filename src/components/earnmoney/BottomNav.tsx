import React from 'react';
import { ClipboardCheck, Home, Users, Wallet } from 'lucide-react';
import type { EarnMoneyTab } from '../../types/earnMoney';

interface BottomNavProps {
  activeTab: EarnMoneyTab;
  onSelectTab: (tab: EarnMoneyTab) => void;
}

const NAV_ITEMS: {
  id: EarnMoneyTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'home', label: 'HOME', Icon: Home },
  { id: 'tasks', label: 'TASKS', Icon: ClipboardCheck },
  { id: 'refer', label: 'REFER', Icon: Users },
  { id: 'withdraw', label: 'WITHDRAW', Icon: Wallet },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 z-40 h-[68px] bg-[#00944A] shadow-[0_-6px_20px_rgba(0,148,74,0.22)]"
    >
      <div className="mx-auto grid h-full max-w-5xl grid-cols-4 items-center gap-1 px-2 py-1.5">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-all ${
                isActive
                  ? 'bg-white text-[#00944A] shadow-sm'
                  : 'bg-transparent text-white hover:bg-white/10'
              }`}
            >
              <Icon className={`h-6 w-6 shrink-0 ${isActive ? 'text-[#00944A]' : 'text-white'}`} />
              <span
                className={`text-[11px] font-extrabold leading-none tracking-wide whitespace-nowrap ${
                  isActive ? 'text-[#00944A]' : 'text-white'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
