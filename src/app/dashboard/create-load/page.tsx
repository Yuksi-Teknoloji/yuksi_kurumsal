"use client";

import React from "react";
import dynamic from "next/dynamic";
import { getAuthToken } from "@/src/utils/auth";

const MapPicker = dynamic(() => import("@/src/components/map/MapPicker"), {
  ssr: false,
});

type DeliveryTypeUI = "today" | "appointment";
type DeliveryTypeAPI = "immediate" | "scheduled";

type ExtraService = { name: string; price: number; serviceId: number };

type ExtraServiceKey = "extraStop" | "fragile" | "carryHelp";
const EXTRA_CATALOG: Record<ExtraServiceKey, { label: string; price: number; serviceId: number }> = {
  extraStop: { label: 'Durak Ekleme', price: 100, serviceId: 1 },
  fragile:   { label: 'Kırılabilir / Özenli Taşıma', price: 50,  serviceId: 2 },
  carryHelp: { label: 'Taşıma Yardımı', price: 100, serviceId: 3 },
};

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

function collectErrors(x: any): string {
  const msgs: string[] = [];
  if (x?.message) msgs.push(String(x.message));
  if (x?.data?.message) msgs.push(String(x.data.message));
  const err = x?.errors || x?.error || x?.detail;
  if (Array.isArray(err)) {
    err.forEach((e: any) => {
      if (typeof e === "string") msgs.push(e);
      else if (e && typeof e === "object") {
        const loc = Array.isArray(e.loc)
          ? e.loc.join(".")
          : String(e.loc) ?? "";
        const m = String(e.msg ?? e.message ?? e.detail ?? "");
        if (loc && m) msgs.push(`${loc}: ${m}`);
        else if (m) msgs.push(m);
      }
    });
  } else if (err && typeof err === "object") {
    for (const [k, v] of Object.keys(err)) {
      if (Array.isArray(v))
        (v as any[]).forEach((ei) => {
          msgs.push(`${k}: ${String(ei)}`);
        });
      else if (typeof v === "string") msgs.push(`${k}: ${v}`);
    }
  }
  return msgs.join(" | ");
}

const toTRDate = (d: string) => (d ? d.split('-').reverse().join('.') : '');
const toTRTime = (t: string) => t || "";
const toNum = (v: unknown) => {
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export default function CorporateCreateLoadPage() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersDict>(
    () => bearerHeaders(token),
    [token]
  );

  const [busy, setBusy] = React.useState(false);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  const [deliveryType, setDeliveryType] =
    React.useState<DeliveryTypeUI>("today");
  const [schedDate, setSchedDate] = React.useState("");
  const [schedTime, setSchedTime] = React.useState("");

  const [carrierType, setCarrierType] = React.useState("courier");
  const [vehicleType, setVehicleType] = React.useState("motorcycle");

  const [pickupAddress, setPickupAddress] = React.useState("");
  const [pLat, setPLat] = React.useState("");
  const [pLng, setPLng] = React.useState("");

  const [dropoffAddress, setDropoffAddress] = React.useState("");
  const [dLat, setDLat] = React.useState("");
  const [dLng, setDLng] = React.useState("");

  const [specialNotes, setSpecialNotes] = React.useState("");

  const [coupon, setCoupon] = React.useState("");
  const [couponApplied, setCouponApplied] = React.useState("");

  const [extraFlags, setExtraFlags] = React.useState<
    Record<ExtraServiceKey, boolean>
  >({
    extraStop: false,
    fragile: false,
    carryHelp: false,
  });

  const [basePrice, setBasePrice] = React.useState<number | "">("");
  const extrasTotal = React.useMemo(
    () =>
      (Object.keys(extraFlags) as ExtraServiceKey[])
        .filter((k) => extraFlags[k])
        .reduce((s, k) => s + EXTRA_CATALOG[k].price, 0),
    [extraFlags]
  );
  const computedTotal = Number(basePrice || 0) + extrasTotal;

  const [paymentMethod, setPaymentMethod] = React.useState<
    "cash" | "card" | "transfer" | ""
  >("");

  const [imageFileIds, setImageFileIds] = React.useState<string[]>("");
  const [newImageId, setNewImageId] = React.useState("");

  const toggleExtra = (k: ExtraServiceKey) =>
    setExtraFlags((p) => ({ ...p, [k]: !p[k] }));

  const applyCoupon = () => {
    if (coupon.trim()) setCouponApplied(coupon.trim());
  };

  const addImageId = () => {
    if (!newImageId.trim()) return;
    setImageFileIds((p) => [...p, newImageId.trim()]);
    setNewImageId("");
  };

  const removeImageId = (i: number) =>
    setImageFileIds((p) => p.filter((_, idx) => idx !== i));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    setErrMsg(null);

    if (!pickupAddress || !dropoffAddress) {
      setErrMsg("Pickup ve drop-off adreslerini girin.");
      return;
    }
    if (!paymentMethod) {
      setErrMsg("Ödeme yöntemini seçin.");
      return;
    }

    const deliveryTypeAPI: DeliveryTypeAPI =
      deliveryType === "today" ? "immediate" : "scheduled";

    if (deliveryTypeAPI === "scheduled" && (!schedDate || !schedTime)) {
      setErrMsg("Randevulu teslimat için tarih ve saat zorunlu");
      return;
    }

    const extraServices: ExtraService[] = (
      Object.keys(extraFlags) as ExtraServiceKey[]
    )
      .filter((k) => extraFlags[k])
      .map((k) => ({
        name: EXTRA_CATALOG[k].label,
        price: EXTRA_CATALOG[k].price,
        serviceId: EXTRA_CATALOG[k].serviceId,
      }));

    const body = {
      campainCode: couponApplied || coupon.trim() || undefined,

      carrierType,
      deliveryType: deliveryTypeAPI,
      deliveryDate:
        deliveryTypeAPI === "scheduled" ? toTRDate(schedDate) : undefined,
      deliveryTime:
        deliveryTypeAPI === "scheduled" ? toTRTime(schedTime) : undefined,

      dropoffAddress: dropoffAddress,
      dropoffCoordinates: [toNum(dLat), toNum(dLng)],

      pickupAddress: pickupAddress,
      pickupCoordinates: [toNum(pLat), toNum(pLng)],

      extraServices,
      extraServicesTotal: extrasTotal,

      imageFileIds,

      paymentMethod,
      specialNotes,
      totalPrice: computedTotal,
      vehicleType,
    };

    setBusy(true);
    try {
      const res = await fetch("/yuksi/corporate/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      const j = await readJson(res);
      if (!res.ok || j?.success === false) {
        throw new Error(collectErrors(j) || pickMsg(j, `HTTP ${res.status}`));
      }

      setOkMsg(j?.message || "Yeni yük kaydı oluşturuldu.");
      setDeliveryType("today");
      setSchedDate("");
      setSchedTime("");
      setPickupAddress("");
      setPLat("");
      setPLng("");
      setDropoffAddress("");
      setDLat("");
      setDLng("");
      setSpecialNotes("");
      setCoupon("");
      setCouponApplied(null);
      setExtraFlags({ extraStop: false, fragile: false, carryHelp: false });
      setBasePrice("");
      setPaymentMethod("");
      setImageFileIds([]);
      setNewImageId("");
      setCarrierType("courier");
      setVehicleType("motorcycle");
    } catch (e: Error) {
      setErrMsg(e?.message || "Kayıt oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Yeni Yük (Kurumsal)</h1>
        <span className="text-xs text-neutral-500">/api/corporate/jobs</span>
      </div>

      {okMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 whitespace-pre-line">
          {okMsg}
        </div>
      )}
      {errMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 whitespace-pre-line">
          {errMsg}
        </div>
      )}

      <section className="rounded-2xl border border-neutral 200/70 bg-white p-6 shadow-sm soft-card">
        <h2 className="mb-4 text-lg font-semibold">Gönderim Tipi</h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDeliveryType("today")}
            className={[
              "rounded-xl px-5 py-2 text-sm font-semibold shadow-sm border",
              deliveryType === "today"
                ? "bg-indigo-500 text-white border-indigo-500"
                : "bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50",
            ].join(" ")}
          >
            Bugün (immediate)
          </button>
          <button
            type="button"
            onClick={() => setDeliveryType('appointment')}
            className={[
              'rounded-xl px-5 py-2 text-sm font-semibold shadow-sm border',
              deliveryType === 'appointment'
                ? 'bg-indigo-500 text-white border-indigo-500'
                : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50',
            ].join(' ')}
          >
            Randevulu (scheduled)
          </button>
        </div>

        {deliveryType === 'appointment' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold">Teslim Tarihi</label>
              <input
                type="date"
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">Teslim Saati</label>
              <input
                type="time"
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
              />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm soft-card">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold">Taşıyıcı Tipi</label>
            <select
              value={carrierType}
              onChange={(e) => setCarrierType(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
            >
              <option value="courier">Kurye</option>
              <option value="minivan">Minivan</option>
              <option value="panelvan">Panelvan</option>
              <option value="truck">Kamyonet</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">Araç Tipi</label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
            >
              <option value="motorcycle">Motosiklet</option>
              <option value="threewheeler">3 Teker</option>
              <option value="hatchback">Hatchback</option>
              <option value="boxvan">Kapalı Kasa</option>
            </select>
          </div>
        </div>

        <MapPicker
          label="Pickup Konumu"
          value={
            pLat && pLng ? { lat: Number(pLat), lng: Number(pLng), address: pickupAddress || undefined } : null
          }
          onChange={(pos) => {
            setPLat(String(pos.lat)); setPLng(String(pos.lng));
            if (pos.address) setPickupAddress(pos.address);
          }}
        />

        <MapPicker
          label="Drop-off Konumu"
          value={
            dLat && dLng ? { lat: Number(dLat), lng: Number(dLng), address: dropoffAddress || undefined } : null
          }
          onChange={(pos) => {
            setDLat(String(pos.lat)); setDLng(String(pos.lng));
            if (pos.address) setDropoffAddress(pos.address);
          }}
        />

        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold">Özel Notlar</label>
          <textarea
            rows={4}
            value={specialNotes}
            onChange={(e) => setSpecialNotes(e.target.value)}
            placeholder="Paketin sıcak gitmesi gerekiyor…"
            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm soft-card">
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold">Kampanya Kodu</label>
          <div className="flex overflow-hidden rounded-xl border border-neutral-300">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="Kod"
              className="w-full bg-neutral-100 px-3 py-2 outline-none"
            />
            <button type="button" onClick={applyCoupon} className="bg-rose-50 px-4 text-rose-600 hover:bg-rose-100">
              Uygula
            </button>
          </div>
          {couponApplied && <div className="mt-2 text-sm text-emerald-600">“{couponApplied}” uygulandı.</div>}
        </div>

        <div className="mb-2 text-sm font-semibold">Ek Hizmetler</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(EXTRA_CATALOG) as ExtraServiceKey[]).map((k) => (
            <label key={k} className="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 hover:bg-neutral-50">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={extraFlags[k]} onChange={() => toggleExtra(k)} className="h-4 w-4" />
                <span className="text-sm">{EXTRA_CATALOG[k].label}</span>
              </div>
              <span className="text-sm font-semibold">{EXTRA_CATALOG[k].price}₺</span>
            </label>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-semibold">Taban Ücret (₺)</label>
            <input
              type="number"
              min={0}
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div className="self-end text-sm">
            <div><span className="font-semibold">Ek Hizmet Toplamı: </span>{extrasTotal}₺</div>
            <div><span className="font-semibold">Genel Toplam: </span>{computedTotal}₺</div>
          </div>
        </div>

        {/* Ödeme yöntemi */}
        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold">Ödeme Yöntemi</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as any)}
            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
          >
            <option value="">Seçiniz</option>
            <option value="cash">Nakit (cash)</option>
            <option value="card">Kart (card)</option>
            <option value="transfer">Havale/EFT (transfer)</option>
          </select>
        </div>

        <div className="mt-6 space-y-2">
          <label className="block text-sm font-semibold">Image File IDs (UUID)</label>
          <div className="flex gap-2">
            <input
              value={newImageId}
              onChange={(e) => setNewImageId(e.target.value)}
              placeholder="f232f2b8-2e42-46f8-b3b5-d91a62f8b001"
              className="flex-1 rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-sky-200"
            />
            <button type="button" onClick={addImageId} className="rounded-xl bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-900">
              Ekle
            </button>
          </div>
          {imageFileIds.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-neutral-700">
              {imageFileIds.map((id, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="truncate">{id}</span>
                  <button
                    type="button"
                    onClick={() => removeImageId(i)}
                    className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                  >
                    Sil
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:opacity-60"
        >
          {busy ? 'Gönderiliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}
