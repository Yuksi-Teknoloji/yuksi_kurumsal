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

type ExtraServiceDTO = {
  id: string;
  service_name: string;
  price: number;
  carrier_type: string;
  created_at: string;
};

type ExtraServiceUI = {
  id: string;
  label: string;
  price: number;
  carrierType: string;
};

type CityPriceDTO = {
  id: string;
  route_name: string;
  country_id: number;
  state_id: number;
  city_id: number;
  courier_price: number;
  minivan_price: number;
  panelvan_price: number;
  kamyonet_price: number;
  kamyon_price: number;
};

type CityPriceUI = {
  id: string;
  label: string;
  countryId: number;
  stateId: number;
  cityId: number;
  stateName: string;
  cityName: string;
  courier: number;
  minivan: number;
  panelvan: number;
  kamyonet: number;
  kamyon: number;
};

type VehicleProductDTO = {
  id: string;
  productName: string;
  productCode: string;
  productTemplate: string;
  vehicleFeatures?: string[];
  isActive?: boolean;
};

type VehicleProductUI = {
  id: string;
  name: string;
  code: string;
  template: string;
};

type CommissionMeDTO = {
  id: string;
  userType?: string;
  name?: string;
  surname?: string;
  commissionRate?: number | null;
  commissionDescription?: number | null;
};

type CommissionMeResponse = {
  success?: boolean;
  message?: string;
  data?: CommissionMeDTO;
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

const toTRDate = (d: string) => (d ? d.split("-").reverse().join(".") : "");
const toTRTime = (t: string) => t || "";
const toNum = (v: unknown) => {
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function pickCityBasePrice(
  p: CityPriceUI | undefined,
  carrierType: string
): number {
  if (!p) return 0;
  switch (carrierType) {
    case "courier":
      return p.courier;
    case "minivan":
      return p.minivan;
    case "panelvan":
      return p.panelvan;
    case "truck":
      return p.kamyonet || p.kamyon;
    default:
      return 0;
  }
}

const pickCityBasePriceByTemplate = (
  p: CityPriceUI | undefined,
  vehicleTemplate: string | undefined,
  carrierType: string
) => {
  if (!p) return 0;

  if (vehicleTemplate) {
    switch (vehicleTemplate) {
      case "motorcycle":
        return p.courier;
      case "minivan":
        return p.minivan;
      case "panelvan":
        return p.panelvan;
      case "kamyonet":
        return p.kamyonet;
      case "kamyon":
        return p.kamyon;
    }
  }

  return pickCityBasePrice(p, carrierType);
};

const VEHICLE_TEMPLATE_LABEL: Record<string, string> = {
  motorcycle: "Motorsiklet",
  minivan: "Minivan",
  panelvan: "Panelvan",
  kamyonet: "Kamyonet",
  kamyon: "Kamyon",
};

const normalizeAddress = (addr: string) => {
  if (!addr) return "";
  const lower = addr.toLowerCase();
  const keys = ["türkiye", "turkey"];

  let cutIdx = -1;
  let keyLen = 0;

  for (const k of keys) {
    const i = lower.indexOf(k);
    if (i !== -1 && (cutIdx === -1 || i < cutIdx)) {
      cutIdx = i;
      keyLen = k.length;
    }
  }

  let out = addr;
  if (cutIdx !== -1) out = addr.slice(0, cutIdx + keyLen);

  out = out.replace(/\s+,/g, ",").replace(/\s+,/g, ",").trim();
  return out;
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
  const [vehicleType, setVehicleType] = React.useState<string>("motorcycle");

  const [pickupAddress, setPickupAddress] = React.useState("");
  const [pLat, setPLat] = React.useState("");
  const [pLng, setPLng] = React.useState("");

  const [dropoffAddress, setDropoffAddress] = React.useState("");
  const [dLat, setDLat] = React.useState("");
  const [dLng, setDLng] = React.useState("");

  const [pickupCityName, setPickupCityName] = React.useState("");
  const [pickupStateName, setPickupStateName] = React.useState("");
  const [dropCityName, setDropCityName] = React.useState("");
  const [dropStateName, setDropStateName] = React.useState("");

  const [specialNotes, setSpecialNotes] = React.useState("");

  const [coupon, setCoupon] = React.useState("");
  const [couponApplied, setCouponApplied] = React.useState<string | null>("");

  const [extraServices, setExtraServices] = React.useState<ExtraServiceUI[]>(
    []
  );
  const [extrasSelected, setExtrasSelected] = React.useState<
    Record<string, boolean>
  >({});
  const [extrasLoading, setExtrasLoading] = React.useState(false);

  const [cityPrices, setCityPrices] = React.useState<CityPriceUI[]>([]);
  const [cityPricesLoading, setCityPricesLoading] = React.useState(false);
  const [cityPricesError, setCityPricesError] = React.useState<string | null>(
    null
  );

  const [distanceKm, setDistanceKm] = React.useState<number>(0);
  const [distanceLoading, setDistanceLoading] = React.useState(false);
  const [distanceError, setDistanceError] = React.useState<string | null>(null);

  const [commissionRate, setCommissionRate] = React.useState<number | null>(
    null
  );
  const [commissionDescription, setCommissionDescription] = React.useState<
    number | null
  >(null);
  const [commissionLoading, setCommissionLoading] = React.useState(false);
  const [commissionError, setCommissionError] = React.useState<string | null>(
    null
  );

  const [vehicleProducts, setVehicleProducts] = React.useState<
    VehicleProductUI[]
  >([]);
  const [vehicleProductsLoading, setVehicleProductsLoading] =
    React.useState(false);
  const [vehicleProductsError, setVehicleProductsError] = React.useState<
    string | null
  >(null);
  const [vehicleProductId, setVehicleProductId] = React.useState<string>("");

  const [paymentMethod, setPaymentMethod] = React.useState<
    "cash" | "card" | "transfer" | ""
  >("");

  const [imageFileIds, setImageFileIds] = React.useState<string[]>([]);
  const [newImageId, setNewImageId] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    const loadExtraServices = async () => {
      setExtrasLoading(true);
      try {
        const res = await fetch("/yuksi/admin/extra-services", {
          cache: "no-store",
          headers,
        });
        const j: any = await readJson(res);
        if (!res.ok || j?.success === false)
          throw new Error(pickMsg(j, `HTTP $(res.status)`));

        const list: ExtraServiceDTO[] = Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j)
          ? j
          : [];

        if (cancelled) return;

        const mapped: ExtraServiceUI[] = list.map((x) => ({
          id: String(x.id),
          label: x.service_name,
          price: Number(x.price) || 0,
          carrierType: x.carrier_type,
        }));

        setExtraServices(mapped);
        setExtrasSelected((prev) => {
          const next = { ...prev };
          for (const s of mapped)
            if (next[s.id] === undefined) next[s.id] = false;
          return next;
        });
      } catch (e: any) {
        if (!cancelled)
          setErrMsg(
            (prev) => prev || e?.message || "Ek hizmetler yüklenemedi."
          );
      } finally {
        if (!cancelled) setExtrasLoading(false);
      }
    };

    loadExtraServices();
    return () => {
      cancelled = true;
    };
  }, [headers]);

  React.useEffect(() => {
    let cancelled = false;

    const loadVehicleProducts = async () => {
      setVehicleProductsLoading(true);
      setVehicleProductsError(null);
      try {
        const res = await fetch("/yuksi/admin/vehicles", {
          cache: "no-store",
          headers,
        });
        const j: any = await readJson(res);
        if (!res.ok || j?.success === false)
          throw new Error(pickMsg(j, `HTTP ${res.status}`));

        const list: VehicleProductDTO[] = Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j)
          ? j
          : [];

        if (cancelled) return;

        const mapped: VehicleProductUI[] = list
          .filter((v) => v.isActive !== false)
          .map((v) => ({
            id: String(v.id),
            name: v.productName,
            code: v.productCode,
            template: v.productTemplate,
          }));

        setVehicleProducts(mapped);

        if (!vehicleProductId && mapped.length) {
          setVehicleProductId(mapped[0].id);
          setVehicleType(mapped[0].template);
        }
      } catch (e: any) {
        if (!cancelled)
          setVehicleProductsError(e?.message || "Araç ürünleri alınamadı.");
      } finally {
        if (!cancelled) setVehicleProductsLoading(false);
      }
    };

    loadVehicleProducts();
    return () => {
      cancelled = true;
    };
  }, [headers, vehicleProductId]);

  React.useEffect(() => {
    let cancelled = false;

    const loadCityPrices = async () => {
      setCityPricesLoading(true);
      setCityPricesError(null);
      try {
        const res = await fetch("/yuksi/admin/city-prices", {
          cache: "no-store",
          headers,
        });
        const j: any = await readJson(res);
        if (!res.ok || j?.success === false)
          throw new Error(pickMsg(j, `HTTP ${res.status}`));

        const list: CityPriceDTO[] = Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j)
          ? j
          : [];

        if (cancelled) return;

        const countryIds = new Set<number>();
        const stateIds = new Set<number>();

        for (const x of list) {
          if (Number.isFinite(Number(x.country_id)))
            countryIds.add(Number(x.country_id));
          if (Number.isFinite(Number(x.state_id)))
            stateIds.add(Number(x.state_id));
        }

        const stateMap = new Map<number, string>();
        await Promise.all(
          Array.from(countryIds).map(async (cid) => {
            const url = new URL("/yuksi/geo/states", location.origin);
            url.searchParams.set("country_id", String(cid));
            url.searchParams.set("limit", "500");
            url.searchParams.set("offset", "0");
            const r = await fetch(url.toString(), { cache: "no-store" });
            const d: any = await readJson(r);
            if (r.ok) {
              const arr: any[] = Array.isArray(d)
                ? d
                : Array.isArray(d?.data)
                ? d.data
                : [];
              for (const s of arr) {
                const sid = Number(s?.id);
                const name = String(s?.name ?? "");
                if (Number.isFinite(sid) && name) stateMap.set(sid, name);
              }
            }
          })
        );

        const cityMap = new Map<number, string>();
        await Promise.all(
          Array.from(stateIds).map(async (sid) => {
            const url = new URL("/yuksi/geo/cities", location.origin);
            url.searchParams.set("state_id", String(sid));
            url.searchParams.set("limit", "1000");
            url.searchParams.set("offset", "0");
            const r = await fetch(url.toString(), { cache: "no-store" });
            const d: any = await readJson(r);
            if (r.ok) {
              const arr: any[] = Array.isArray(d)
                ? d
                : Array.isArray(d?.data)
                ? d.data
                : [];
              for (const c of arr) {
                const cid = Number(c?.id);
                const name = String(c?.name ?? "");
                if (Number.isFinite(cid) && name) cityMap.set(cid, name);
              }
            }
          })
        );

        if (cancelled) return;

        const mapped: CityPriceUI[] = list.map((x) => ({
          id: String(x.id),
          label: String(x.route_name ?? ""),
          countryId: Number(x.country_id),
          stateId: Number(x.state_id),
          cityId: Number(x.city_id),
          stateName: stateMap.get(Number(x.state_id)) ?? "",
          cityName: cityMap.get(Number(x.city_id)) ?? "",
          courier: Number(x.courier_price ?? 0),
          minivan: Number(x.minivan_price ?? 0),
          panelvan: Number(x.panelvan_price ?? 0),
          kamyonet: Number(x.kamyonet_price ?? 0),
          kamyon: Number(x.kamyon_price ?? 0),
        }));

        setCityPrices(mapped);
      } catch (e: any) {
        if (!cancelled)
          setCityPricesError(e?.message || "Şehir fiyatları alınamadı.");
      } finally {
        if (!cancelled) setCityPricesLoading(false);
      }
    };

    loadCityPrices();

    return () => {
      cancelled = true;
    };
  }, [headers]);

  React.useEffect(() => {
    const lat1 = toNum(pLat);
    const lon1 = toNum(pLng);
    const lat2 = toNum(dLat);
    const lon2 = toNum(dLng);

    if (
      !pLat ||
      !pLng ||
      !dLat ||
      !dLng ||
      !Number.isFinite(lat1) ||
      !Number.isFinite(lon1) ||
      !Number.isFinite(lat2) ||
      !Number.isFinite(lon2)
    ) {
      setDistanceKm(0);
      setDistanceError(null);
      setDistanceLoading(false);
      return;
    }

    const controller = new AbortController();
    setDistanceLoading(true);
    setDistanceError(null);

    const calcRouteDistance = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false&alternatives=false&steps=false`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
        const j = await readJson<any>(res);
        const meters = j?.routes?.[0]?.distance;
        if (!meters && meters !== 0)
          throw new Error("OSRM response missing distance");
        setDistanceKm(meters / 1000);
        setDistanceError(null);
      } catch (e: any) {
        console.error("OSRM distance error:", e);
        setDistanceKm(0);
        setDistanceError(
          "Rota mesafesi hesaplanamadı. Lütfen konumları veya adresleri kontrol edin."
        );
      } finally {
        if (!controller.signal.aborted) setDistanceLoading(false);
      }
    };

    calcRouteDistance();
    return () => controller.abort();
  }, [pLat, pLng, dLat, dLng]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCommission() {
      setCommissionLoading(true);
      setCommissionError(null);
      try {
        const res = await fetch("/yuksi/admin/users/commission/", {
          cache: "no-store",
          headers,
        });
        const j: CommissionMeResponse | any = await readJson(res);
        if (!res.ok || j?.success === false)
          throw new Error(pickMsg(j, `HTTP ${res.status}`));

        const d = j?.data as CommissionMeDTO | undefined;
        if (!d) throw new Error("Komisyon bilgisi bulunamadı.");

        if (!cancelled) {
          const rate = Number(d.commissionRate ?? 0);
          setCommissionRate(Number.isFinite(rate) ? rate : 0);
          setCommissionDescription(d.commissionDescription ?? null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setCommissionRate(null);
          setCommissionError(e?.message || "Komisyon oranı getirilemedi.");
        }
      } finally {
        if (!cancelled) setCommissionLoading(false);
      }
    }
    loadCommission();
    return () => {
      cancelled = true;
    };
  }, [headers]);

  const baseKmPrice = React.useMemo(() => {
    if (!cityPrices.length) return 0;

    const city = (dropCityName || pickupCityName || "").toLowerCase().trim();
    const state = (dropStateName || pickupStateName || "").toLowerCase().trim();

    if (!city || !state) return 0;

    let match: CityPriceUI | undefined = cityPrices.find(
      (p) =>
        p.cityName.toLowerCase() === city && p.stateName.toLowerCase() === state
    );

    if (!match)
      match = cityPrices.find((p) => p.stateName.toLowerCase() === state);

    const selectedVehicle = vehicleProducts.find(
      (v) => v.id === vehicleProductId
    );
    const template = selectedVehicle?.template || vehicleType;

    return pickCityBasePriceByTemplate(match, template, carrierType);
  }, [
    cityPrices,
    carrierType,
    pickupCityName,
    pickupStateName,
    dropCityName,
    dropStateName,
    vehicleProducts,
    vehicleProductId,
    vehicleType,
  ]);

  const basePrice = React.useMemo(() => {
    if (!distanceKm || !baseKmPrice) return 0;
    return Math.round(distanceKm * baseKmPrice);
  }, [distanceKm, baseKmPrice]);

  const extrasTotal = React.useMemo(
    () =>
      extraServices
        .filter((s) => extrasSelected[s.id])
        .reduce((sum, s) => sum + s.price, 0),
    [extraServices, extrasSelected]
  );

  const computedTotal = basePrice + extrasTotal;

  const corporateCommission = React.useMemo(() => {
    if (!commissionRate || commissionRate <= 0 || !computedTotal) return 0;
    return Math.round((computedTotal * commissionRate) / 100);
  }, [commissionRate, computedTotal]);

  const carrierPayment = React.useMemo(
    () =>
      computedTotal && corporateCommission
        ? computedTotal - corporateCommission
        : 0,
    [computedTotal, corporateCommission]
  );

  const toggleExtra = (id: string) =>
    setExtrasSelected((p) => ({ ...p, [id]: !p[id] }));

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

    if (!basePrice || basePrice <= 0) {
      setErrMsg(
        distanceError
          ? distanceError
          : "Seçilen şehir/ilçe, araç ürünü veya mesafe için fiyat hesaplanamadı. Lütfen önce admin panelinden city-prices tanımlayın ve adresleri/konumları kontrol edin."
      );
      return;
    }

    const selectedExtras = extraServices.filter((s) => extrasSelected[s.id]);
    const extraServicesPayload: ExtraService[] = selectedExtras.map(
      (s, index) => ({
        name: s.label,
        price: s.price,
        serviceId: index + 1,
      })
    );

    const normPickupAddress = normalizeAddress(pickupAddress);
    const normDropoffAddress = normalizeAddress(dropoffAddress);

    const body = {
      campaignCode: couponApplied || coupon.trim() || undefined,

      carrierType,
      deliveryType: deliveryTypeAPI,
      deliveryDate:
        deliveryTypeAPI === "scheduled" ? toTRDate(schedDate) : undefined,
      deliveryTime:
        deliveryTypeAPI === "scheduled" ? toTRTime(schedTime) : undefined,

      dropoffAddress: normDropoffAddress,
      dropoffCoordinates: [toNum(dLat), toNum(dLng)] as [number, number],

      pickupAddress: normPickupAddress,
      pickupCoordinates: [toNum(pLat), toNum(pLng)] as [number, number],

      extraServices: extraServicesPayload,
      extraServicesTotal: extrasTotal,

      imageFileIds,

      paymentMethod,
      specialNotes,
      totalPrice: computedTotal,
      vehicleProductId: vehicleProductId || undefined,
    };

    setBusy(true);
    try {
      const res = await fetch("/yuksi/corporate/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      const j = await readJson<any>(res);
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
      setPickupCityName("");
      setPickupStateName("");
      setDropCityName("");
      setDropStateName("");
      setSpecialNotes("");
      setCoupon("");
      setCouponApplied(null);
      setExtrasSelected(() => {
        const next: Record<string, boolean> = {};
        for (const s of extraServices) next[s.id] = false;
        return next;
      });
      setPaymentMethod("");
      setImageFileIds([]);
      setNewImageId("");
      setCarrierType("courier");
      setVehicleProductId(vehicleProducts[0]?.id ?? "");
      setVehicleType(vehicleProducts[0]?.template ?? "motorcycle");
      setDistanceKm(0);
      setDistanceError(null);
    } catch (e: any) {
      setErrMsg(e?.message || "Kayıt oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  const selectedVehicle = vehicleProducts.find(
    (v) => v.id === vehicleProductId
  );

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
            onClick={() => setDeliveryType("appointment")}
            className={[
              "rounded-xl px-5 py-2 text-sm font-semibold shadow-sm border",
              deliveryType === "appointment"
                ? "bg-indigo-500 text-white border-indigo-500"
                : "bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50",
            ].join(" ")}
          >
            Randevulu (scheduled)
          </button>
        </div>

        {deliveryType === "appointment" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Teslim Tarihi
              </label>
              <input
                type="date"
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Teslim Saati
              </label>
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
            <label className="mb-2 block text-sm font-semibold">
              Taşıyıcı Tipi
            </label>
            <select
              value={carrierType}
              onChange={(e) => setCarrierType(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
            >
              <option value="courier">Kurye</option>
              <option value="minivan">Minivan</option>
              <option value="panelvan">Panelvan</option>
              <option value="truck">Kamyonet/Kamyon</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Araç Ürünü
            </label>
            <select
              value={vehicleProductId}
              onChange={(e) => {
                setVehicleProductId(e.target.value);
                const v = vehicleProducts.find(
                  (vv) => vv.id === e.target.value
                );
                if (v) setVehicleType(v.template);
              }}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
            >
              <option value="">Seçiniz</option>
              {vehicleProducts.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.code})
                </option>
              ))}
            </select>
            {vehicleProductsLoading && (
              <p className="mt-1 text-xs text-neutral-500">
                Araç ürünleri yükleniyor...
              </p>
            )}
            {vehicleProductsError && (
              <p className="mt-1 text-xs text-rose-600">
                {vehicleProductsError}
              </p>
            )}
            {selectedVehicle && (
              <p className="mt-1 text-xs text-neutral-500">
                Seçilen şablon:
                {VEHICLE_TEMPLATE_LABEL[selectedVehicle.template] ??
                  selectedVehicle.template}
              </p>
            )}
          </div>
        </div>

        <MapPicker
          label="Pickup Konumu"
          value={
            pLat && pLng
              ? {
                  lat: Number(pLat),
                  lng: Number(pLng),
                  address: pickupAddress || undefined,
                }
              : null
          }
          onChange={(pos) => {
            setPLat(String(pos.lat));
            setPLng(String(pos.lng));
            if (pos.address) setPickupAddress(normalizeAddress(pos.address));
            if (pos.cityName) setPickupCityName(String(pos.cityName));
            if (pos.stateName) setPickupStateName(String(pos.stateName));
          }}
        />

        <MapPicker
          label="Drop-off Konumu"
          value={
            dLat && dLng
              ? {
                  lat: Number(dLat),
                  lng: Number(dLng),
                  address: dropoffAddress || undefined,
                }
              : null
          }
          onChange={(pos) => {
            setDLat(String(pos.lat));
            setDLng(String(pos.lng));
            if (pos.address) setDropoffAddress(normalizeAddress(pos.address));
            if (pos.cityName) setDropCityName(String(pos.cityName));
            if (pos.stateName) setDropStateName(String(pos.stateName));
          }}
        />

        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold">
            Özel Notlar
          </label>
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
          <label className="mb-2 block text-sm font-semibold">
            Kampanya Kodu
          </label>
          <div className="flex overflow-hidden rounded-xl border border-neutral-300">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="Kod"
              className="w-full bg-neutral-100 px-3 py-2 outline-none"
            />
            <button
              type="button"
              onClick={applyCoupon}
              className="bg-rose-50 px-4 text-rose-600 hover:bg-rose-100"
            >
              Uygula
            </button>
          </div>
          {couponApplied && (
            <div className="mt-2 text-sm text-emerald-600">
              “{couponApplied}” uygulandı.
            </div>
          )}
        </div>

        <div className="mb-2 text-sm font-semibold">Ek Hizmetler</div>
        {extrasLoading && (
          <div className="mb-2 text-sm text-neutral-500">
            Ek hizmetler yükleniyor...
          </div>
        )}

        {!extrasLoading && extraServices.length === 0 && (
          <div className="mb-4 text-sm text-neutral-500">
            Tanımlı ek hizmet bulunmuyor.
          </div>
        )}

        {extraServices.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid cols-3">
            {extraServices.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 hover:bg-neutral-50"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!extrasSelected[s.id]}
                    onChange={() => toggleExtra(s.id)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">
                    {s.label} ({s.carrierType})
                  </span>
                </div>
                <span className="text-sm font-semibold">
                  {s.price.toFixed(0)} ₺
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-semibold">
              Taban Ücret (₺)
            </label>
            <div className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-900">
              {cityPricesLoading || distanceLoading
                ? "Şehir fiyatları veya mesafe hesaplanıyor..."
                : basePrice > 0
                ? `${basePrice}₺` +
                  (distanceKm && baseKmPrice
                    ? `(≈ ${distanceKm.toFixed(1)} km × ${baseKmPrice.toFixed(
                        0
                      )}₺/km)`
                    : "")
                : cityPricesError || distanceError
                ? `Hata: ${cityPricesError || distanceError}`
                : "Şehir/ilçe, araç ürünü veya mesafe için fiyat bulunamadı."}
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              Km başı fiyat admin panelindeki <code>city-prices</code>{" "}
              tablosundan, mesafe ise OSRM rota serivisi üzerinden otomatik
              hesaplanır.
            </div>
          </div>
          <div className="self-end text-sm">
            <div>
              <span className="font-semibold">Ek Hizmet Toplamı: </span>
              {extrasTotal}₺
            </div>
            <div>
              <span className="font-semibold">Genel Toplam: </span>
              {computedTotal}₺
            </div>
          </div>

          <div className="self-end text-sm">
            <div className="mb-1">
              <div className="font-semibold">Komisyon Oranı: </div>
              {commissionLoading
                ? "Yükleniyor..."
                : commissionRate !== null
                ? `${commissionRate}%`
                : "Tanımlı Değil"}
            </div>
            {commissionError && (
              <div className="mb-1 text-xs text-rose-700">
                {commissionError}
              </div>
            )}
            {commissionDescription && (
              <div className="mb-1 text-xs text-neutral-500">
                {commissionDescription}
              </div>
            )}
            <div>
              <span className="font-semibold">Kurumsal Üye Komisyonu: </span>
              {commissionRate != null && commissionRate > 0 && computedTotal > 0
                ? `${corporateCommission}₺ (toplam ${computedTotal}₺ × ${commissionRate}% - bayinin alacağı ödeme)`
                : "-"}
            </div>
            <div>
              <span className="font-semibold">Taşıyıcı Ödemesi: </span>
              {commissionRate != null && commissionRate > 0 && computedTotal > 0
                ? `${carrierPayment}₺ (taşıyıcının alacağı ödeme)`
                : "-"}
            </div>
          </div>
        </div>

        {/* Ödeme yöntemi */}
        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold">
            Ödeme Yöntemi
          </label>
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
          <label className="block text-sm font-semibold">
            Image File IDs (UUID)
          </label>
          <div className="flex gap-2">
            <input
              value={newImageId}
              onChange={(e) => setNewImageId(e.target.value)}
              placeholder="f232f2b8-2e42-46f8-b3b5-d91a62f8b001"
              className="flex-1 rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-sky-200"
            />
            <button
              type="button"
              onClick={addImageId}
              className="rounded-xl bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-900"
            >
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
          {busy ? "Gönderiliyor…" : "Kaydet"}
        </button>
      </div>
    </form>
  );
}
