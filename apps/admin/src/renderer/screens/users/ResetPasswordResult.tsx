import { useState } from 'react';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from '../../toast';
import { useEscapeToClose } from '../../lib/useEscapeToClose';
import { Button } from '../../components/ui/button';
import type { CreateAdminResult } from '../../../preload';

interface ResetPasswordResultProps {
  result: CreateAdminResult;
  onClose: () => void;
}

export function ResetPasswordResult({ result, onClose }: ResetPasswordResultProps) {
  const [showPassword, setShowPassword] = useState(false);

  async function handleCopyPassword() {
    await navigator.clipboard.writeText(result.temporaryPassword);
    toast.success('Password copied to clipboard.');
  }

  useEscapeToClose(onClose);

  return (
    <div className="dialog-backdrop">
      <div className="dialog-backdrop-dismiss" aria-hidden="true" onClick={onClose} />
      <div className="dialog-card">
        <h3 className="dialog-title">Password reset</h3>
        <p className="dialog-message">
          Share this new password with {result.name} — it won't be shown again after you close this.
        </p>

        <div className="form-field mb-6">
          <span>New temporary password</span>
          <div className="relative">
            <input
              className="neu-field pr-20 font-mono tracking-wide"
              type={showPassword ? 'text' : 'password'}
              value={result.temporaryPassword}
              readOnly
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={handleCopyPassword} aria-label="Copy password">
                <Copy size={16} />
              </Button>
            </div>
          </div>
        </div>

        <div className="dialog-actions">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
