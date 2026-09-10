import { useCallback, useEffect, useMemo, useState } from 'react';
import { eachDayOfInterval, format, isSameDay } from 'date-fns';
import { useAuth } from '../../AuthContext';
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover';
import { cn } from '../../lib/utils';
import type { BookingListItem } from '../../../preload';

export function CalendarPage() {
  const { session } = useAuth();
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchCalendar = useCallback(async () => {
    if (!session) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await window.bookingsAPI.calendar(session.accessToken);
      setBookings(result.bookings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load calendar.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // A full month-view grid: the current month plus the leading/trailing days from the
  // adjacent months needed to complete full (Sunday-start) weeks at both ends. Mirrors
  // the backend's getBookingCalendarWindow exactly, using the same plain local-Date
  // arithmetic (not UTC) to stay consistent with the rest of this app's date handling.
  const days = useMemo(() => {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    const gridEnd = new Date(monthEnd);
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [today]);

  const weeks = useMemo(() => {
    const chunks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      chunks.push(days.slice(i, i + 7));
    }
    return chunks;
  }, [days]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, BookingListItem[]>();
    for (const booking of bookings) {
      const key = format(new Date(booking.startDate), 'yyyy-MM-dd');
      map.set(key, [...(map.get(key) ?? []), booking]);
    }
    return map;
  }, [bookings]);

  return (
    <div className="relative h-full overflow-hidden">
      <div className="box-border h-full overflow-y-auto p-8">
        <div className="screen-header">
          <h1 className="screen-title">Calendar</h1>
        </div>

        {error && <p className="status-message status-message-error">{error}</p>}
        {!error && loading && <p className="status-message">Loading calendar…</p>}

        {!error && !loading && (
          <div className="table-container">
            <div className="flex flex-col gap-5">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-2">
                  <p className="m-0 px-1 text-sm font-bold text-heading">
                    {Array.from(new Set(week.map((day) => format(day, 'MMMM')))).join(' / ')}
                  </p>
                  <div className="grid grid-cols-7 gap-3">
                    {week.map((day) => {
                      const key = format(day, 'yyyy-MM-dd');
                      const dayBookings = bookingsByDay.get(key) ?? [];
                      const hasBookings = dayBookings.length > 0;
                      const isToday = isSameDay(day, today);
                      const isCurrentMonth =
                        day.getMonth() === today.getMonth() && day.getFullYear() === today.getFullYear();
                      const isPast = day < today;

                      const cell = (
                        <div
                          className={cn(
                            'flex flex-col items-center justify-center gap-1.5 rounded-xl py-5 text-base',
                            !isCurrentMonth && 'opacity-40',
                            isCurrentMonth && isPast && !isToday && 'opacity-70',
                            isToday && 'ring-2 ring-accent-end',
                            hasBookings && 'cursor-pointer hover:bg-sidebar-hover',
                          )}
                        >
                          <span
                            className={cn(
                              'text-xl font-semibold',
                              isCurrentMonth && !isPast ? 'text-heading' : 'text-muted',
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          <span className="text-xs text-muted">{format(day, 'EEE')}</span>
                          <span
                            className={cn('h-2 w-2 rounded-full', hasBookings ? 'bg-accent-end' : 'bg-transparent')}
                          />
                        </div>
                      );

                      if (!hasBookings) {
                        return <div key={key}>{cell}</div>;
                      }

                      return (
                        <Popover key={key}>
                          <PopoverTrigger asChild>{cell}</PopoverTrigger>
                          <PopoverContent className="w-80">
                            <p className="px-2 pb-1 text-xs font-semibold text-muted">{format(day, 'PPP')}</p>
                            <div className="flex flex-col gap-2">
                              {dayBookings.map((booking) => (
                                <div
                                  key={booking.id}
                                  className="flex flex-col gap-1 rounded-lg p-2 hover:bg-sidebar-hover"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-heading">{booking.reference}</span>
                                    <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                                      {booking.status}
                                    </span>
                                  </div>
                                  <span className="text-xs text-secondary">
                                    {booking.tour.title} · {booking.customer.name}
                                  </span>
                                  <span className={`payment-badge payment-${booking.paymentStatus.toLowerCase()}`}>
                                    {booking.paymentStatus}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
