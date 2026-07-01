import * as React from 'react';
import { cn } from '../../lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  indicatorClassName?: string;
}

function Progress({ className, value = 0, indicatorClassName, ...props }: ProgressProps) {
  return (
    <div
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20', className)}
      {...props}
    >
      <div
        className={cn('h-full bg-primary transition-all duration-300', indicatorClassName)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export { Progress };
