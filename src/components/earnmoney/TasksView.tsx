import React from 'react';
import { CheckCircle2, Flame, PlayCircle, PlusCircle, ShieldCheck } from 'lucide-react';
import type { BonusTaskItem, EarnMoneyState, ModalType } from '../../types/earnMoney';

interface TasksViewProps {
  state: EarnMoneyState;
  onOpenModal: (modal: ModalType) => void;
  onCompleteBonusTask: (task: BonusTaskItem) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  state,
  onOpenModal,
  onCompleteBonusTask,
}) => {
  const visibleTasks = state.bonusTasks.filter((t) => t.active !== false);
  const availableTasksCount = visibleTasks.filter((t) => !t.completed).length;
  const progressPct = Math.min(
    100,
    Math.round((state.dailyAdsCompleted / state.dailyAdsTotal) * 100)
  );

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
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-extrabold text-orange-600">
                  <Flame className="h-3 w-3" />
                  HOT
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500">
                Daily Limit: {state.dailyAdsCompleted}/{state.dailyAdsTotal} (Max $
                {state.dailyCeilingUsdt.toFixed(4)})
              </p>
            </div>
          </div>
          <span className="font-mono text-sm font-bold text-[#00944A] tabular-nums whitespace-nowrap">
            +0.0010 USDT
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
            onClick={() => onOpenModal('ad_watch')}
            className="mf-btn-green-3d flex min-h-[46px] items-center justify-center px-4 py-2.5 text-sm font-extrabold sm:col-span-2"
          >
            Verify to Start (Slot #{state.nextSlotNumber})
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
          {visibleTasks.map((task) => (
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
                    <span className="rounded-md bg-[#00944A]/10 px-2 py-0.5 text-[10px] font-extrabold text-[#00944A]">
                      {task.badge}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-xs font-bold text-[#00944A] tabular-nums">
                    +{task.rewardUsdt.toFixed(2)} USDT
                  </p>
                </div>
              </div>

              {task.completed ? (
                <span className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-[20px] bg-emerald-50 px-3.5 py-2 text-xs font-extrabold text-[#00944A]">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Done</span>
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
          ))}

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
