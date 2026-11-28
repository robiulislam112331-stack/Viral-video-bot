import React from 'react';
import { Flame, PlayCircle, PlusCircle, ShieldCheck } from 'lucide-react';
import {
  isTaskCompletedForUser,
  normalizeTaskType,
} from '../../data/defaultEarnMoneyState';
import type {
  BonusTaskItem,
  EarnMoneyConfig,
  EarnMoneyState,
  ModalType,
} from '../../types/earnMoney';

interface TasksViewProps {
  state: EarnMoneyState;
  config: EarnMoneyConfig;
  onOpenModal: (modal: ModalType) => void;
  onCompleteBonusTask: (task: BonusTaskItem) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  state,
  config,
  onOpenModal,
  onCompleteBonusTask,
}) => {
  const visibleTasks = state.bonusTasks.filter(
    (t) => t.active !== false && !isTaskCompletedForUser(t, state)
  );
  const availableTasksCount = visibleTasks.length;
  const dailyTotal = Math.max(1, config.dailyAdsLimitPerUser || state.dailyAdsTotal || 20);
  const dailyCeiling = Number((dailyTotal * config.perAdViewReward).toFixed(4));
  const progressPct = Math.min(100, Math.round((state.dailyAdsCompleted / dailyTotal) * 100));
  const adsSlotEmpty = !config.premiumAdsEnabled || config.premiumAdsBudget <= 0;

  return (
    <div className="space-y-5">
      {/* Premium Ads Card */}
      <section className="mf-card-3d p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="mf-icon-circle flex h-11 w-11 items-center justify-center">
              <PlayCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-extrabold text-[#111827]">
                  Premium Ads
                </h2>
                {adsSlotEmpty ? (
                  <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-extrabold text-red-600">
                    EMPTY
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-extrabold text-orange-600">
                    <Flame className="h-3 w-3" />
                    HOT
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-slate-500">
                {adsSlotEmpty
                  ? 'Premium Ads Slot Empty'
                  : `Daily Limit: ${state.dailyAdsCompleted}/${dailyTotal} (Max $${dailyCeiling.toFixed(4)})`}
              </p>
            </div>
          </div>
          <span className="font-mono text-sm font-bold text-[#00944A] tabular-nums whitespace-nowrap">
            +{config.perAdViewReward.toFixed(4)} USDT
          </span>
        </div>

        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#00A854] to-[#00944A] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <button
            type="button"
            disabled={adsSlotEmpty}
            onClick={() => onOpenModal('ad_watch')}
            className="mf-btn-green-3d flex min-h-[46px] items-center justify-center px-4 py-2.5 text-sm font-extrabold sm:col-span-2 disabled:opacity-50"
          >
            {adsSlotEmpty
              ? 'Premium Ads Slot Empty'
              : `Verify to Start (Slot #${Math.min(dailyTotal, state.dailyAdsCompleted + 1)})`}
          </button>
          <button
            type="button"
            onClick={() => onOpenModal('slots_list')}
            className="mf-btn-outline-3d flex min-h-[46px] items-center justify-center px-4 py-2.5 text-xs font-extrabold whitespace-nowrap"
          >
            View All Slots
          </button>
        </div>
      </section>

      {/* BONUS TASKS Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-[#111827]">
            BONUS TASKS
          </h2>
          <span className="text-xs font-bold text-[#00944A] tabular-nums">
            {availableTasksCount} Available
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {visibleTasks.map((task) => {
            const displayBadge =
              task.createdBy === 'user'
                ? task.badge || 'Community'
                : normalizeTaskType(task.taskType, task.badge);
            const isDone = task.completed || isTaskCompletedForUser(task, state);
            return (
              <article
                key={task.id}
                className="mf-card-3d flex items-center justify-between gap-3 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="mf-icon-circle flex h-11 w-11 shrink-0 items-center justify-center">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-display text-sm font-extrabold text-[#111827]">
                        {task.title}
                      </h3>
                      <span className="shrink-0 rounded-md bg-[#00944A]/10 px-2 py-0.5 text-[10px] font-extrabold text-[#00944A]">
                        {displayBadge}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-xs font-bold text-[#00944A] tabular-nums">
                      +{task.rewardUsdt.toFixed(2)} USDT
                    </p>
                  </div>
                </div>

                {isDone ? (
                  <span className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-[20px] bg-emerald-50 px-3.5 py-2 text-xs font-extrabold text-[#00944A]">
                    <span>Completed ✅</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCompleteBonusTask(task)}
                    className="mf-btn-outline-3d min-h-[42px] shrink-0 px-4 py-2 text-xs font-extrabold"
                  >
                    VERIFY
                  </button>
                )}
              </article>
            );
          })}

          {/* Add Your Task Card: Dashed border 3D style */}
          <button
            type="button"
            onClick={() => onOpenModal('add_task')}
            className="mf-btn-3d flex min-h-[82px] items-center justify-center gap-3 !border-2 !border-dashed !border-[#00944A]/45 p-4 text-center"
          >
            <span className="mf-icon-circle flex h-10 w-10 items-center justify-center">
              <PlusCircle className="h-5 w-5" />
            </span>
            <div className="text-left">
              <p className="font-display text-sm font-extrabold text-[#111827]">
                Add Your Task
              </p>
              <p className="text-xs font-medium text-slate-500">
                Promote your Telegram channel or app for USDT rewards
              </p>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};
