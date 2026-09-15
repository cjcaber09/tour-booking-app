import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, parse } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Calendar } from '../../components/ui/calendar';

export const DATE_FORMAT = 'yyyy-MM-dd';

export function parseFormDate(value: string): Date {
  return parse(value, DATE_FORMAT, new Date());
}

interface BookingDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function BookingDateField({ value, onChange, error }: BookingDateFieldProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <label className="form-field">
      <span>Booking Date</span>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="neu-field flex items-center justify-between text-left">
            <span className={value ? '' : 'text-muted'}>
              {value ? format(parseFormDate(value), 'PPP') : 'Select a date'}
            </span>
            <CalendarIcon className="h-4 w-4 shrink-0 text-secondary" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={value ? parseFormDate(value) : undefined}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, DATE_FORMAT));
                setIsOpen(false);
              }
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {error && <p className="form-field-error">{error}</p>}
    </label>
  );
}
