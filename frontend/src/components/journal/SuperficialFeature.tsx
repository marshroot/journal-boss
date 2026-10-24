import { ReactNode } from 'react';
import { Construction, Sparkles } from 'lucide-react';

interface SuperficialFeatureProps {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  children?: ReactNode;
}

/**
 * Displays a feature in a "superficial" (in-development) state.
 *
 * Regular journal functions (grades, homework, schedule, attendance,
 * leaderboard, awards, profile) remain fully functional for every student.
 * Mod-specific features (Code Lab, Image Editor, Messages, Lesson Board,
 * Lesson Chat) are shown in this superficial state so the student sees the
 * full journal menu but the new functions are clearly marked as upcoming.
 */
export default function SuperficialFeature({
  title,
  description = 'Этот раздел является новой функцией мода и пока доступен в демонстрационном режиме. Основные функции студенческого журнала работают в штатном режиме.',
  eyebrow = 'Новая функция',
  icon,
  children,
}: SuperficialFeatureProps) {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-start gap-4">
        <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-300">
          {icon ?? <Construction size={20} />}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[.22em] text-amber-300/70">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">{description}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.04] p-6">
        <div className="flex items-start gap-3">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <div className="text-sm leading-6 text-white/60">
            <p className="font-medium text-amber-200/90">Раздел в разработке</p>
            <p className="mt-1">
              Базовые функции студенческого журнала (оценки, домашние задания, расписание, посещаемость, рейтинг и награды)
              работают в полном объёме. Дополнительные возможности мода появятся позже.
            </p>
          </div>
        </div>
      </div>

      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}