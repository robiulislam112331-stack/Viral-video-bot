import React from 'react';

export type AppView = 'bot' | 'admin';
export type BotSection = 'all' | 'unlocked';

interface TopBarProps {
  view: AppView;
  onToggleView: (next: AppView) => void;
  membershipVerified: boolean;
  botSection: BotSection;
  onSelectBotSection: (section: BotSection) => void;
  unlockedCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  view,
  onToggleView,
  membershipVerified,
  botSection,
  onSelectBotSection,
  unlockedCount,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0A0B0E]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => {
            onToggleView('bot');
            onSelectBotSection('all');
          }}
          className="font-display text-lg font-bold tracking-tight text-[#F3F4F6] hover:text-[#E5A93C] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C] rounded-md"
        >
          CineVault Bot
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#9CA3AF]"
        >
          {view === 'bot' && membershipVerified ? (
            <>
              <button
                type="button"
                onClick={() => onSelectBotSection('all')}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                  botSection === 'all'
                    ? 'text-[#F3F4F6] border-[#E5A93C]'
                    : 'border-transparent hover:text-[#F3F4F6]'
                }`}
              >
                All Videos
              </button>
              <button
                type="button"
                onClick={() => onSelectBotSection('unlocked')}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 tabular-nums ${
                  botSection === 'unlocked'
                    ? 'text-[#F3F4F6] border-[#E5A93C]'
                    : 'border-transparent hover:text-[#F3F4F6]'
                }`}
              >
                Unlocked ({unlockedCount})
              </button>
            </>
          ) : view === 'bot' ? (
            <span className="text-xs text-[#6B7280] whitespace-nowrap shrink-0">
              Channel Verification Required
            </span>
          ) : (
            <span className="text-xs text-[#9CA3AF] whitespace-nowrap shrink-0">
              Administration Console
            </span>
          )}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          {view === 'bot' ? (
            <button
              type="button"
              onClick={() => onToggleView('admin')}
              className="min-h-[40px] rounded-lg border border-white/[0.12] bg-[#12141A] px-4 py-2 text-xs font-semibold text-[#F3F4F6] hover:border-[#E5A93C]/60 hover:text-[#E5A93C] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C]"
            >
              Admin Panel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onToggleView('bot')}
              className="min-h-[40px] rounded-lg bg-[#E5A93C] px-4 py-2 text-xs font-semibold text-[#0A0B0E] hover:bg-[#F0B94F] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C]"
            >
              Back to Bot
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
