import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Coffee, ShieldCheck, Briefcase, ShoppingCart, ArrowLeft, Eye, EyeOff, Loader2, Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, type Role } from '../services/auth';
// Issue #12: use shared fullscreen hook instead of duplicated logic
import { useFullscreen } from '../services/useFullscreen';

const ROLES: { id: Role; label: string; sublabel: string; icon: any; color: string; bg: string; border: string; hoverBg: string; hoverBorder: string }[] = [
  {
    id: 'admin', label: 'Admin', sublabel: 'Akses penuh & kelola pengguna',
    icon: ShieldCheck,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    hoverBg: 'hover:bg-destructive/15',
    hoverBorder: 'hover:border-destructive/50',
  },
  {
    id: 'manager', label: 'Manager', sublabel: 'Laporan, inventaris & operasional',
    icon: Briefcase,
    color: 'text-info',
    bg: 'bg-info/10',
    border: 'border-info/30',
    hoverBg: 'hover:bg-info/15',
    hoverBorder: 'hover:border-info/50',
  },
  {
    id: 'cashier', label: 'Kasir', sublabel: 'Point of Sale',
    icon: ShoppingCart,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/30',
    hoverBg: 'hover:bg-success/15',
    hoverBorder: 'hover:border-success/50',
  },
];

export function LoginScreen() {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Issue #12: replace duplicated fullscreen logic with shared hook
  const { isFullScreen, toggleFullScreen } = useFullscreen();

  const handleBack = () => {
    setSelectedRole(null);
    setUsername('');
    setPassword('');
    setError('');
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !password) return;
    if (selectedRole !== 'admin' && !username) return;
    setError('');
    setLoading(true);
    const err = await login(selectedRole, selectedRole === 'admin' ? 'admin' : username, password);
    setLoading(false);
    if (err) setError(err);
  };

  const roleInfo = ROLES.find(r => r.id === selectedRole);

  return (
    <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-background overflow-auto">
      {/* Full Screen toggle — matches Layout header style */}
      <button
        onClick={toggleFullScreen}
        className={cn(
          "absolute top-5 right-5 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
          isFullScreen
            ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
            : "bg-foreground/10 text-foreground/80 hover:bg-foreground/15 hover:text-foreground",
        )}
      >
        {isFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        {isFullScreen ? 'Keluar Full Screen' : 'Full Screen'}
      </button>

      {/* Subtle dot grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025] dark:opacity-[0.04]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--foreground)_1px,transparent_0)] bg-[size:40px_40px]" />
      </div>

      <div className="relative z-10 w-full max-w-xl px-6 py-10 flex flex-col items-center">
        {/* Logo + Brand */}
        <div className="flex flex-col items-center mb-10">
          <div className="bg-brand rounded-2xl p-4 shadow-lg shadow-brand/20 mb-4">
            <Coffee className="w-10 h-10 text-brand-foreground" strokeWidth={1.8} />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">PKasir</h1>
          <p className="text-muted-foreground text-sm mt-1">Point of Sale System</p>
        </div>

        {!selectedRole ? (
          /* ====== Role Selection ====== */
          <div className="w-full space-y-5">
            <p className="text-center text-muted-foreground text-sm">Pilih level akses untuk masuk</p>
            <div className="grid grid-cols-3 gap-3">
              {ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <Card
                    key={r.id}
                    className={`cursor-pointer transition-all duration-200 border-2 ${r.border} ${r.hoverBorder} ${r.bg} ${r.hoverBg} hover:scale-[1.03] hover:shadow-lg`}
                    onClick={() => { setSelectedRole(r.id); setError(''); setUsername(''); setPassword(''); }}
                  >
                    <CardContent className="flex flex-col items-center py-7 px-3 gap-3">
                      <div className={`rounded-xl p-3 ${r.bg}`}>
                        <Icon className={`w-8 h-8 ${r.color}`} strokeWidth={1.8} />
                      </div>
                      <div className="text-center">
                        <div className={`font-bold text-base ${r.color}`}>{r.label}</div>
                        <div className="text-[11px] text-muted-foreground mt-1 leading-tight">{r.sublabel}</div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {/* Issue #3: removed default password hint — security risk if terminal is visible to customers */}
          </div>
        ) : (
          /* ====== Login Form ====== */
          <div className="w-full max-w-sm">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>

            <Card className="border-border bg-card shadow-lg">
              <CardContent className="pt-7 pb-6 px-6">
                <div className="flex items-center gap-3 mb-6">
                  {roleInfo && (
                    <div className={`rounded-lg p-2 ${roleInfo.bg}`}>
                      <roleInfo.icon className={`w-5 h-5 ${roleInfo.color}`} />
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Masuk sebagai {roleInfo?.label}</h2>
                    <p className="text-xs text-muted-foreground">{roleInfo?.sublabel}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {selectedRole !== 'admin' && (
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Masukkan username"
                        autoFocus
                        className="h-11"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan password"
                        autoFocus={selectedRole === 'admin'}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !password || (selectedRole !== 'admin' && !username)}
                    className="w-full h-11 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...</>
                    ) : (
                      'Masuk'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-10 text-muted-foreground text-xs">
          &copy; {new Date().getFullYear()} PKasir &mdash; Point of Sale System
        </div>
      </div>
    </div>
  );
}
