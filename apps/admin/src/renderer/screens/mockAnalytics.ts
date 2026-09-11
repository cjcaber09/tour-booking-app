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

