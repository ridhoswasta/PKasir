import { useEffect, useMemo, useRef, useState } from 'react';
import { Coffee, ShoppingCart, CheckCircle2, Maximize, Minimize, QrCode, Smartphone, BookOpen, Image as ImageIcon } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { cn } from '@/lib/utils';
import { QRCodeDisplay } from './QRCodeDisplay';

interface CartItem {
  name: string;
  variantName?: string;
  quantity: number;
  price: number;
  note?: string;
  image?: string;
}

interface MenuProduct {
  id: string | number;
  name: string;
  price: number;
  image?: string;
  category?: string;
  variants?: { name: string; price: number }[];
}

interface DisplayState {
  cart: CartItem[];
  subtotal: number;
  tax: number;
  taxRate: number;
  serviceCharge: number;
  serviceRate: number;
  total: number;
  discountAmount?: number;
  discountName?: string;
  customer?: string;
  tableName?: string;
  logo?: string;
  header?: string;
  address?: string;
  displayPhotos?: string[];
  displaySlideshowInterval?: number;
  lastPayment?: { txId: string; total: number } | null;
  qrisPayment?: { total: number; qrisImage?: string; qrisString?: string } | null;
  showMenu?: { categories: string[]; products: MenuProduct[] } | null;
}

const EMPTY: DisplayState = {
  cart: [],
  subtotal: 0,
  tax: 0,
  taxRate: 0,
  serviceCharge: 0,
  serviceRate: 0,
  total: 0,
};

export function CustomerDisplay() {
  const [state, setState] = useState<DisplayState>(EMPTY);
  const [showSuccess, setShowSuccess] = useState<{ txId: string; total: number } | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartScrollRef = useRef<HTMLDivElement>(null);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    const bc = new BroadcastChannel('pos-customer-display');
    bc.onmessage = (e) => {
      const msg = e.data;
      if (msg?.type === 'update' && msg.data) {
        setState(msg.data);
        // Detect newly completed transaction
        if (msg.data.lastPayment) {
          setShowSuccess(msg.data.lastPayment);
          if (successTimerRef.current) clearTimeout(successTimerRef.current);
          successTimerRef.current = setTimeout(() => setShowSuccess(null), 4000);
        }
      }
    };
    // Request initial state from POS
    bc.postMessage({ type: 'ready' });
    return () => {
      bc.close();
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Track fullscreen state
  useEffect(() => {
    appWindow.isFullscreen().then(setIsFullScreen);
    let unlisten: (() => void) | undefined;
    appWindow.onResized(async () => {
      setIsFullScreen(await appWindow.isFullscreen());
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // Auto-scroll cart to bottom when items change
  useEffect(() => {
    if (cartScrollRef.current && state.cart.length > 0) {
      cartScrollRef.current.scrollTo({ top: cartScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [state.cart]);

  // Escape exits fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') appWindow.isFullscreen().then((fs) => { if (fs) appWindow.setFullscreen(false); });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const toggleFullScreen = async () => {
    const fs = await appWindow.isFullscreen();
    if (!fs) {
      if (await appWindow.isMaximized()) await appWindow.unmaximize();
      await appWindow.setFullscreen(true);
    } else {
      await appWindow.setFullscreen(false);
    }
  };

  const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

  return (
    <div className="absolute inset-0 bg-background text-foreground flex flex-col">
      {/* Fullscreen toggle — subtle, top-right or top-left when fullscreen */}
      <button
        onClick={toggleFullScreen}
        aria-label={isFullScreen ? 'Keluar Full Screen' : 'Full Screen'}
        className="absolute top-4 right-4 z-30 h-10 w-10 rounded-xl bg-card/80 hover:bg-card border border-border text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors backdrop-blur-sm opacity-60 hover:opacity-100"
        title={isFullScreen ? 'Keluar Full Screen (Esc)' : 'Full Screen'}
      >
        {isFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </button>

      {/* Header — always reserve right-side space for the floating fullscreen
          button (pinned top-right) so it never overlaps the clock */}
      <div className={cn(
        'px-10 py-8 border-b border-border/70 flex items-center gap-5 bg-background pr-24',
        isFullScreen && 'pt-4'
      )}>
        {state.logo ? (
          <img src={state.logo} alt="Logo" className="h-16 object-contain" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
            <Coffee className="w-8 h-8 text-primary-foreground" />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground whitespace-pre-line">
            {state.header || 'Selamat Datang'}
          </h1>
          {state.address ? (
            <p className="text-muted-foreground text-sm mt-1 whitespace-pre-line">{state.address}</p>
          ) : (
            <p className="text-muted-foreground text-sm mt-1">Silakan periksa pesanan Anda di layar ini</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-5xl font-bold tracking-tight text-foreground/90 tabular-nums" style={{ textShadow: '0 0 30px rgba(255,255,255,0.15)' }}>{timeStr}</div>
          <div className="text-sm text-muted-foreground/80 mt-1 tracking-wide">{dateStr}</div>
        </div>
        {state.tableName && (
          <div className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground">
            <div className="text-[11px] uppercase tracking-wide text-primary-foreground/70">Meja</div>
            <div className="text-2xl font-bold">{state.tableName}</div>
          </div>
        )}
      </div>

      {/* Cart area */}
      <div ref={cartScrollRef} className={state.cart.length === 0 ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto px-10 py-6"}>
        {state.cart.length === 0 ? (
          <div className="h-full flex">
            <div className="flex-[3_1_0%] min-w-0 border-r border-border/70 bg-muted/30">
              <PhotoSlideshow
                photos={state.displayPhotos || []}
                intervalSec={state.displaySlideshowInterval || 5}
              />
            </div>
            <div className="flex-[1_1_0%] min-w-0 flex flex-col items-center justify-center text-muted-foreground/70 gap-4 px-6 py-6">
              <ShoppingCart className="w-24 h-24 opacity-30" strokeWidth={1} />
              <div className="text-center">
                <p className="text-2xl font-bold text-muted-foreground">Belum ada pesanan</p>
                <p className="text-sm text-muted-foreground/70 mt-2">Menunggu kasir menambahkan item...</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-3 px-2 font-semibold">
              Pesanan Anda ({state.cart.reduce((s, i) => s + i.quantity, 0)} item)
            </div>
            <div className="space-y-2">
              {state.cart.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 animate-[slideIn_0.2s_ease-out]"
                >
                  <div className="w-24 h-24 rounded-2xl bg-muted border border-border flex items-center justify-center shrink-0 relative overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Coffee className="w-10 h-10 text-muted-foreground/70" />
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 bg-primary text-primary-foreground text-sm font-bold min-w-[26px] h-[26px] flex items-center justify-center rounded-tl-lg rounded-br-2xl px-1.5">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-semibold text-foreground truncate">{item.name}</div>
                    {item.variantName && (
                      <div className="text-sm text-muted-foreground mt-0.5">{item.variantName}</div>
                    )}
                    {item.note && (
                      <div className="text-sm text-warning italic mt-1">📝 {item.note}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold text-foreground">{fmt(item.price * item.quantity)}</div>
                    {item.quantity > 1 && (
                      <div className="text-xs text-muted-foreground">{fmt(item.price)} × {item.quantity}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Totals */}
      {state.cart.length > 0 && (
        <div className="border-t border-border/70 bg-muted/40">
          <div className="max-w-3xl mx-auto px-10 py-5 space-y-2">
            <div className="flex justify-between text-muted-foreground text-base">
              <span>Subtotal</span>
              <span className="text-foreground/90">{fmt(state.subtotal)}</span>
            </div>
            {state.tax > 0 && (
              <div className="flex justify-between text-muted-foreground text-base">
                <span>Pajak ({state.taxRate}%)</span>
                <span className="text-foreground/90">{fmt(state.tax)}</span>
              </div>
            )}
            {state.serviceCharge > 0 && (
              <div className="flex justify-between text-muted-foreground text-base">
                <span>Biaya Layanan ({state.serviceRate}%)</span>
                <span className="text-foreground/90">{fmt(state.serviceCharge)}</span>
              </div>
            )}
            {(state.discountAmount || 0) > 0 && (
              <div className="flex justify-between text-destructive text-base">
                <span>Diskon{state.discountName ? ` (${state.discountName})` : ''}</span>
                <span className="text-destructive font-semibold">-{fmt(state.discountAmount || 0)}</span>
              </div>
            )}
            <div className="border-t border-border pt-3 mt-3 flex justify-between items-baseline">
              <span className="text-xl font-bold text-foreground/80">Total</span>
              <div className="text-right">
                {(state.discountAmount || 0) > 0 && (
                  <span className="text-sm text-muted-foreground line-through mr-2">{fmt(state.total + (state.discountAmount || 0))}</span>
                )}
                <span className="text-4xl font-extrabold text-foreground tracking-tight">
                  {fmt(state.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu overlay — shown while cashier opens "Tampilkan Menu" */}
      {state.showMenu && <MenuOverlay data={state.showMenu} logo={state.logo} header={state.header} />}

      {/* QRIS payment overlay — shown while cashier's QRIS dialog is open */}
      {state.qrisPayment && (
        <div className="fixed inset-0 bg-background z-40 animate-[fadeIn_0.25s_ease-out] overflow-y-auto">
          <div className="min-h-full flex flex-col items-center justify-center px-6 py-8">
            <div className="flex items-center gap-2 text-[color:var(--brand-blue)] mb-2">
              <QrCode className="w-5 h-5" />
              <span className="text-xs font-semibold tracking-widest uppercase">Pembayaran QRIS</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-1.5 text-center">Scan untuk Membayar</h2>
            <p className="text-muted-foreground text-sm mb-4 flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Buka aplikasi e-wallet / mobile banking Anda
            </p>

            {/* Total */}
            <div className="mb-4 text-center">
              <div className="text-[11px] text-muted-foreground uppercase tracking-widest mb-0.5">Total Pembayaran</div>
              <div className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
                {fmt(state.qrisPayment.total)}
              </div>
            </div>

            {/* QR card — sized to viewport so it never clips */}
            <div className="bg-white rounded-3xl p-4 md:p-5 shadow-xl ring-1 ring-border">
              {state.qrisPayment.qrisString ? (
                // Dynamic QRIS — render live QR code from the generated string
                <QRCodeDisplay
                  value={state.qrisPayment.qrisString}
                  size={320}
                  className="w-[min(60vh,320px)] h-[min(60vh,320px)] md:w-[min(55vh,380px)] md:h-[min(55vh,380px)]"
                />
              ) : state.qrisPayment.qrisImage ? (
                // Static QRIS fallback — show the uploaded image
                <img
                  src={state.qrisPayment.qrisImage}
                  alt="QRIS"
                  className="w-[min(60vh,320px)] h-[min(60vh,320px)] md:w-[min(55vh,380px)] md:h-[min(55vh,380px)] object-contain"
                />
              ) : (
                <div className="w-[min(60vh,320px)] h-[min(60vh,320px)] md:w-[min(55vh,380px)] md:h-[min(55vh,380px)] flex flex-col items-center justify-center text-muted-foreground/70 gap-3 border-2 border-dashed border-border rounded-2xl">
                  <QrCode className="w-16 h-16 opacity-40" />
                  <p className="text-center text-sm px-6">
                    QRIS belum dikonfigurasi.<br />Silakan minta kasir mengatur gambar QRIS di Pengaturan.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px w-12 bg-border" />
              <span>Tunggu konfirmasi kasir setelah pembayaran berhasil</span>
              <div className="h-px w-12 bg-border" />
            </div>
          </div>
        </div>
      )}

      {/* Success overlay */}
      {showSuccess && (
        <div className="fixed inset-0 bg-success/95 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-[fadeIn_0.3s_ease-out]">
          <CheckCircle2 className="w-32 h-32 text-success-foreground drop-shadow-lg mb-6" strokeWidth={2} />
          <div className="text-5xl font-extrabold text-success-foreground mb-2">Terima Kasih!</div>
          <div className="text-success-foreground/80 text-lg">Pembayaran berhasil</div>
          <div className="mt-6 text-4xl font-bold text-success-foreground">{fmt(showSuccess.total)}</div>
          <div className="text-success-foreground/80 text-sm mt-3">Struk #{showSuccess.txId}</div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function MenuOverlay({
  data,
  logo,
  header,
}: {
  data: { categories: string[]; products: MenuProduct[] };
  logo?: string;
  header?: string;
}) {
  const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');
  const [activeCategory, setActiveCategory] = useState<string>('Semua');

  const categories = useMemo(() => ['Semua', ...(data.categories || [])], [data.categories]);

  const filtered = useMemo(() => {
    if (activeCategory === 'Semua') return data.products;
    return data.products.filter((p) => p.category === activeCategory);
  }, [data.products, activeCategory]);

  const grouped = useMemo(() => {
    if (activeCategory !== 'Semua') return [{ category: activeCategory, items: filtered }];
    const map = new Map<string, MenuProduct[]>();
    for (const p of data.products) {
      const cat = p.category || 'Lainnya';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [data.products, filtered, activeCategory]);

  return (
    <div className="fixed inset-0 bg-background z-40 animate-[fadeIn_0.25s_ease-out] flex flex-col">
      {/* Header */}
      <div className="px-10 py-6 border-b border-border/70 flex items-center gap-5 shrink-0 bg-background">
        {logo ? (
          <img src={logo} alt="Logo" className="h-14 object-contain" />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <Coffee className="w-7 h-7 text-primary-foreground" />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-0.5">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs font-semibold tracking-widest uppercase">Daftar Menu</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight whitespace-pre-line text-foreground">
            {header || 'Selamat Datang'}
          </h1>
        </div>
      </div>

      {/* Category pills */}
      {categories.length > 1 && (
        <div className="flex gap-2 px-10 py-4 overflow-x-auto shrink-0 border-b border-border/70">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground/80 border-border hover:bg-accent/60 hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Products */}
      <div className="flex-1 overflow-y-auto px-10 py-6">
        {data.products.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/70 gap-4">
            <Coffee className="w-24 h-24 opacity-30" strokeWidth={1} />
            <p className="text-2xl font-bold text-muted-foreground">Belum ada produk tersedia</p>
          </div>
        ) : (
          <div className="space-y-8 max-w-6xl mx-auto">
            {grouped.map(({ category, items }) => (
              <section key={category}>
                {activeCategory === 'Semua' && (
                  <h2 className="text-xs font-bold text-foreground/80 uppercase tracking-widest mb-3 px-1">
                    {category}
                  </h2>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.map((p) => {
                    const variantCount = p.variants?.length || 0;
                    const minPrice =
                      variantCount > 0
                        ? p.price + Math.min(...p.variants!.map((v) => v.price || 0))
                        : p.price;
                    return (
                      <div
                        key={p.id}
                        className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col"
                      >
                        <div className="aspect-square bg-muted relative overflow-hidden">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Coffee className="w-12 h-12 text-muted-foreground/70" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="text-base font-semibold text-foreground leading-tight line-clamp-2">
                            {p.name}
                          </h3>
                          <p className="text-foreground/90 text-lg font-bold mt-1">
                            {variantCount > 0 ? `Mulai ${fmt(minPrice)}` : fmt(p.price)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="shrink-0 px-10 py-3 border-t border-border/70 text-center text-xs text-muted-foreground bg-muted/40">
        Silakan lihat menu kami — kasir akan membantu pesanan Anda
      </div>
    </div>
  );
}

function PhotoSlideshow({ photos, intervalSec }: { photos: string[]; intervalSec: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length <= 1) return;
    const ms = Math.max(1, intervalSec) * 1000;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, ms);
    return () => clearInterval(id);
  }, [photos.length, intervalSec]);

  useEffect(() => {
    if (index >= photos.length) setIndex(0);
  }, [photos.length, index]);

  if (photos.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/60 gap-3 px-4 text-center">
        <ImageIcon className="w-16 h-16 opacity-40" strokeWidth={1.5} />
        <p className="text-sm">
          Belum ada foto slideshow.
          <br />
          Tambahkan di Pengaturan → Umum.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden px-8 pt-8 pb-20">
      {photos.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`Slide ${i + 1}`}
          className="absolute inset-0 w-[calc(100%-4rem)] h-[calc(100%-4rem)] m-8 object-cover transition-opacity duration-700 rounded-3xl shadow-2xl ring-1 ring-border/40"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}
      {photos.length > 1 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {photos.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-colors shadow-sm ${
                i === index ? 'bg-white shadow-black/30' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
