// Electron's ipcRenderer.invoke always wraps a handler's thrown error as
// "Error invoking remote method '<channel>': Error: <message>" — strip that
// wrapping so the UI shows the backend's actual error text.
export function cleanIpcErrorMessage(message: string): string {
  return message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');
}
