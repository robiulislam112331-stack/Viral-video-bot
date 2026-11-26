import React, { useState } from 'react';
import { Check, Copy, Menu } from 'lucide-react';
import { DEFAULT_AVATAR } from '../../utils/telegram';

interface TopHeaderProps {
  userName: string;
  userId: string;
  userAvatar: string;
  onOpenMenu: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  userName,
  userId,
  userAvatar,
  onOpenMenu,
}) => {
  const [copied, setCopied] = useState(false);
  const [imgSrc, setImgSrc] = useState(userAvatar || DEFAULT_AVATAR);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <header className="w-full bg-white border-b border-slate-200/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        {/* Left: Circular Profile Photo + Name Bold Black + ID with Copy Icon */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-[#00944A]/20 bg-slate-100 shadow-sm">
            <img
              src={imgSrc}
              alt={userName}
              referrerPolicy="no-referrer"
              onError={() => {
                if (imgSrc !== DEFAULT_AVATAR) {
                  setImgSrc(DEFAULT_AVATAR);
                }
              }}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-extrabold leading-tight text-[#111827]">
              {userName}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className="font-mono tabular-nums">ID: {userId}</span>
              <button
                type="button"
                onClick={() => void handleCopyId()}
                aria-label="Copy user ID"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#00944A] transition-colors"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[#00944A]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: ONLY Menu button */}
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="mf-btn-3d inline-flex h-[42px] w-[42px] items-center justify-center !rounded-full text-[#111827]"
          >
            <Menu className="h-5 w-5 text-[#00944A]" />
          </button>
        </div>
      </div>
    </header>
  );
};
