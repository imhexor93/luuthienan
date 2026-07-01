import React from 'react';
import { cn } from '../../lib/utils';
import type { Risk } from '@rd/shared';

interface RiskMatrixProps {
  risks: Risk[];
  onRiskClick?: (risk: Risk) => void;
}

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const LIKELIHOODS = ['certain', 'likely', 'possible', 'rare'] as const;

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Thấp', medium: 'TB', high: 'Cao', critical: 'Nghiêm trọng',
};
const LIKELIHOOD_LABELS: Record<string, string> = {
  rare: 'Hiếm', possible: 'Có thể', likely: 'Khả năng', certain: 'Chắc chắn',
};

function getCellColor(severity: string, likelihood: string): string {
  const sevScore = SEVERITIES.indexOf(severity as typeof SEVERITIES[number]);
  const likeScore = LIKELIHOODS.indexOf(likelihood as typeof LIKELIHOODS[number]);
  // likeScore is reversed (certain = 0, rare = 3)
  const likeReversed = 3 - likeScore;
  const score = (sevScore + 1) * (likeReversed + 1);

  if (score >= 12) return 'bg-red-100 dark:bg-red-900/30';
  if (score >= 6) return 'bg-orange-100 dark:bg-orange-900/30';
  if (score >= 3) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-green-100 dark:bg-green-900/30';
}

const RISK_DOT_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

export function RiskMatrix({ risks, onRiskClick }: RiskMatrixProps) {
  return (
    <div className="border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3">Ma trận rủi ro</h3>
      <div className="flex gap-2">
        {/* Y-axis label */}
        <div className="flex flex-col justify-center">
          <span
            className="text-xs text-muted-foreground -rotate-90 whitespace-nowrap"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Khả năng xảy ra →
          </span>
        </div>

        <div className="flex-1">
          {/* Matrix grid */}
          <div className="grid grid-cols-5 gap-1">
            {/* Y-axis labels + rows */}
            {LIKELIHOODS.map((likelihood) => (
              <React.Fragment key={likelihood}>
                {/* Row label */}
                <div className="flex items-center justify-end pr-2">
                  <span className="text-xs text-muted-foreground">{LIKELIHOOD_LABELS[likelihood]}</span>
                </div>

                {/* Cells */}
                {SEVERITIES.map((severity) => {
                  const cellRisks = risks.filter(
                    (r) => r.severity === severity && r.likelihood === likelihood
                  );

                  return (
                    <div
                      key={`${likelihood}-${severity}`}
                      className={cn(
                        'aspect-square rounded flex items-center justify-center flex-wrap gap-0.5 p-1 min-h-[48px]',
                        getCellColor(severity, likelihood)
                      )}
                    >
                      {cellRisks.map((risk) => (
                        <button
                          key={risk.id}
                          onClick={() => onRiskClick?.(risk)}
                          title={risk.title}
                          className="h-4 w-4 rounded-full border-2 border-white shadow-sm hover:scale-125 transition-transform"
                          style={{ backgroundColor: RISK_DOT_COLORS[risk.severity] }}
                        />
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}

            {/* X-axis labels */}
            <div />
            {SEVERITIES.map((sev) => (
              <div key={sev} className="text-center">
                <span className="text-xs text-muted-foreground">{SEVERITY_LABELS[sev]}</span>
              </div>
            ))}
          </div>

          {/* X-axis label */}
          <div className="text-center mt-1">
            <span className="text-xs text-muted-foreground">Mức độ nghiêm trọng →</span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-xs text-muted-foreground">Mức độ:</span>
            {Object.entries(RISK_DOT_COLORS).map(([key, color]) => (
              <div key={key} className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-muted-foreground">{SEVERITY_LABELS[key]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
