import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { motion } from "motion/react";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  accent?: boolean;
  className?: string;
  delay?: number;
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  accent,
  className,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className={cn("relative overflow-hidden", className)}>
        {accent && (
          <span className="absolute left-0 top-0 h-px w-full bg-[linear-gradient(90deg,transparent,var(--accent-primary),transparent)] opacity-70" />
        )}
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="rk-kicker">{label}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="rk-metric-value">{value}</span>
            {unit && (
              <span className="font-mono text-[11px] uppercase text-[var(--text-tertiary)]">
                {unit}
              </span>
            )}
          </div>
          {hint && (
            <div className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
              {hint}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
