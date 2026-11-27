import React from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Flame,
  Headphones,
  History,
  PlayCircle,
  Users,
} from 'lucide-react';
import type { EarnMoneyState, EarnMoneyTab, ModalType } from '../../types/earnMoney';

interface HomeViewProps {
  state: EarnMoneyState;
  onNavigateTab: (tab: EarnMoneyTab, scrollToHistory?: boolean) => void;
  onOpenModal: (modal: ModalType) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  state,
  onNavigateTab,
  onOpenModal,
}) => {
  const progressPct = Math.min(
    100,
    Math.round((state.dailyAdsCompleted / state.dailyAdsTotal) * 100)
  );

  const listItems: {
    id: string;
    title: string;
    subtitle: string;
    extra?: string;
    icon: React.ReactNode;
    onClick: () => void;
  }[] = [
    {
      id: 'cs',
      title: 'Customer Service',
      subtitle: '24/7 live Telegram support & help desk',
      icon: <Headphones className="h-5 w-5" />,
      onClick: () => onOpenModal('customer_service'),
    },
    {
      id: 'ref_prog',
      title: 'Referral Program',
      subtitle: 'Invite friends & earn instant USDT bonuses',
      extra: '+0.10 USDT',
      icon: <Users className="h-5 w-5" />,
      onClick: () => onNavigateTab('refer'),
    },
    {
      id: 'how_to',
      title: 'How to Use Bot?',
      subtitle: 'Step-by-step guide to watch, earn & withdraw',
      icon: <BookOpen className="h-5 w-5" />,
      onClick: () => onOpenModal('how_to_use'),
    },
    {
      id: 'pay_hist',
      title: 'Payment History',
      subtitle: 'View all BEP20 withdrawal transactions',
      icon: <History className="h-5 w-5" />,
      onClick: () => onNavigateTab('withdraw', true),
    },
  ];

  return (
    <div className="space-y-4">
      {/* 4 Balance Cards in 2x2 Grid, 3D Style */}
      <section aria-label="USDT Balances" className="grid grid-cols-2 gap-3.5">
        <div className="mf-card-3d p-4">
          <p className="text-xs font-semibold text-slate-500">Total Balance</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-[#111827] tabular-nums">
            {state.totalBalance.toFixed(2)}{' '}
            <span className="text-sm font-bold text-[#00944A]">USDT</span>
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-400 tabular-nums">
            ≈ ${state.totalBalance.toFixed(2)} USD
          </p>
        </div>

        <div className="mf-card-3d p-4">
          <p className="text-xs font-semibold text-slate-500">Refer Balance</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-[#111827] tabular-nums">
            {state.referBalance.toFixed(2)}{' '}
            <span className="text-sm font-bold text-[#00944A]">USDT</span>
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-400 tabular-nums">
            1 USDT = $1.00 USD
          </p>
        </div>

        <div className="mf-card-3d p-4">
          <p className="text-xs font-semibold text-slate-500">Total Income</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-[#111827] tabular-nums">
            {state.totalIncome.toFixed(2)}{' '}
            <span className="text-sm font-bold text-[#00944A]">USDT</span>
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-400">Lifetime Earned</p>
        </div>

        <div className="mf-card-3d p-4">
          <p className="text-xs font-semibold text-slate-500">Total Withdraw</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-[#111827] tabular-nums">
            {state.totalWithdraw.toFixed(2)}{' '}
            <span className="text-sm font-bold text-[#00944A]">USDT</span>
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-400">BEP20 (BSC)</p>
        </div>
      </section>

      {/* Main Content: Premium Ads Card -> List Cards -> Go to Task Center Button */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        {/* Premium Ads Card */}
        <section className="mf-card-3d p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="mf-icon-circle flex h-10 w-10 items-center justify-center">
                <PlayCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-extrabold text-[#111827]">
                    Premium Ads
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-extrabold text-orange-600">
                    <Flame className="h-3 w-3" />
                    HOT
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500">
                  Watch sponsored video ads &amp; earn USDT
                </p>
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-[#00944A] tabular-nums whitespace-nowrap">
              +0.0010 USDT
            </span>
          </div>

          <div className="mt-4 space-y-2 rounded-2xl bg-[#F6F8FA] p-3.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600">
                Daily Ad Slots:{' '}
                <strong className="text-[#111827] tabular-nums">
                  {state.dailyAdsCompleted}/{state.dailyAdsTotal} Completed
                </strong>
              </span>
              <span className="font-bold text-[#00944A] tabular-nums">
                Next: Slot #{state.nextSlotNumber}
              </span>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00A854] to-[#00944A] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>Daily Earning Ceiling: ${state.dailyCeilingUsdt.toFixed(4)} USDT</span>
              <span className="tabular-nums">{progressPct}%</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => onOpenModal('ad_watch')}
              className="mf-btn-green-3d col-span-2 flex min-h-[46px] items-center justify-center px-4 py-2.5 text-sm font-extrabold"
            >
              Verify to Start
            </button>
            <button
              type="button"
              onClick={() => onOpenModal('slots_list')}
              className="mf-btn-outline-3d col-span-1 flex min-h-[46px] items-center justify-center px-3 py-2.5 text-xs font-extrabold whitespace-nowrap"
            >
              100 Slots
            </button>
          </div>
        </section>

        <div className="space-y-4">
          {/* List Cards in 3D Style */}
          <section className="space-y-2.5">
            {listItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="mf-btn-3d flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="mf-icon-circle flex h-10 w-10 shrink-0 items-center justify-center">
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-extrabold text-[#111827]">
                        {item.title}
                      </p>
                      {item.extra && (
                        <span className="font-mono text-xs font-bold text-[#00944A]">
                          {item.extra}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
          </section>

          {/* Green 3D Button: Go to Task Center -> */}
          <button
            type="button"
            onClick={() => onNavigateTab('tasks')}
            className="mf-btn-green-3d flex min-h-[50px] w-full items-center justify-center gap-2 px-5 py-3 text-sm font-extrabold"
          >
            <span>Go to Task Center</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
