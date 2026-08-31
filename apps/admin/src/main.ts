import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { saveRefreshToken, loadRefreshToken, clearRefreshToken } from './main/session-store';
import { backendLogin, backendRefresh, backendLogout, backendMe, backendCreateTour } from './main/backend-client';

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

ipcMain.handle('tours:create', async (_event, payload, accessToken) => {
  try {
    return await backendCreateTour(payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'create failed');
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
