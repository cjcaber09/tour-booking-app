import type { ComponentProps } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import { cn } from '../../lib/utils';

export type CalendarProps = ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-1', className)}
      classNames={{
        root: cn(defaultClassNames.root, 'font-body'),
        months: cn(defaultClassNames.months, 'flex flex-col gap-2'),
        month: cn(defaultClassNames.month, 'flex flex-col gap-2'),
        month_caption: cn(defaultClassNames.month_caption, 'flex items-center justify-center px-8 py-1'),
        caption_label: cn(defaultClassNames.caption_label, 'text-sm font-semibold text-heading'),
        nav: cn(defaultClassNames.nav, 'flex items-center justify-between absolute inset-x-1 top-1'),
        button_previous: cn(
          defaultClassNames.button_previous,
          'flex h-7 w-7 items-center justify-center rounded-lg text-secondary hover:bg-sidebar-hover disabled:opacity-40',
        ),
        button_next: cn(
          defaultClassNames.button_next,
          'flex h-7 w-7 items-center justify-center rounded-lg text-secondary hover:bg-sidebar-hover disabled:opacity-40',
        ),
        month_grid: cn(defaultClassNames.month_grid, 'w-full border-collapse'),
        weekdays: cn(defaultClassNames.weekdays, 'flex'),
        weekday: cn(defaultClassNames.weekday, 'w-9 text-xs font-semibold text-muted'),
        week: cn(defaultClassNames.week, 'flex w-full mt-1'),
        day: cn(defaultClassNames.day, 'h-9 w-9 p-0 text-center text-sm'),
        day_button: cn(
          defaultClassNames.day_button,
          'h-9 w-9 rounded-lg text-heading hover:bg-sidebar-hover aria-selected:bg-accent-end aria-selected:text-white aria-selected:hover:bg-accent-end',
        ),
        today: cn(defaultClassNames.today, '[&>button]:font-bold [&>button]:text-accent-end'),
        outside: cn(defaultClassNames.outside, 'text-muted opacity-50'),
        disabled: cn(defaultClassNames.disabled, 'text-muted opacity-30'),
        hidden: cn(defaultClassNames.hidden, 'invisible'),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
