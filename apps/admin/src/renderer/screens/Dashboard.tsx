import { stats, bookingsTrend, recentBookings } from './mockAnalytics';

export function Dashboard() {
  const maxBookings = Math.max(...bookingsTrend.map((point) => point.bookings));

  return (
    <div className="box-border p-8">
      <section className="mb-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {stats.map((stat) => (
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
        <h2 className="m-0 mb-4 font-display text-xl tracking-[0.03em] text-heading">Recent bookings</h2>
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
              <tr key={`${booking.customer}-${booking.date}`}>
                <td className="border-b border-border-strong p-3">{booking.customer}</td>
                <td className="border-b border-border-strong p-3">{booking.tour}</td>
                <td className="border-b border-border-strong p-3">{booking.date}</td>
                <td className="border-b border-border-strong p-3">
                  <span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
