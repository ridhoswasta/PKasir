import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Trash2, User as UserIcon } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useAuth } from '../services/auth';
import { logActivity } from '../services/activity';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_AVATAR_BYTES = 1_500_000; // ~1.5 MB pre-downscale budget

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open && user) {
      setDisplayName(user.displayName || '');
      setAvatar(user.avatar || null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open, user]);

  if (!user) return null;

  const initials = (user.displayName || user.username || 'U').charAt(0).toUpperCase();

  const roleLabel: Record<string, string> = {
    admin: 'Administrator',
    manager: 'Manager',
    cashier: 'Kasir',
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES * 6) {
      toast.error('Gambar terlalu besar (maks. ~9 MB sebelum diperkecil)');
      return;
    }
    try {
      const resized = await downscaleImage(file, 256);
      setAvatar(resized);
    } catch {
      toast.error('Gagal memproses gambar');
    }
  };

  const handleRemoveAvatar = () => setAvatar(null);

  const handleSave = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      toast.error('Nama tidak boleh kosong');
      return;
    }

    const wantsPasswordChange = !!(newPassword || confirmPassword || currentPassword);
    if (wantsPasswordChange) {
      if (!currentPassword) {
        toast.error('Masukkan password saat ini');
        return;
      }
      if (newPassword.length < 4) {
        toast.error('Password baru minimal 4 karakter');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('Konfirmasi password tidak cocok');
        return;
      }
    }

    setSaving(true);
    try {
      const input: Record<string, unknown> = {
        displayName: trimmedName,
        avatar: avatar ?? '',
      };
      if (wantsPasswordChange) {
        input.password = newPassword;
        input.currentPassword = currentPassword;
      }
      const updated: any = await invoke('update_user', { id: user.id, input });
      updateUser({
        displayName: updated.displayName ?? trimmedName,
        avatar: updated.avatar ?? (avatar || null),
      });
      logActivity('Update Profil', user.username);
      toast.success('Profil berhasil diperbarui');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Profil Saya</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-foreground/80">{initials}</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handlePickFile} disabled={saving}>
                  <Camera className="w-4 h-4 mr-1.5" />
                  {avatar ? 'Ganti Foto' : 'Unggah Foto'}
                </Button>
                {avatar && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive/90"
                    onClick={handleRemoveAvatar}
                    disabled={saving}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Hapus
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                JPG / PNG. Gambar otomatis diperkecil ke 256×256 agar ringan.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Identity */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Username</Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground">
                <UserIcon className="w-3.5 h-3.5" />
                {user.username}
                <span className="ml-auto text-[11px] uppercase tracking-wide">{roleLabel[user.role] || user.role}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-display-name" className="text-xs font-medium text-muted-foreground">
                Nama Tampilan
              </Label>
              <Input
                id="profile-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
                disabled={saving}
                placeholder="Nama lengkap yang ditampilkan"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Ubah Password <span className="font-normal normal-case">(opsional)</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="profile-current-pw" className="text-xs font-medium text-muted-foreground">
                Password Saat Ini
              </Label>
              <Input
                id="profile-current-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Wajib diisi jika mengganti password"
                disabled={saving}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-new-pw" className="text-xs font-medium text-muted-foreground">
                  Password Baru
                </Label>
                <Input
                  id="profile-new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 4 karakter"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-confirm-pw" className="text-xs font-medium text-muted-foreground">
                  Konfirmasi
                </Label>
                <Input
                  id="profile-confirm-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:opacity-90">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Downscale an image File to a square JPEG data URL.
 * Keeps file size manageable for SQLite storage.
 */
async function downscaleImage(file: File, size: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const w = bitmap.width;
  const h = bitmap.height;
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.85);
}
