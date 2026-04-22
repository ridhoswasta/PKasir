import { invoke } from '@tauri-apps/api/core';

const SESSION_KEY = 'pos:auth_user';

export async function logActivity(action: string, target?: string, detail?: string) {
  try {
    let user: string | undefined;
    let role: string | undefined;
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        user = parsed.displayName;
        role = parsed.role;
      }
    } catch {}
    await invoke('log_activity', {
      input: { user, role, action, target, detail },
    });
  } catch {
    // never block the main operation
  }
}
