// src/app/dashboard/follow-live/page.tsx
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Clock,
  Phone,
  RefreshCcw,
  Search,
  Menu,
  Pencil,
  Maximize2,
  MapPin,
  Loader2,
  Minimize2,
} from "lucide-react";
import { getAuthToken } from "@/src/utils/auth";

// SSR'de Leaflet patlamasın:
const LiveLeaflet = dynamic(() => import("@/src/components/map/LiveLeaflet"), {
  ssr: false,
});

type OrderStatus =
  | "hazirlaniyor"
  | "kurye_reddetti"
  | "kuryeye_istek_atildi"
  | "kuryeye_verildi"
  | "siparis_havuza_atildi"
  | "teslim_edildi";

type ApiOrder = {
  id: string;
  code?: string;
  customer?: string;
  phone?: string;
  address?: string;
  delivery_address?: string;
  type?: string;
  amount?: number;
  status?: OrderStatus;
  created_at?: string;

  pickup_lat?: string | number | null;
  pickup_lng?: string | number | null;
  dropoff_lat?: string | number | null;
  dropoff_lng?: string | number | null;
};

type Order = {
  id: string;
  code: string;
  customer: string;
  phone?: string;
  status: OrderStatus;
  address?: string | null;
  delivery_address?: string | null;
  type?: string | null;
  amount?: number | null;
  created_at?: string | null;

  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;

  lat: number;
  lng: number;
};

/* ---------------- Helpers ---------------- */
type HeadersDict = HeadersInit;
const bearerHeaders = (token?: string | null): HeadersDict => {
  const h: Record<string, string> = { Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

async function readJson<T = unknown>(
  res: Response
): Promise<T | string | null> {
  const t = await res.text();
  try {
    return t ? (JSON.parse(t) as T) : null;
  } catch {
    return t;
  }
}
const pickMsg = (j: any, fb: string) =>
  j?.message || j?.detail || j?.title || fb;

type TabColor =
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "purple"
  | "blue"
  | "indigo";

const STATUS_TABS: { key: OrderStatus; label: string; color: TabColor }[] = [
  { key: "hazirlaniyor", label: "Hazırlanıyor", color: "sky" },
  {
    key: "kuryeye_istek_atildi",
    label: "Kuryeye İstek Atıldı",
    color: "emerald",
  },
  { key: "kurye_reddetti", label: "Kurye Reddetti", color: "rose" },
  { key: "kuryeye_verildi", label: "Kuryeye Verildi", color: "indigo" },
  {
    key: "siparis_havuza_atildi",
    label: "Sipariş Havuza Atıldı",
    color: "purple",
  },
  { key: "teslim_edildi", label: "Teslim Edildi", color: "emerald" },
];

const statusReadable = (status: OrderStatus): string => {
  const tab = STATUS_TABS.find((t) => t.key === status);
  return tab ? tab.label : status;
};

/* ---------------- API Shapes ---------------- */
type CorporateRestaurant = { id: string; name: string };

/* ---------------- Page ---------------- */
export default function CorporateFollowLivePage() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersDict>(
    () => bearerHeaders(token),
    [token]
  );

  // Restoran listesi
  const [restaurants, setRestaurants] = React.useState<CorporateRestaurant[]>(
    []
  );
  const [listLoading, setListLoading] = React.useState(false);
  const [listErr, setListErr] = React.useState<string | null>(null);

  // Seçili restoran
  const [restaurantId, setRestaurantId] = React.useState<string>("");

  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(
    null
  );
  const [selectedStatus, setSelectedStatus] =
    React.useState<OrderStatus>("hazirlaniyor");
  const [maximizeMap, setMaximizeMap] = React.useState(false);

  const sectionRef = React.useRef(null);

  /* ----------- List restaurants ----------- */
  const loadRestaurants = React.useCallback(async () => {
    setListLoading(true);
    setListErr(null);
    try {
      const qs = new URLSearchParams();
      // limit’i istemezsen ekleme; offset zorunlu değil, 0 verelim
      qs.set("offset", "0");
      // İstersen burada: qs.set('limit','200');

      const res = await fetch(`/yuksi/corporate/restaurants?${qs.toString()}`, {
        cache: "no-store",
        headers,
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false)
        throw new Error(pickMsg(j, `HTTP ${res.status}`));

      const arr: any[] = Array.isArray(j?.data)
        ? j.data
        : Array.isArray(j)
        ? j
        : [];
      const mapped: CorporateRestaurant[] = arr
        .map((r) => ({ id: String(r?.id ?? ""), name: String(r?.name ?? "—") }))
        .filter((r) => r.id);
      setRestaurants(mapped);

      // İlk restoranı otomatik seç
      if (!restaurantId && mapped.length) setRestaurantId(mapped[0].id);
    } catch (e: any) {
      setListErr(e?.message || "Restoran listesi alınamadı.");
      setRestaurants([]);
    } finally {
      setListLoading(false);
    }
  }, [headers, restaurantId]);

  React.useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  /* ----------- Load live locations ----------- */
  const loadOrders = React.useCallback(
    async (status: OrderStatus) => {
      if (!restaurantId) {
        setError("Restoran kimliği bulunamadı (token).");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set("limit", "100");
        qs.set("offset", "0");
        qs.set("status", status);

        const res = await fetch(
          `/yuksi/corporate/restaurants/${restaurantId}/order-history?${qs.toString()}`,
          { cache: "no-store", headers }
        );
        const j: any = await readJson(res);
        if (!res.ok || j?.success === false)
          throw new Error(pickMsg(j, `HTTP ${res.status}`));

        const list: ApiOrder[] = Array.isArray(j?.data?.orders)
          ? j.data.orders
          : Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j)
          ? j
          : [];

        const mapped = list
          .map((o) => {
            const pickupLat =
              o.pickup_lat != null && o.pickup_lat !== ""
                ? Number(o.pickup_lat)
                : null;
            const pickupLng =
              o.pickup_lng != null && o.pickup_lng !== ""
                ? Number(o.pickup_lng)
                : null;
            const dropLat =
              o.dropoff_lat != null && o.dropoff_lat !== ""
                ? Number(o.dropoff_lat)
                : null;
            const dropLng =
              o.dropoff_lng != null && o.dropoff_lng !== ""
                ? Number(o.dropoff_lng)
                : null;

            // Öncelik: dropoff (teslimat noktası), yoksa pickup (restoran)
            const lat = dropLat ?? pickupLat;
            const lng = dropLng ?? pickupLng;
            if (
              !Number.isFinite(lat as number) ||
              !Number.isFinite(lng as number)
            ) {
              return null;
            }

            return {
              id: String(o.id),
              code: o.code ?? "",
              customer: o.customer ?? "",
              phone: o.phone ?? "",
              status: (o.status as OrderStatus) ?? status,
              address: o.address ?? null,
              delivery_address: o.delivery_address ?? null,
              type: o.type ?? null,
              amount:
                o.amount != null && o.amount !== "" ? Number(o.amount) : null,
              created_at: o.created_at ?? null,

              pickup_lat: pickupLat,
              pickup_lng: pickupLng,
              dropoff_lat: dropLat,
              dropoff_lng: dropLng,

              lat: lat as number,
              lng: lng as number,
            } satisfies Order;
          })
          .filter(Boolean) as Order[];

        setOrders(mapped);
        setSelectedOrderId((prev) =>
          prev && mapped.some((m) => m.id === prev)
            ? prev
            : mapped[0]?.id ?? null
        );
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        setError(error.message || "Siparişler alınamadı.");
        setOrders([]);
        setSelectedOrderId(null);
      } finally {
        setLoading(false);
      }
    },
    [headers, restaurantId]
  );

  React.useEffect(() => {
    loadOrders(selectedStatus);
  }, [loadOrders, selectedStatus]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return orders;
    return orders.filter((o) => {
      const code = o.code.toLowerCase();
      const cust = o.customer.toLowerCase();
      const phone = (o.phone ?? "").replace(/\s/g, "").toLowerCase();
      return (
        code.includes(qq) ||
        cust.includes(qq) ||
        phone.includes(qq.replace(/\s/g, "").toLowerCase())
      );
    });
  }, [orders, q]);

  const sel =
    filtered.find((o) => o.id === selectedOrderId) ?? filtered[0] ?? null;

  const markers = filtered.map((o) => ({
    id: o.id,
    name: o.code || o.customer || "Sipariş",
    phone: o.customer || o.phone || "",
    lat: o.lat,
    lng: o.lng,
  }));

  /* ---------------- UI ---------------- */
  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Canlı Takip (Bayinin Restoranları)
          </h1>
          <p className="text-sm text-neutral-600">
            Restoran seç ve siparişlerin durumlarını haritada izle.
          </p>
        </div>
      </div>

      {/* Hatalar */}
      {(listErr || error) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {listErr || error}
        </div>
      )}

      {/* Kontroller */}
      <section
        ref={sectionRef}
        className="rounded-xl border border-neutral-200/70 bg-white shadow-sm overflow-hidden"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
          {/* Harita */}
          <div className="relative">
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
                    <option value="">
                      {listLoading ? "Yükleniyor…" : "Seçin…"}
                    </option>
                    {!listLoading &&
                      restaurants.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} • {r.id}
                        </option>
                      ))}
                  </select>
                </label>

                <button
                  onClick={loadOrders.bind(null, selectedStatus)}
                  disabled={!restaurantId || loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  Konumları Getir
                </button>
              </div>
            </aside>
            <LiveLeaflet
              markers={markers}
              selectedId={sel?.id ?? null}
              onSelect={(id) => setSelectedOrderId(id)}
              className="h-[calc(100vh-220px)] w-full"
              overlay={
                <>
                  <div className="pointer-events-auto absolute right-3 top-3 z-10 flex flex-col gap-2">
                    <button
                      onClick={() => console.log("a")}
                      title="Menü"
                      aria-label="Menü"
                      className="grid cursor-pointer h-10 w-10 place-items-center rounded-md bg-emerald-600 text-white shadow"
                    >
                      <Menu className="h-5 w-5"></Menu>
                    </button>
                    <button
                      onClick={() => {
                        if (maximizeMap) {
                          document.exitFullscreen?.();
                        } else {
                          sectionRef.current?.requestFullscreen?.();
                        }
                        setMaximizeMap(!maximizeMap);
                      }}
                      title={maximizeMap ? "Küçült" : "Tam Ekran"}
                      className="grid cursor-pointer h-10 w-10 place-items-center rounded-md bg-neutral-700 text-white shadow"
                    >
                      {maximizeMap ? (
                        <Minimize2 className="h-5 w-5" />
                      ) : (
                        <Maximize2 className="h-5 w-5" />
                      )}
                    </button>
                    <div className="grid h-10 min-w-10 place-items-center rounded-md bg-neutral-900 px-2 text-white shadow">
                      <span className="tabular-nums text-sm">
                        {filtered.length}
                      </span>
                    </div>
                  </div>

                  <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex flex-col items-end gap-2">
                    <div className="pointer-events-auto rounded-md bg-neutral-900/90 px-3 py-1.5 text-xs font-semibold text-white">
                      Listelenen Paket Sayısı: {filtered.length}
                    </div>
                  </div>

                  <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 my-10">
                    <div className="mx-2 mb-2 grid grid-cols-3 gap-2 text-sm font-medium">
                      {STATUS_TABS.map((t) => (
                        <Tab
                          key={t.key}
                          color={t.color}
                          label={t.label}
                          active={selectedStatus === t.key}
                          onClick={() => setSelectedStatus(t.key)}
                        />
                      ))}
                    </div>
                  </div>
                </>
              }
            />
          </div>
          <aside className="border-t lg:border-t-0 lg:border-l border-neutral-200/70 bg-white p-4 lg:p-6">
            {!sel ? (
              <div className="grid h-full place-items-center text-sm text-neutral-500">
                Haritada gösterilecek sipariş yok.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold">
                      #{sel.code || sel.id.slice(0, 8)}
                    </div>
                    <div className="text-sm text-neutral-600">
                      {sel.customer || "Müşteri"}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      Durum: {statusReadable(sel.status)}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white bg-sky-600">
                    Paket
                  </span>
                </div>

                <div className="rounded-xl border border-neutral-200 p-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-neutral-500" />
                    {sel.phone ? (
                      <a
                        className="text-sky-600 hover:underline"
                        href={`tel:${sel.phone.replace(/\s/g, "")}`}
                      >
                        {sel.phone}
                      </a>
                    ) : (
                      <span className="text-neutral-500">Telefon yok</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-neutral-500" />
                    <span className="text-neutral-700">
                      Oluşturma:{" "}
                      <b>
                        {sel.created_at
                          ? new Date(sel.created_at).toLocaleString("tr-TR")
                          : "—"}
                      </b>
                    </span>
                  </div>
                  {sel.amount != null && (
                    <div>
                      Tutar: <b>{sel.amount.toFixed(2)} ₺</b>
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">
                      Restoran Adresi
                    </div>
                    <div className="text-neutral-800">{sel.address || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">
                      Teslimat Adresi
                    </div>
                    <div className="text-neutral-800">
                      {sel.delivery_address || "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="overflow-x-auto border-t border-neutral-200/70 bg-white rounded-xl shadow-sm">
        {" "}
        {/* Tam ekran için sipariş listesini ayırdım */}
        <div className="flex flex-wrap h-91 gap-3 overflow-y-auto pb-1">
          {" "}
          {/* görüntü bozulmasın diye wrap */}
          {filtered.map((o) => {
            const active = sel?.id === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setSelectedOrderId(o.id)}
                className={`w-[150px] flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                  active
                    ? "border-orange-300 bg-orange-50"
                    : "border-neutral-200 bg-white hover:bg-neutral-50"
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-neutral-900">
                    #{o.code || o.id.slice(0, 8)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {o.customer || "Müşteri"} • {statusReadable(o.status)}
                  </div>
                </div>
                <MapPin className="h-4 w-4 text-neutral-400" />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-2 text-sm text-neutral-500">
              Bu durum için sipariş bulunamadı.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="px-4 lg:px-6 py-4 sm:py-6 space-y-3">
          <div className="grid items-end gap-3 md:grid-cols-[minmax(220px,1fr)_auto]">
            <div>
              <label className="mb-1 block text-sm font-semibold text-neutral-700">
                Sipariş Kodu / Müşteri / Telefon
              </label>
              <div className="relative">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Ara…"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 pl-9 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
                />
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              </div>
            </div>
            <div className="flex justify-end">
              <span className="inline-flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-700">
                Gösterilen Paket: <strong>{filtered.length}</strong>
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Tab({
  color,
  label,
  active,
  onClick,
}: {
  color: TabColor;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const colors: Record<TabColor, string> = {
    sky: "bg-sky-600",
    emerald: "bg-emerald-600",
    amber: "bg-amber-600",
    rose: "bg-rose-600",
    purple: "bg-purple-600",
    blue: "bg-blue-600",
    indigo: "bg-indigo-600",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-white shadow text-xs sm:text-sm w-full ${
        colors[color]
      } ${active ? "ring-2 ring-white/90 scale-[1.02]" : ""}`}
    >
      <span className="text-sm leading-none">●</span>
      <span className="font-semibold">{label}</span>
    </button>
  );
}
