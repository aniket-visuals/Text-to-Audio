import React, { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content }) => {
  return (
    <div className="group relative flex">
      {children}
      <span className="absolute bottom-full left-1/2 mb-2 hidden w-auto -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:block group-hover:opacity-100 dark:bg-slate-200 dark:text-slate-900">
        {content}
      </span>
    </div>
  );
};