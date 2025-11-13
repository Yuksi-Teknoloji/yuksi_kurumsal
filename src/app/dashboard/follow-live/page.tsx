// src/app/dashboards/[role]/dealers/follow-live/page.tsx

// src/app/dashboards/[role]/dealers/follow-live/page.tsx
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { RefreshCcw, MapPin, Loader2 } from 'lucide-react';
import { getAuthToken } from '@/src/utils/auth';

// SSR'de Leaflet patlamasın:
const LiveLeaflet = dynamic(() => import('@/src/components/map/LiveLeaflet'), { ssr: false });

/* ---------------- Helpers ---------------- */
type HeadersDict = HeadersInit;
const bearerHeaders = (token?: string | null): HeadersDict => {
  const h: HeadersDict = { Accept: 'application/json' };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
};

async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try { return t ? JSON.parse(t) : (null as any); } catch { return (t as any); }
}
const pickMsg = (j: any, fb: string) => j?.message || j?.detail || j?.title || fb;

/* ---------------- API Shapes ---------------- */
type CorporateRestaurant = { id: string; name: string };
type CourierLiveRow = {
  courier_id: string;
  courier_name?: string | null;
  courier_phone?: string | null;
  latitude: number;
  longitude: number;
  // diğer alanlar da geliyor ama harita için bunlar yeterli
};

type LeafletMarker = { id: string; name: string; phone: string; lat: number; lng: number };

/* ---------------- Page ---------------- */
export default function CorporateFollowLivePage() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersDict>(() => bearerHeaders(token), [token]);

  // Restoran listesi
  const [restaurants, setRestaurants] = React.useState<CorporateRestaurant[]>([]);
  const [listLoading, setListLoading] = React.useState(false);
  const [listErr, setListErr] = React.useState<string | null>(null);

  // Seçili restoran
  const [restaurantId, setRestaurantId] = React.useState<string>('');

  // Canlı konumlar
  const [markers, setMarkers] = React.useState<LeafletMarker[]>([]);
  const [liveLoading, setLiveLoading] = React.useState(false);
  const [liveErr, setLiveErr] = React.useState<string | null>(null);

  // Auto refresh
  const [auto, setAuto] = React.useState(false);

  /* ----------- List restaurants ----------- */
  const loadRestaurants = React.useCallback(async () => {
    setListLoading(true);
    setListErr(null);
    try {
      const qs = new URLSearchParams();
      // limit’i istemezsen ekleme; offset zorunlu değil, 0 verelim
      qs.set('offset', '0');
      // İstersen burada: qs.set('limit','200');

      const res = await fetch(`/yuksi/corporate/restaurants?${qs.toString()}`, {
        cache: 'no-store',
        headers,
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      const arr: any[] = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
      const mapped: CorporateRestaurant[] = arr
        .map((r) => ({ id: String(r?.id ?? ''), name: String(r?.name ?? '—') }))
        .filter((r) => r.id);
      setRestaurants(mapped);

      // İlk restoranı otomatik seç
      if (!restaurantId && mapped.length) setRestaurantId(mapped[0].id);
    } catch (e: any) {
      setListErr(e?.message || 'Restoran listesi alınamadı.');
      setRestaurants([]);
    } finally {
      setListLoading(false);
    }
  }, [headers, restaurantId]);

  React.useEffect(() => { loadRestaurants(); }, [loadRestaurants]);

  /* ----------- Load live locations ----------- */
  const loadLive = React.useCallback(async () => {
    if (!restaurantId) {
      setMarkers([]);
      return;
    }
    setLiveLoading(true);
    setLiveErr(null);
    try {
      const res = await fetch(
        `/yuksi/corporate/restaurants/${restaurantId}/couriers/live-locations`,
        { cache: 'no-store', headers }
      );
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      const arr: any[] = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
      const mapped: LeafletMarker[] = arr
        .filter((x) => Number.isFinite(Number(x?.latitude)) && Number.isFinite(Number(x?.longitude)))
        .map((x: CourierLiveRow) => ({
          id: String(x.courier_id),
          name: String(x.courier_name ?? 'Kurye'),
          phone: String(x.courier_phone ?? ''),
          lat: Number(x.latitude),
          lng: Number(x.longitude),
        }));
      setMarkers(mapped);
    } catch (e: any) {
      setLiveErr(e?.message || 'Kurye konumları getirilemedi.');
      setMarkers([]);
    } finally {
      setLiveLoading(false);
    }
  }, [headers, restaurantId]);

  React.useEffect(() => { loadLive(); }, [loadLive]);

  // Auto refresh 5s
  React.useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => { loadLive(); }, 5000);
    return () => clearInterval(t);
  }, [auto, loadLive]);

  /* ---------------- UI ---------------- */
  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Canlı Takip (Bayinin Restoranları)</h1>
          <p className="text-sm text-neutral-600">
            Restoran seç ve kuryelerin anlık GPS konumlarını haritada izle.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
              className="h-4 w-4"
            />
            Oto-yenile (5 sn)
          </label>
          <button
            onClick={() => { loadRestaurants(); loadLive(); }}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
            title="Yenile"
          >
            <RefreshCcw className="h-4 w-4" />
            Yenile
          </button>
        </div>
      </div>

      {/* Hatalar */}
      {(listErr || liveErr) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {listErr || liveErr}
        </div>
      )}

      {/* Kontroller */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <MapPin className="h-4 w-4" />
          <div className="font-semibold">Restoran & Harita</div>
          <span className="ml-2 text-xs text-neutral-500">
            {markers.length ? `• ${markers.length} kurye` : '• kurye yok'}
          </span>
        </div>

        <div className="grid gap-0 lg:grid-cols-[360px,1fr]">
          {/* Sol panel: restoran seçimi */}
          <aside className="border-b lg:border-b-0 lg:border-r">
            <div className="p-4 space-y-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Restoran</span>
                <select
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                  disabled={listLoading}
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                >
                  <option value="">{listLoading ? 'Yükleniyor…' : 'Seçin…'}</option>
                  {!listLoading && restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} • {r.id}
                    </option>
                  ))}
                </select>
              </label>

              <button
                onClick={loadLive}
                disabled={!restaurantId || liveLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60"
              >
                {liveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Canlı Konumları Getir
              </button>
            </div>
          </aside>

          {/* Harita */}
          <div className="p-3">
            <LiveLeaflet
              markers={markers}
              selectedId={null}
              onSelect={() => {}}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
