import * as React from 'react';
import { cn } from '../../lib/utils';

interface TabsContextValue {
  value: string;
  onChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue>({ value: '', onChange: () => {} });

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onChange: onValueChange }}>
      <div className={cn('flex flex-col', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex h-9 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground gap-1',
        className
      )}
      {...props}
    />
  );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

function TabsTrigger({ className, value, children, ...props }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext);
  const isActive = ctx.value === value;

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-background text-foreground shadow'
          : 'hover:bg-background/50 hover:text-foreground',
        className
      )}
      onClick={() => ctx.onChange(value)}
      {...props}
    >
      {children}
    </button>
  );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function TabsContent({ className, value, children, ...props }: TabsContentProps) {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return (
    <div className={cn('mt-4', className)} {...props}>
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
