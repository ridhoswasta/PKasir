import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Coffee, ShieldCheck, Briefcase, ShoppingCart, ArrowLeft, Eye, EyeOff, Loader2, Maximize, Minimize } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAuth, type Role } from '../services/auth';

const ROLES: { id: Role; label: string; sublabel: string; icon: any; color: string; bg: string; border: string }[] = [
  {
    id: 'admin', label: 'Admin', sublabel: 'Akses penuh & kelola pengguna',
    icon: ShieldCheck, color: 'text-red-600', bg: 'bg-red-50 hover:bg-red-100', border: 'border-red-200 hover:border-red-400',
  },
  {
    id: 'manager', label: 'Manager', sublabel: 'Laporan, inventaris & operasional',
    icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200 hover:border-blue-400',
  },
  {
    id: 'cashier', label: 'Kasir', sublabel: 'Point of Sale',
    icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-50 hover:bg-emerald-100', border: 'border-emerald-200 hover:border-emerald-400',
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
  const [isFullScreen, setIsFullScreen] = useState(false);
  const appWindow = getCurrentWindow();

  React.useEffect(() => {
    appWindow.isFullscreen().then(setIsFullScreen);
    let unlisten: (() => void) | undefined;
    appWindow.onResized(async () => {
      setIsFullScreen(await appWindow.isFullscreen());
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') appWindow.isFullscreen().then((fs) => { if (fs) appWindow.setFullscreen(false); });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
    <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-auto">
      {/* Full Screen toggle */}
      <button
        onClick={async () => {
          const fs = await appWindow.isFullscreen();
          if (!fs) {
            if (await appWindow.isMaximized()) await appWindow.unmaximize();
            await appWindow.setFullscreen(true);
          } else {
            await appWindow.setFullscreen(false);
          }
        }}
        className="absolute top-5 right-5 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white transition-colors backdrop-blur-sm"
      >
        {isFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        {isFullScreen ? 'Keluar Full Screen' : 'Full Screen'}
      </button>

      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }} />
      </div>

      <div className="relative z-10 w-full max-w-xl px-6 py-10 flex flex-col items-center">
        {/* Logo + Brand */}
        <div className="flex flex-col items-center mb-10">
          <div className="bg-orange-500 rounded-2xl p-4 shadow-lg shadow-orange-500/20 mb-4">
            <Coffee className="w-10 h-10 text-white" strokeWidth={1.8} />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">PKasir</h1>
          <p className="text-slate-400 text-sm mt-1">Point of Sale System</p>
        </div>

        {!selectedRole ? (
          /* ====== Role Selection ====== */
          <div className="w-full space-y-5">
            <p className="text-center text-slate-400 text-sm">Pilih level akses untuk masuk</p>
            <div className="grid grid-cols-3 gap-3">
              {ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <Card
                    key={r.id}
                    className={`cursor-pointer transition-all duration-200 border-2 ${r.border} ${r.bg} hover:scale-[1.03] hover:shadow-lg`}
                    onClick={() => { setSelectedRole(r.id); setError(''); setUsername(''); setPassword(''); }}
                  >
                    <CardContent className="flex flex-col items-center py-7 px-3 gap-3">
                      <div className={`rounded-xl p-3 ${r.bg}`}>
                        <Icon className={`w-8 h-8 ${r.color}`} strokeWidth={1.8} />
                      </div>
                      <div className="text-center">
                        <div className={`font-bold text-base ${r.color}`}>{r.label}</div>
                        <div className="text-[11px] text-slate-500 mt-1 leading-tight">{r.sublabel}</div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <p className="text-center text-slate-600 text-xs mt-4">
              Password default: <code className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-xs">000000</code>
            </p>
          </div>
        ) : (
          /* ====== Login Form ====== */
          <div className="w-full max-w-sm">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>

            <Card className="border-slate-700 bg-slate-800/60 backdrop-blur-sm shadow-2xl">
              <CardContent className="pt-7 pb-6 px-6">
                <div className="flex items-center gap-3 mb-6">
                  {roleInfo && (
                    <div className={`rounded-lg p-2 ${roleInfo.bg}`}>
                      <roleInfo.icon className={`w-5 h-5 ${roleInfo.color}`} />
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-white">Masuk sebagai {roleInfo?.label}</h2>
                    <p className="text-xs text-slate-400">{roleInfo?.sublabel}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {selectedRole !== 'admin' && (
                    <div className="space-y-2">
                      <Label className="text-slate-300">Username</Label>
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Masukkan username"
                        autoFocus
                        className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 h-11"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-slate-300">Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan password"
                        autoFocus={selectedRole === 'admin'}
                        className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 h-11 pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !password || (selectedRole !== 'admin' && !username)}
                    className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
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

        <div className="mt-10 text-slate-600 text-xs">
          &copy; {new Date().getFullYear()} PKasir &mdash; Point of Sale System
        </div>
      </div>
    </div>
  );
}
