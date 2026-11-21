'use client';

import React from 'react';

interface ScoreGaugeProps {
  score: number; // 0 - 100
  label?: string;
  size?: number;
  strokeWidth?: number;
  previousScore?: number | null;
}

export function ScoreGauge({
  score,
  label = 'AI Probability',
  size = 130,
  strokeWidth = 10,
  previousScore = null,
}: ScoreGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  // Determine color based on score
  // 0 - 29: Emerald (Human)
  // 30 - 69: Amber (Mixed)
  // 70 - 100: Rose (AI)
  let strokeColor = '#10b981'; // emerald-500
  let textColor = 'text-emerald-600 dark:text-emerald-400';
  let ratingText = 'Likely Human';

  if (clampedScore >= 70) {
    strokeColor = '#f43f5e'; // rose-500
    textColor = 'text-rose-600 dark:text-rose-400';
    ratingText = 'Likely AI';
  } else if (clampedScore >= 30) {
    strokeColor = '#f59e0b'; // amber-500
    textColor = 'text-amber-600 dark:text-amber-400';
    ratingText = 'Mixed / Ambiguous';
  }

  return (
    <div className="flex flex-col items-center justify-center p-3 select-none">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-200 dark:text-slate-800"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center score readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`text-3xl font-bold tracking-tight font-mono ${textColor}`}>
            {clampedScore}%
          </span>
          {previousScore !== null && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              was {previousScore}%
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          {label}
        </span>
        <p className={`text-xs font-medium mt-0.5 ${textColor}`}>{ratingText}</p>
      </div>
    </div>
  );
}
