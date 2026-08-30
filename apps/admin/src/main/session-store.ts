import { app, safeStorage } from 'electron';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

function sessionFilePath(): string {
  return join(app.getPath('userData'), 'session.bin');
}

export function saveRefreshToken(token: string): void {
  writeFileSync(sessionFilePath(), safeStorage.encryptString(token));
}

export function loadRefreshToken(): string | null {
  const path = sessionFilePath();
  if (!existsSync(path)) {
    return null;
  }
  return safeStorage.decryptString(readFileSync(path));
}

export function clearRefreshToken(): void {
  const path = sessionFilePath();
  if (existsSync(path)) {
    unlinkSync(path);
  }
}
