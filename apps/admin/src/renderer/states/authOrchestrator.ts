// Subscribes to authStore's login/logout transitions and reacts in the other stores.
// This lives here (rather than inside authStore.ts calling the other stores directly)
// specifically to avoid a circular import: appSettingsStore.ts (and, once they land,
// the per-entity list stores) already need to import authStore.ts to read the access
// token, so authStore.ts reaching back into them would create a cycle. This file is
// the one place that imports everyone, and nothing imports it back.
//
// Imported once, as a side effect, from the top of App.tsx.
import { useAuthStore } from './authStore';
import { useAppSettingsStore } from './appSettingsStore';
import { useBookingsListStore } from './bookingsListStore';
import { useToursListStore } from './toursListStore';
import { useCustomersListStore } from './customersListStore';
import { useUsersListStore } from './usersListStore';

let wasAuthenticated = false;

useAuthStore.subscribe((state) => {
  const isAuthenticated = state.status === 'authenticated';
  if (!wasAuthenticated && isAuthenticated) {
    useAppSettingsStore.getState().refresh();
  } else if (wasAuthenticated && !isAuthenticated) {
    useAppSettingsStore.getState().reset();
    useBookingsListStore.getState().reset();
    useToursListStore.getState().reset();
    useCustomersListStore.getState().reset();
    useUsersListStore.getState().reset();
  }
  wasAuthenticated = isAuthenticated;
});
