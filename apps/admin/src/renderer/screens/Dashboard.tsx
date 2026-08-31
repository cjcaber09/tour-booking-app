import { useAuth } from '../AuthContext';
import { stats, bookingsTrend, recentBookings } from './mockAnalytics';
import './Dashboard.css';

export function Dashboard() {
  const { session, logout } = useAuth();
  const maxBookings = Math.max(...bookingsTrend.map((point) => point.bookings));

  return (
    <div className="dashboard">
      <header className="dashboard-topbar">
        <h1>Andy Tours Admin</h1>
        <div className="dashboard-topbar-actions">
          <span>{session?.admin.name}</span>
          <button className="neumorphic-button" onClick={() => logout()}>Sign out</button>
        </div>
      </header>

      <section className="dashboard-stats">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.label}>
            <span className="stat-value">{stat.value}</span>
            <span className="stat-label">{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="dashboard-trend">
        <h2>Bookings — last 7 days</h2>
        <div className="trend-chart">
          {bookingsTrend.map((point) => (
            <div className="trend-bar-column" key={point.day}>
              <div
                className="trend-bar"
                style={{ height: `${(point.bookings / maxBookings) * 100}%` }}
              />
              <span className="trend-bar-label">{point.day}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-recent">
        <h2>Recent bookings</h2>
        <table className="recent-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Tour</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentBookings.map((booking) => (
              <tr key={`${booking.customer}-${booking.date}`}>
                <td>{booking.customer}</td>
                <td>{booking.tour}</td>
                <td>{booking.date}</td>
                <td>
                  <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                    {booking.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
