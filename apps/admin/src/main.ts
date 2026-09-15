import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { saveRefreshToken, loadRefreshToken, clearRefreshToken } from './main/session-store';
import {
  backendLogin,
  backendRefresh,
  backendLogout,
  backendRequestRecovery,
  backendMe,
  backendCreateTour,
  backendGetTour,
  backendUpdateTour,
  backendDeleteTour,
  backendUploadImage,
  backendUploadImages,
  backendListTours,
  backendListBookings,
  backendGetBookingsCalendar,
  backendGetBookingsStats,
  backendGetBooking,
  backendCreateBooking,
  backendUpdateBooking,
  backendConfirmBooking,
  backendMarkBookingOngoing,
  backendCancelBooking,
  backendRecordPayment,
  backendUploadPaymentProof,
  backendSearchCustomers,
  backendListCustomers,
  backendGetCustomer,
  backendCreateCustomer,
  backendUpdateCustomer,
  backendDeleteCustomer,
  backendListCategories,
  backendCreateCategory,
  backendUpdateCategory,
  backendDeleteCategory,
  backendListAudit,
  backendGetSettings,
  backendUpdateSettings,
  backendUploadLogo,
  backendUpdateProfile,
  backendUploadAvatar,
  backendChangePassword,
  backendListAdmins,
  backendListAssignableGuides,
  backendCreateAdmin,
  backendUpdateAdmin,
  backendDeleteAdmin,
  backendResetAdminPassword,
  backendCountAdminRecoveryRequests,
} from './main/backend-client';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Without this, target="_blank" links (e.g. a payment-proof "View proof" link)
  // silently no-op instead of opening in the OS's default browser. Restricted to
  // http(s) so a malicious or malformed URL can't reach shell.openExternal with a
  // scheme (file:, custom protocol handlers, etc.) that could trigger unintended
  // OS-level behavior.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { action: 'deny' };
    }
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
};

ipcMain.handle('auth:login', async (_event, email: string, password: string) => {
  try {
    const { accessToken, refreshToken } = await backendLogin(email, password);
    saveRefreshToken(refreshToken);
    const admin = await backendMe(accessToken);
    return { accessToken, admin };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'login failed');
  }
});

ipcMain.handle('auth:getSession', async () => {
  const refreshToken = loadRefreshToken();
  if (!refreshToken) {
    return null;
  }
  try {
    const { accessToken } = await backendRefresh(refreshToken);
    const admin = await backendMe(accessToken);
    return { accessToken, admin };
  } catch {
    clearRefreshToken();
    return null;
  }
});

ipcMain.handle('auth:logout', async () => {
  const refreshToken = loadRefreshToken();
  if (refreshToken) {
    await backendLogout(refreshToken);
  }
  clearRefreshToken();
});

ipcMain.handle('auth:request-recovery', async (_event, email: string) => {
  await backendRequestRecovery(email);
});

ipcMain.handle('tours:create', async (_event, payload, accessToken) => {
  try {
    return await backendCreateTour(payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'create failed');
  }
});

ipcMain.handle('tours:upload-image', async (_event, fileBase64, filename, mimetype, accessToken) => {
  try {
    return await backendUploadImage(fileBase64, filename, mimetype, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'upload failed');
  }
});

ipcMain.handle(
  'tours:upload-images',
  async (_event, files: { data: string; filename: string; mimetype: string }[], accessToken: string) => {
    try {
      return await backendUploadImages(files, accessToken);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'upload failed');
    }
  },
);

ipcMain.handle('tours:get', async (_event, id: string, accessToken: string) => {
  try {
    return await backendGetTour(id, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'get failed');
  }
});

ipcMain.handle('tours:update', async (_event, id: string, payload, accessToken: string) => {
  try {
    return await backendUpdateTour(id, payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'update failed');
  }
});

ipcMain.handle('tours:delete', async (_event, id: string, accessToken: string) => {
  try {
    return await backendDeleteTour(id, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'delete failed');
  }
});

ipcMain.handle('tours:list', async (_event, page, limit, filters, accessToken: string) => {
  try {
    return await backendListTours(page, limit, filters, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'list failed');
  }
});

ipcMain.handle('bookings:list', async (_event, page, limit, filters, accessToken) => {
  try {
    return await backendListBookings(page, limit, filters, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'list failed');
  }
});

ipcMain.handle('bookings:calendar', async (_event, accessToken: string) => {
  try {
    return await backendGetBookingsCalendar(accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'calendar failed');
  }
});

ipcMain.handle('bookings:stats', async (_event, accessToken: string) => {
  try {
    return await backendGetBookingsStats(accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'stats failed');
  }
});

ipcMain.handle('bookings:get', async (_event, id: string, accessToken: string) => {
  try {
    return await backendGetBooking(id, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'get failed');
  }
});

ipcMain.handle('bookings:create', async (_event, payload, accessToken) => {
  try {
    return await backendCreateBooking(payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'create failed');
  }
});

ipcMain.handle('bookings:update', async (_event, id: string, payload, accessToken: string) => {
  try {
    return await backendUpdateBooking(id, payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'update failed');
  }
});

ipcMain.handle('bookings:confirm', async (_event, id: string, accessToken: string) => {
  try {
    return await backendConfirmBooking(id, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'confirm failed');
  }
});

ipcMain.handle('bookings:ongoing', async (_event, id: string, accessToken: string) => {
  try {
    return await backendMarkBookingOngoing(id, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'ongoing failed');
  }
});

ipcMain.handle('bookings:cancel', async (_event, id: string, payload, accessToken: string) => {
  try {
    return await backendCancelBooking(id, payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'cancel failed');
  }
});

ipcMain.handle('bookings:record-payment', async (_event, id: string, payload, accessToken: string) => {
  try {
    return await backendRecordPayment(id, payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'record payment failed');
  }
});

ipcMain.handle(
  'bookings:upload-payment-proof',
  async (_event, id: string, fileBase64: string, filename: string, mimetype: string, accessToken: string) => {
    try {
      return await backendUploadPaymentProof(id, fileBase64, filename, mimetype, accessToken);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'upload failed');
    }
  },
);

ipcMain.handle('customers:search', async (_event, q: string, accessToken: string) => {
  try {
    return await backendSearchCustomers(q, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'search failed');
  }
});

ipcMain.handle('customers:list', async (_event, page: number, limit: number, q: string, accessToken: string) => {
  try {
    return await backendListCustomers(page, limit, q, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'list failed');
  }
});

ipcMain.handle('customers:get', async (_event, id: string, accessToken: string) => {
  try {
    return await backendGetCustomer(id, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'get failed');
  }
});

ipcMain.handle('customers:create', async (_event, payload, accessToken: string) => {
  try {
    return await backendCreateCustomer(payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'create failed');
  }
});

ipcMain.handle('customers:update', async (_event, id: string, payload, accessToken: string) => {
  try {
    return await backendUpdateCustomer(id, payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'update failed');
  }
});

ipcMain.handle('customers:delete', async (_event, id: string, accessToken: string) => {
  try {
    return await backendDeleteCustomer(id, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'delete failed');
  }
});

ipcMain.handle('categories:list', async (_event, page: number, limit: number, accessToken: string) => {
  try {
    return await backendListCategories(page, limit, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'list failed');
  }
});

ipcMain.handle('categories:create', async (_event, payload, accessToken: string) => {
  try {
    return await backendCreateCategory(payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'create failed');
  }
});

ipcMain.handle('categories:update', async (_event, id: string, payload, accessToken: string) => {
  try {
    return await backendUpdateCategory(id, payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'update failed');
  }
});

ipcMain.handle('categories:delete', async (_event, id: string, accessToken: string) => {
  try {
    return await backendDeleteCategory(id, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'delete failed');
  }
});

ipcMain.handle('audit:list', async (_event, accessToken: string) => {
  try {
    return await backendListAudit(accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'list failed');
  }
});

ipcMain.handle('settings:get', async (_event, accessToken: string) => {
  try {
    return await backendGetSettings(accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'get failed');
  }
});

ipcMain.handle('settings:update', async (_event, payload, accessToken: string) => {
  try {
    return await backendUpdateSettings(payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'update failed');
  }
});

ipcMain.handle('settings:upload-logo', async (_event, fileBase64, filename, mimetype, accessToken) => {
  try {
    return await backendUploadLogo(fileBase64, filename, mimetype, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'upload failed');
  }
});

ipcMain.handle('profile:update', async (_event, payload, accessToken: string) => {
  try {
    return await backendUpdateProfile(payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'update failed');
  }
});

ipcMain.handle('profile:upload-avatar', async (_event, fileBase64, filename, mimetype, accessToken) => {
  try {
    return await backendUploadAvatar(fileBase64, filename, mimetype, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'upload failed');
  }
});

ipcMain.handle('profile:change-password', async (_event, payload, accessToken: string) => {
  try {
    return await backendChangePassword(payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'change password failed');
  }
});

ipcMain.handle('admins:list', async (_event, page, limit, filters, accessToken: string) => {
  try {
    return await backendListAdmins(page, limit, filters, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'list failed');
  }
});

ipcMain.handle('admins:list-assignable-guides', async (_event, accessToken: string) => {
  try {
    return await backendListAssignableGuides(accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'list failed');
  }
});

ipcMain.handle('admins:create', async (_event, payload, accessToken: string) => {
  try {
    return await backendCreateAdmin(payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'create failed');
  }
});

ipcMain.handle('admins:update', async (_event, id: string, payload, accessToken: string) => {
  try {
    return await backendUpdateAdmin(id, payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'update failed');
  }
});

ipcMain.handle('admins:delete', async (_event, id: string, accessToken: string) => {
  try {
    return await backendDeleteAdmin(id, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'delete failed');
  }
});

ipcMain.handle('admins:reset-password', async (_event, id: string, accessToken: string) => {
  try {
    return await backendResetAdminPassword(id, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'reset password failed');
  }
});

ipcMain.handle('admins:count-recovery-requests', async (_event, accessToken: string) => {
  try {
    return await backendCountAdminRecoveryRequests(accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'count failed');
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
