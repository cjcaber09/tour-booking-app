import type { ComponentType } from 'react';
import { EllipsisVertical, type LucideProps } from 'lucide-react';
import { cn } from './lib/utils';
import { Button } from './components/ui/button';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from './components/ui/popover';

export interface RowAction {
  key: string;
  label: string;
  Icon: ComponentType<LucideProps>;
  onClick: () => void;
  danger?: boolean;
}

interface RowActionsMenuProps {
  primary?: RowAction | null;
  overflow: RowAction[];
  disabled?: boolean;
  ariaLabel: string;
  menuClassName?: string;
}

export function RowActionsMenu({
  primary,
  overflow,
  disabled,
  ariaLabel,
  menuClassName = 'w-44 p-1',
}: RowActionsMenuProps) {
  return (
    <div className="row-actions justify-end">
      {primary && (
        <Button size="sm" className="action-button" onClick={primary.onClick} disabled={disabled}>
          <primary.Icon size={14} />
          {primary.label}
        </Button>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" disabled={disabled} aria-label={ariaLabel}>
            <EllipsisVertical size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className={menuClassName}>
          <div role="menu" className="flex flex-col">
            {overflow.map((action) => (
              <PopoverClose key={action.key} asChild>
                <button
                  type="button"
                  role="menuitem"
                  disabled={disabled}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-heading hover:bg-sidebar-hover disabled:cursor-not-allowed disabled:opacity-60',
                    action.danger && 'text-error',
                  )}
                  onClick={action.onClick}
                >
                  <action.Icon size={14} />
                  {action.label}
                </button>
              </PopoverClose>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
