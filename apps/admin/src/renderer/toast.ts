// Thin re-export so the ~15 existing call sites (`import { toast } from '../../toast'`)
// don't need to change — the actual store now lives in states/toastStore.ts.
export { toast } from './states/toastStore';
