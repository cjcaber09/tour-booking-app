import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAppSettings } from '../../states/appSettingsStore';
import type { CustomerDetail } from '../../../preload';

interface CustomerViewProps {
  customer: CustomerDetail;
  onBack: () => void;
}

export function CustomerView({ customer, onBack }: CustomerViewProps) {
  const { formatDate, formatCurrency } = useAppSettings();

  return (
    <div className="detail-view">
      <Button className="action-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </Button>

      <h2 className="panel-title">{customer.name}</h2>

      <div className="detail-grid">
        <div className="detail-field">
          <span className="detail-label">Email</span>
          <span>{customer.email}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Phone</span>
          <span>{customer.phone ?? '—'}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Customer since</span>
          <span>{formatDate(customer.createdAt)}</span>
        </div>
      </div>

      <div className="detail-section">
        <span className="detail-label">Booking history</span>
        {customer.bookings.length === 0 ? (
          <p className="status-message m-0">No bookings yet.</p>
        ) : (
          <div className="table-container mt-2">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Tour</th>
                  <th>Start date</th>
                  <th>Status</th>
                  <th>Total price</th>
                </tr>
              </thead>
              <tbody>
                {customer.bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.reference}</td>
                    <td>{booking.tour.title}</td>
                    <td>{formatDate(booking.startDate)}</td>
                    <td>
                      <span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span>
                    </td>
                    <td>{formatCurrency(booking.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
