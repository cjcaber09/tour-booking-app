export interface StatCard {
  label: string;
  value: string;
}

export const stats: StatCard[] = [
  { label: 'Total Bookings', value: '1,284' },
  { label: 'Upcoming Tours', value: '12' },
  { label: 'Cancellations', value: '7' },
];

export const revenueThisMonth = 48200;

export interface TrendPoint {
  day: string;
  bookings: number;
}

export const bookingsTrend: TrendPoint[] = [
  { day: 'Mon', bookings: 14 },
  { day: 'Tue', bookings: 22 },
  { day: 'Wed', bookings: 18 },
  { day: 'Thu', bookings: 30 },
  { day: 'Fri', bookings: 26 },
  { day: 'Sat', bookings: 34 },
  { day: 'Sun', bookings: 20 },
];

export type BookingStatus = 'Confirmed' | 'Pending' | 'Cancelled';

export interface RecentBooking {
  customer: string;
  tour: string;
  date: string;
  status: BookingStatus;
}

export const recentBookings: RecentBooking[] = [
  { customer: 'Jane Cooper', tour: 'Sunset Harbor Cruise', date: '2026-09-02', status: 'Confirmed' },
  { customer: 'Marcus Lee', tour: 'Old Town Walking Tour', date: '2026-09-03', status: 'Confirmed' },
  { customer: 'Priya Natarajan', tour: 'Whale Watching Excursion', date: '2026-09-04', status: 'Pending' },
  { customer: 'Diego Ramirez', tour: 'Sunset Harbor Cruise', date: '2026-09-05', status: 'Confirmed' },
  { customer: 'Alicia Novak', tour: 'Mountain Vista Hike', date: '2026-09-06', status: 'Cancelled' },
];
