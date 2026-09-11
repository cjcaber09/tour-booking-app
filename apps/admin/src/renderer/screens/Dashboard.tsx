import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useAppSettings } from '../AppSettingsContext';
import { stats, revenueThisMonth, bookingsTrend } from './mockAnalytics';
import type { BookingListItem } from '../../preload';

const UPCOMING_WINDOW_DAYS = 2;
const RECENT_BOOKINGS_LIMIT = 5;

export function Dashboard() {
  const { session } = useAuth();
  const { formatCurrency, formatDate } = useAppSettings();
  const maxBookings = Math.max(...bookingsTrend.map((point) => point.bookings));
  const statCards = [
    stats[0],
    { label: 'Revenue (This Month)', value: formatCurrency(revenueThisMonth) },
    ...stats.slice(1),
  ];

  const [recentBookings, setRecentBookings] = useState<BookingListItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentError, setRecentError] = useState('');

  const [upcomingBookings, setUpcomingBookings] = useState<BookingListItem[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [upcomingError, setUpcomingError] = useState('');

  const fetchRecentBookings = useCallback(async () => {
    if (!session) {
      return;
    }
    setLoadingRecent(true);
    setRecentError('');
    try {
      const result = await window.bookingsAPI.list(1, 50, {}, session.accessToken);
      const sorted = [...result.bookings].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setRecentBookings(sorted.slice(0, RECENT_BOOKINGS_LIMIT));
    } catch (err) {
      setRecentError(err instanceof Error ? err.message : 'Could not load recent bookings.');
    } finally {
      setLoadingRecent(false);
    }
  }, [session]);

  const fetchUpcomingBookings = useCallback(async () => {
    if (!session) {
      return;
    }
    setLoadingUpcoming(true);
    setUpcomingError('');
    try {
      const result = await window.bookingsAPI.list(
        1,
        100,
        { status: 'CONFIRMED', paymentStatus: 'PAID' },
        session.accessToken,
      );
      const now = Date.now();
      const windowEnd = now + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const upcoming = result.bookings
        .filter((booking) => {
          const start = new Date(booking.startDate).getTime();
          return start >= now && start <= windowEnd;
        })
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      setUpcomingBookings(upcoming);
    } catch (err) {
      setUpcomingError(err instanceof Error ? err.message : 'Could not load upcoming bookings.');
    } finally {
      setLoadingUpcoming(false);
    }
  }, [session]);

  useEffect(() => {
    fetchRecentBookings();
    fetchUpcomingBookings();
  }, [fetchRecentBookings, fetchUpcomingBookings]);

  return (
    <div className="box-border p-8">
      <section className="mb-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div className="flex flex-col gap-2 rounded-[20px] bg-surface p-6 neu-raised-lg" key={stat.label}>
            <span className="font-display text-4xl tracking-[0.03em] text-stat">{stat.value}</span>
            <span className="text-sm text-muted">{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="mb-8 rounded-[20px] bg-surface p-6 neu-raised-lg">
        <h2 className="m-0 mb-4 font-display text-xl tracking-[0.03em] text-heading">Bookings — last 7 days</h2>
        <div className="flex h-40 items-end gap-4">
          {bookingsTrend.map((point) => (
            <div className="flex h-full flex-1 flex-col items-center justify-end" key={point.day}>
              <div
                className="min-h-1 w-full rounded-t-lg bg-gradient-to-b from-accent-start to-accent-end"
                style={{ height: `${(point.bookings / maxBookings) * 100}%` }}
              />
              <span className="mt-2 text-xs text-muted">{point.day}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 table-container">
        <h2 className="m-0 mb-4 font-display text-xl tracking-[0.03em] text-heading">
          Upcoming bookings (next {UPCOMING_WINDOW_DAYS} days)
        </h2>
        {upcomingError && <p className="status-message status-message-error">{upcomingError}</p>}
        {!upcomingError && loadingUpcoming && upcomingBookings.length === 0 && (
          <p className="status-message">Loading…</p>
        )}
        {!upcomingError && !loadingUpcoming && upcomingBookings.length === 0 && (
          <p className="status-message">No confirmed & paid bookings starting in the next {UPCOMING_WINDOW_DAYS} days.</p>
        )}
        {!upcomingError && upcomingBookings.length > 0 && (
          <table className="w-full border-collapse text-sm text-heading">
            <thead>
              <tr>
                <th className="border-b border-border px-3 py-2 text-left font-semibold text-muted">Customer</th>
                <th className="border-b border-border px-3 py-2 text-left font-semibold text-muted">Tour</th>
                <th className="border-b border-border px-3 py-2 text-left font-semibold text-muted">Starts</th>
                <th className="border-b border-border px-3 py-2 text-left font-semibold text-muted">Participants</th>
              </tr>
            </thead>
            <tbody>
              {upcomingBookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="border-b border-border-strong p-3">{booking.customer.name}</td>
                  <td className="border-b border-border-strong p-3">{booking.tour.title}</td>
                  <td className="border-b border-border-strong p-3">{formatDate(booking.startDate)}</td>
                  <td className="border-b border-border-strong p-3">{booking.participants}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-8 table-container">
        <h2 className="m-0 mb-4 font-display text-xl tracking-[0.03em] text-heading">Recent bookings</h2>
        {recentError && <p className="status-message status-message-error">{recentError}</p>}
        {!recentError && loadingRecent && recentBookings.length === 0 && <p className="status-message">Loading…</p>}
        {!recentError && !loadingRecent && recentBookings.length === 0 && (
          <p className="status-message">No bookings yet.</p>
        )}
        {!recentError && recentBookings.length > 0 && (
          <table className="w-full border-collapse text-sm text-heading">
            <thead>
              <tr>
                <th className="border-b border-border px-3 py-2 text-left font-semibold text-muted">Customer</th>
                <th className="border-b border-border px-3 py-2 text-left font-semibold text-muted">Tour</th>
                <th className="border-b border-border px-3 py-2 text-left font-semibold text-muted">Date</th>
                <th className="border-b border-border px-3 py-2 text-left font-semibold text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="border-b border-border-strong p-3">{booking.customer.name}</td>
                  <td className="border-b border-border-strong p-3">{booking.tour.title}</td>
                  <td className="border-b border-border-strong p-3">{formatDate(booking.startDate)}</td>
                  <td className="border-b border-border-strong p-3">
                    <span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
