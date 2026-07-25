import { FileX, LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon = FileX, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-surface rounded-2xl border border-border/60 border-dashed">
      <div className="w-16 h-16 rounded-2xl bg-background flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-text-secondary" />
      </div>
      <h3 className="font-heading font-semibold text-lg">{title}</h3>
      {description && <p className="text-sm text-text-secondary mt-2 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button className="mt-6" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
