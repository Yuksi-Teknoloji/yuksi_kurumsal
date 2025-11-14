"use client";

import * as React from "react";
import { ChartPie, ChartLine } from "@/src/components/chart/RestaurantChart";
import { getAuthToken } from "@/src/utils/auth";

async function readJson<T = any>(res: Response): Promise<T> {
  const txt = await res.text().catch(() => "");
  try {
    return txt ? JSON.parse(txt) : ({} as any);
  } catch {
    return txt as any;
  }
}

const pickMsg = (d: any, fb: string) =>
  d?.message || d?.detail || d?.title || fb;

function getDayRange() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return { start: now, end: tomorrow };
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  return { start: monday, end: sunday };
}

function getMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth());
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: first, end: last };
}

function formatDateYMD(dt: Date) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function Charts() {
  const token = React.useMemo(getAuthToken, []);

  const headers = React.useMemo<HeadersInit>(() => {
    const h: HeadersInit = { Accept: "application/json" };
    if (token) (h as any).Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const [restaurants, setRestaurants] = React.useState<any[]>([]);
  const [option, setOption] = React.useState<string | number | null>(null);   
  const [option2, setOption2] = React.useState<string | number | null>(null);
  const [rangeOption, setRangeOption] = React.useState("daily");     

  const [orders, setOrders] = React.useState<any[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const [dataWithRange, setDataWithRange] = React.useState<any>(null);

  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [endDate, setEndDate] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (rangeOption === "daily") {
      const { start, end } = getDayRange();
      setStartDate(start);
      setEndDate(end);
    } else if (rangeOption === "weekly") {
      const { start, end } = getWeekRange();
      setStartDate(start);
      setEndDate(end);
    } else if (rangeOption === "monthly") {
      const { start, end } = getMonthRange();
      setStartDate(start);
      setEndDate(end);
    }
  }, [rangeOption]);

  const fetchRestaurants = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/yuksi/dealer/restaurants", {
        cache: "no-store",
        headers,
      });

      const json = await readJson(res);
      if (!res.ok) throw new Error(pickMsg(json, `HTTP ${res.status}`));

      const arr = json?.data ?? [];
      setRestaurants(arr);

      // Varsayılan seçim
      if (arr.length > 0) {
        if (!option) setOption(arr[0].id);
        if (!option2) setOption2(arr[0].id);
      }
    } catch (e: any) {
      setError(e?.message || "Veriler alınamadı.");
      setRestaurants([]);
    }
  }, [headers, option, option2]);

  React.useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  const fetchOrders = React.useCallback(async () => {
    if (!option) return;

    setError(null);
    try {
      const res = await fetch(
        `/yuksi/dealer/restaurants/${option}/order-history`,
        { cache: "no-store", headers }
      );

      const json = await readJson(res);
      if (!res.ok) throw new Error(pickMsg(json, `HTTP ${res.status}`));

      const arr = json?.data ?? [];
      setOrders(arr.orders ?? []);
    } catch (e: any) {
      setError(e?.message || "Veriler alınamadı.");
      setOrders([]);
    }
  }, [headers, option]);

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const fetchOrdersWithDateRange = React.useCallback(async () => {
    if (!startDate || !endDate || !option2) return;

    const params = new URLSearchParams();
    params.append("start_date", formatDateYMD(startDate));
    params.append("end_date", formatDateYMD(endDate));

    const res = await fetch(
      `/yuksi/dealer/restaurants/${option2}/order-history?${params.toString()}`,
      { cache: "no-store", headers }
    );

    const json = await readJson(res);

    setDataWithRange(json?.data);
  }, [headers, option2, startDate, endDate]);

  React.useEffect(() => {
    fetchOrdersWithDateRange();
  }, [fetchOrdersWithDateRange]);

  if (error) {
    return <div className="p-10 text-rose-600 whitespace-pre-wrap">{error}</div>;
  }

  if (!restaurants.length) {
    return <div className="p-10">Restoran bulunamadı.</div>;
  }
  if (!dataWithRange || !startDate || !endDate || !option2) {
    return <div className="p-10">Veriler yükleniyor...</div>;
  }

  return (
    <div className="flex flex-wrap justify-between gap-16">
      {/* ==================== LINE CHART ==================== */}
      <div className="w-full max-w-[500px] h-[300px] bg-white rounded-md shadow">
        <div className="flex justify-between items-center p-3">
          <select
            className="rounded border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
            value={rangeOption}
            onChange={(e) => setRangeOption(e.target.value)}
          >
            <option value="daily">Günlük</option>
            <option value="weekly">Haftalık</option>
            <option value="monthly">Aylık</option>
          </select>

          <select
            className="rounded border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
            value={option2 ?? ""}
            onChange={(e) => setOption2(e.target.value)}
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <span className="text-sm font-semibold">Sipariş Gelirleri</span>

          <span className="bg-gray-100 px-2 py-1 text-sm font-semibold rounded">
            Toplam: {dataWithRange?.total_amount || 0} &#8378;
          </span>
        </div>

        <ChartLine
          startDate={startDate}
          endDate={endDate}
          option={rangeOption}
          data={dataWithRange}
        />
      </div>

      {/* ==================== PIE CHART ==================== */}
      <div className="w-full max-w-[500px] h-[300px] bg-white rounded-md shadow">
        <div className="flex justify-between items-center p-3">
          <select
            className="rounded border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
            value={option ?? ""}
            onChange={(e) => setOption(e.target.value)}
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <span className="text-sm font-semibold">Sipariş Durumu</span>

          <span className="bg-gray-100 px-2 py-1 text-sm font-semibold rounded">
            Sipariş Sayısı: {orders.length}
          </span>
        </div>

        <ChartPie data={orders} title="Sipariş Dağılımı" />
      </div>
    </div>
  );
}