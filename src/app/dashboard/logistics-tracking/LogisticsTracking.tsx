// src/app/dashboards/[role]/dealers/logistics-tracking/page.tsx
"use client";

import * as React from "react";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import { getAuthToken } from "@/src/utils/auth";

/* ================= Helpers ================= */
async function readJson<T = any>(res: Response): Promise<T> {
  const txt = await res.text();
  try {
    return txt ? JSON.parse(txt) : (null as any);
  } catch {
    return txt as any;
  }
}
const pickMsg = (d: any, fb: string) =>
  d?.message || d?.detail || d?.title || fb;

const fmtDT = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("tr-TR") : "—";

/* ================= Types ================= */
type CorporateJob = {
  id: string;
  deliveryType: "immediate" | "scheduled";
  carrierType: string;
  commissionRate?: number;
  commissionDescription?: string;
  vehicleType: string;
  pickupAddress: string;
  dropoffAddress: string;
  specialNotes?: string;
  totalPrice?: number;
  paymentMethod?: "cash" | "card" | "transfer";
  createdAt?: string;
  imageFileIds?: string[];
  deliveryDate?: string | null;
  deliveryTime?: string | null;
};

type LatLng = { lat: number; lng: number };

/* ================= Page ================= */
export default function CorporateLogisticsTrackingPage() {
  const token = React.useMemo(getAuthToken, []);
  const headers: HeadersInit = React.useMemo(
    () => ({
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  const [rows, setRows] = React.useState<CorporateJob[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // pagination
  const [limit, setLimit] = React.useState<number | "">(50);
  const [offset, setOffset] = React.useState<number | "">(0);
  const [deliveryType, setDeliveryType] = React.useState<string | "">("");

  // route modal
  const [routeOpen, setRouteOpen] = React.useState(false);
  const [routeFor, setRouteFor] = React.useState<CorporateJob | null>(null);
  const [routeLoading, setRouteLoading] = React.useState(false);
  const [start, setStart] = React.useState<LatLng | null>(null);
  const [end, setEnd] = React.useState<LatLng | null>(null);
  const [routeErr, setRouteErr] = React.useState<string | null>(null);

  // edit modal
  const [editOpen, setEditOpen] = React.useState(false);
  const [editBusy, setEditBusy] = React.useState(false);
  const [editing, setEditing] = React.useState<CorporateJob | null>(null);

  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [errMsg, setErrMsg] = React.useState<string | null>(null);
  const ok = (m: string) => {
    setOkMsg(m);
    setTimeout(() => setOkMsg(null), 3500);
  };
  const err = (m: string) => {
    setErrMsg(m);
    setTimeout(() => setErrMsg(null), 4500);
  };

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (limit !== "") qs.set("limit", String(limit));
      if (offset !== "") qs.set("offset", String(offset));
      if (deliveryType !== "") qs.set("deliveryType", String(deliveryType));
      const res = await fetch(`/yuksi/corporate/jobs?${qs.toString()}`, {
        headers,
        cache: "no-store",
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false)
        throw new Error(pickMsg(j, `HTTP ${res.status}`));
      const list = Array.isArray(j?.data) ? j.data : [];
      const mapped: CorporateJob[] = list.map((x: any) => ({
        id: String(x?.id),
        deliveryType:
          x?.deliveryType === "scheduled" ? "scheduled" : "immediate",
        carrierType: String(x?.carrierType ?? ""),
        commissionRate: Number(x?.commissionRate ?? 0) || undefined,
        commissionDescription: String(x?.commissionDescription ?? undefined),
        vehicleType: String(x?.vehicleType ?? ""),
        pickupAddress: String(x?.pickupAddress ?? ""),
        dropoffAddress: String(x?.dropoffAddress ?? ""),
        specialNotes: x?.specialNotes ?? "",
        totalPrice: x?.totalPrice != null ? Number(x.totalPrice) : undefined,
        paymentMethod: x?.paymentMethod ?? undefined,
        createdAt: x?.createdAt ?? undefined,
        imageFileIds: Array.isArray(x?.imageFileIds)
          ? x.imageFileIds
          : undefined,
        deliveryDate: x?.deliveryDate ?? null,
        deliveryTime: x?.deliveryTime ?? null,
      }));
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message || "Kayıtlar alınamadı.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    loadList(); /* mount */
  }, []);

  /* ---------- Route viewer ---------- */
  // basit cache
  const geoCache = React.useRef<Map<string, LatLng>>(new Map());

  async function geocodeOnce(address: string): Promise<LatLng> {
    const key = address.trim();
    if (!key) throw new Error("Adres boş.");
    const c = geoCache.current.get(key);
    if (c) return c;

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "0");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", key);
    const res = await fetch(url.toString(), {
      headers: { "Accept-Language": "tr" },
    });
    const arr = (await res.json()) as any[];
    if (!arr?.length) throw new Error("Adres bulunamadı: " + key);
    const lat = Number(arr[0].lat),
      lng = Number(arr[0].lon);
    const v = { lat, lng };
    geoCache.current.set(key, v);
    return v;
  }

  async function showRoute(r: CorporateJob) {
    setRouteOpen(true);
    setRouteFor(r);
    setRouteLoading(true);
    setRouteErr(null);
    setStart(null);
    setEnd(null);

    try {
      const [s, e] = await Promise.all([
        geocodeOnce(r.pickupAddress),
        geocodeOnce(r.dropoffAddress),
      ]);
      setStart(s);
      setEnd(e);
    } catch (e: any) {
      setRouteErr(e?.message || "Konumlar getirilemedi.");
    } finally {
      setRouteLoading(false);
    }
  }

  async function showEdit(row: CorporateJob) {
    setEditing({ ...row });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editing) return;
    setEditBusy(true);
    try {
      const id = editing.id;
      const body = {
        carrierType: editing.carrierType ?? "",
        vehicleType: editing.vehicleType ?? "",
        pickupAddress: editing.pickupAddress ?? "",
        dropoffAddress: editing.dropoffAddress ?? "",
      };
      const res = await fetch(`/yuksi/corporate/jobs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      const j = await readJson(res);
      if (!res.ok) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      ok("Yük güncellendi.");
      setEditOpen(false);
      await loadList();
    } catch (e: any) {
      err(e?.message || "Güncelleme başarısız.");
    } finally {
      setEditBusy(false);
    }
  }

  async function onDelete(id: number | string) {
    if (!confirm("Bu yükü silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(`/yuksi/corporate/jobs/${id}`, {
        method: "DELETE",
        headers,
      });
      const j = await readJson(res);
      if (!res.ok) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      ok("Yük silindi.");
      await loadList();
    } catch (e: any) {
      err(e?.message || "Silme işlemi başarısız.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Yük Listesi (Kurumsal)
          </h1>
          <p className="text-sm text-neutral-600">
            Kurumsal üyenin oluşturduğu yükleri görüntüle.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between bg-[#fff4ee] border border-neutral-200 rounded-2xl px-6 py-4 gap-4">
        <div className="flex flex-col">
          <label htmlFor="limit">Limit</label>
          <input
            type="number"
            min={1}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            value={limit}
            onChange={(e) =>
              setLimit(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="limit"
            title="limit"
            name="limit"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="offset">Offset</label>
          <input
            type="number"
            min={1}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            value={offset}
            onChange={(e) =>
              setOffset(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="offset"
            title="offset"
            name="offset"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="type">Teslimat Türü</label>
          <select
            id="types"
            name="types"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            value={deliveryType}
            onChange={(e) =>
              setDeliveryType(e.target.value === "" ? "" : e.target.value)
            }
          >
            <option value="">Hepsi</option>
            <option value="immediate">Bugün</option>
            <option value="scheduled">Randevulu</option>
          </select>
        </div>
        <button
          onClick={loadList}
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-yellow-300 bg-[#ff5b04] text-white"
        >
          ARA
        </button>
      </div>

      {(okMsg || errMsg || error) && (
        <div className="space-y-2">
          {okMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {okMsg}
            </div>
          )}
          {(errMsg || error) && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errMsg || error}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm text-center">
        <div className="overflow-x-auto">
          <div className="min-w-full border-t border-neutral-200/70">
            <div className="hidden md:grid md:grid-cols-9 text-sm text-neutral-500 border-b text-center">
              <div className="px-6 py-3 font-medium">ID</div>
              <div className="px-6 py-3 font-medium">Teslim Tipi</div>
              <div className="px-6 py-3 font-medium">Taşıyıcı / Araç</div>
              <div className="px-6 py-3 font-medium">Alım</div>
              <div className="px-6 py-3 font-medium">Teslim</div>
              <div className="px-6 py-3 font-medium">Fiyat</div>
              <div className="px-6 py-3 font-medium">Ödeme</div>
              <div className="px-6 py-3 font-medium">Oluşturma</div>
              <div className="px-6 py-3 font-medium">İşlemler</div>
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                className="border-b border-neutral-200/70 md:grid md:grid-cols-9 hover:bg-neutral-50 bg-[#FFF4EE]"
              >
                <div className="px-6 py-3">{r.id}</div>
                <div className="px-3 py-3 text-center md:text-left">
                  <div className="md:hidden text-[11px] text-neutral-500">
                    Teslim Tipi
                  </div>
                  {r.deliveryType === "immediate" ? (
                    "immediate"
                  ) : (
                    <span
                      title={`${r.deliveryDate ?? ""} ${r.deliveryTime ?? ""}`}
                    >
                      scheduled
                    </span>
                  )}
                </div>
                <div className="px-6 py-3">
                  <div className="md:hidden text-[11px] text-neutral-500">
                    Taşıyıcı / Araç
                  </div>
                  {r.carrierType} • {r.vehicleType}
                </div>
                <div className="px-6 py-3">
                  <div className="md:hidden text-[11px] text-neutral-500">
                    Alım
                  </div>
                  {r.pickupAddress}
                </div>
                <div className="px-6 py-3">
                  <div className="md:hidden text-[11px] text-neutral-500">
                    Teslim
                  </div>
                  {r.dropoffAddress}
                </div>
                <div className="px-6 py-3">
                  <div className="md:hidden text-[11px] text-neutral-500">
                    Fiyat
                  </div>
                  {r.totalPrice != null ? `${r.totalPrice}₺` : "—"}
                  <div>
                    {r.commissionRate != null && r.commissionRate > 0 && (
                      <span className="text-xs text-neutral-500">
                        Komisyon: {`${ r.totalPrice! *  r.commissionRate / 100 } (${r.commissionRate}%)`} <br />
                        Taşıyıcı Ödemesi: {`${ r.totalPrice! - ( r.totalPrice! *  r.commissionRate / 100) }₺`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="px-6 py-3">
                  <div className="md:hidden text-[11px] text-neutral-500">
                    Ödeme
                  </div>
                  {r.paymentMethod ?? "—"}
                  </div>
                <div className="px-6 py-3">
                  <div className="md:hidden text-[11px] text-neutral-500">
                    Oluşturma
                  </div>  
                  {fmtDT(r.createdAt)}
                </div>
                <div className="px-6 py-3">
                  <div className="md:hidden text-[11px] text-neutral-500">
                    İşlemler
                  </div>
                  <div className="flex flex-wrap items-center gap-2 justify-center">
                    <button
                      onClick={() => showRoute(r)}
                      className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                    >
                      Haritada Göster
                    </button>
                    <button
                      onClick={() => showEdit(r)}
                      className="rounded-md bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => onDelete(r.id)}
                      className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {rows.length === 0 && !loading && (
              <div>
                <div
                  colSpan={9}
                  className="px-6 py-10 text-center text-sm text-neutral-500"
                >
                  Kayıt bulunamadı.
                </div>
              </div>
            )}
          </div>
        </div>
        {loading && (
          <div className="px-6 py-3 text-sm text-neutral-500">Yükleniyor…</div>
        )}
      </section>

      {/* Route Modal */}
      {routeOpen && routeFor && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setRouteOpen(false)}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-semibold">
                Rota:{" "}
                <span className="font-normal">{routeFor.pickupAddress}</span> ➜{" "}
                <span className="font-normal">{routeFor.dropoffAddress}</span>
              </h3>
              <button
                onClick={() => setRouteOpen(false)}
                className="rounded-full p-2 hover:bg-neutral-100"
              >
                ✕
              </button>
            </div>

            {routeErr && (
              <div className="m-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {routeErr}
              </div>
            )}
            {routeLoading && (
              <div className="p-4 text-sm text-neutral-500">
                Konumlar yükleniyor…
              </div>
            )}

            {!routeLoading && !routeErr && start && end && (
              <div className="p-4">
                <div
                  style={{ height: 420 }}
                  className="rounded-xl overflow-hidden"
                >
                  <RouteMap start={start} end={end} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {editOpen && editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold">Yük Düzenle</div>
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-full p-2 hover:bg-neutral-100"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto grid gap-4 p-1 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Taşıyıcı Tipi
                </label>
                <select
                  value={editing.carrierType ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, carrierType: e.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                >
                  <option value="courier">Kurye</option>
                  <option value="minivan">Minivan</option>
                  <option value="panelvan">Panelvan</option>
                  <option value="truck">Kamyonet/Kamyon</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Araç Tipi
                </label>
                <input
                  value={editing.vehicleType ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, vehicleType: e.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Alım Adresi
                </label>
                <input
                  value={String(editing.pickupAddress ?? "")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      pickupAddress: e.target.value,
                    })
                  }
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Teslim Adresi
                </label>
                <input
                  value={String(editing.dropoffAddress ?? "")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      dropoffAddress: e.target.value,
                    })
                  }
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
              >
                İptal
              </button>
              <button
                onClick={saveEdit}
                disabled={editBusy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {editBusy ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Route Map (markers + polyline) ================= */

function FitBounds({ start, end }: { start: LatLng; end: LatLng }) {
  const map = useMap();
  React.useEffect(() => {
    try {
      map.fitBounds(
        [
          [start.lat, start.lng],
          [end.lat, end.lng],
        ],
        { padding: [30, 30] }
      );
    } catch {}
  }, [map, start, end]);
  return null;
}

function RouteMap({ start, end }: { start: LatLng; end: LatLng }) {
  const [points, setPoints] = React.useState<[number, number][]>([]);
  const [routeError, setRouteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const fetchRoute = async () => {
      setRouteError(null);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
        const j: any = await readJson(res);
        const coords: [number, number][] =
          j?.routes?.[0]?.geometry?.coordinates?.map((c: [number, number]) => [
            c[1],
            c[0],
          ]) ?? [];
        if (!coords.length) throw new Error("Rota bulunmadı");
        if (!cancelled) setPoints(coords);
      } catch (e: any) {
        console.error("OSRM route error, failing back to straight line:", e);
        if (!cancelled) {
          setRouteError("Rota hesaplanamadı, kuş uçuşu çizgi gösteriliyor.");
          setPoints([
            [start.lat, start.lng],
            [end.lat, end.lng],
          ]);
        }
      }
    };

    fetchRoute();
    return () => {
      cancelled = true;
    };
  }, [start.lat, start.lng, end.lat, end.lng]);

  const center: [number, number] = [
    (start.lat + end.lat) / 2,
    (start.lng + end.lng) / 2,
  ];
  const polyPositions = points.length
    ? (points as [number, number][])
    : ([
        [start.lat, start.lng],
        [end.lat, end.lng],
      ] as [number, number][]);

  return (
    <>
      {routeError && (
        <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-200">
          {routeError}
        </div>
      )}
      <MapContainer
        center={center}
        zoom={12}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <FitBounds start={start} end={end} />
        <CircleMarker
          center={[start.lat, start.lng]}
          radius={8}
          pathOptions={{ color: "#22c55e", weight: 3, fillOpacity: 0.9 }}
        >
          <Tooltip direction="top" offset={[0, -6]} opacity={1}>
            Alım Noktası
          </Tooltip>
        </CircleMarker>
        <CircleMarker
          center={[end.lat, end.lng]}
          radius={8}
          pathOptions={{ color: "#ef4444", weight: 3, fillOpacity: 0.9 }}
        >
          <Tooltip direction="top" offset={[0, -6]} opacity={1}>
            Teslim Noktası
          </Tooltip>
        </CircleMarker>
        {/* Basit rota görünümü: iki nokta arası çizgi */}
        <Polyline
          positions={polyPositions}
          pathOptions={{ weight: 4, opacity: 0.85 }}
        />
      </MapContainer>
    </>
  );
}
