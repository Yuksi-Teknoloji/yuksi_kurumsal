"use client";

import React from "react";
import { getAuthToken } from "@/src/utils/auth";
import { ChartBar } from "@/src/components/chart/CorporateChart";

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

type CorporateJob = {
  id: string;
  totalPrice?: number;
  commissionRate?: number;
};

export default function Charts() {
  const token = React.useMemo(() => getAuthToken(), []);

  const headers: HeadersInit = React.useMemo(
    () => ({
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  const [data, setData] = React.useState<CorporateJob[]>([]);

  const [loads, setLoads] = React.useState<any[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  async function loadList() {
    setError(null);
    try {
      const res = await fetch(`/yuksi/corporate/jobs`, {
        headers,
        cache: "no-store",
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false)
        throw new Error(pickMsg(j, `HTTP ${res.status}`));
      const list = Array.isArray(j?.data) ? j.data : [];
      const mapped: CorporateJob[] = list.map((x: any) => ({
        id: String(x?.id),
        totalPrice: x?.totalPrice != null ? Number(x.totalPrice) : undefined,
        commissionRate:
          x?.commissionRate != null ? Number(x.commissionRate) : undefined,
      }));
      setData(mapped);
    } catch (e: any) {
      setError(e?.message || "Kayıtlar alınamadı.");
      setData([]);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    loadList();
  }, []);

  if (error) {
    return (
      <div className="p-10 text-rose-600 whitespace-pre-wrap">{error}</div>
    );
  }

  return (
    <div className="flex flex-wrap">
      <div className="w-full max-w-[500px] h-[300px] bg-white rounded-md shadow">
        <div className="flex justify-between items-center p-3">
            <span className="text-sm font-semibold">Kurumsal Üye Komisyonları</span>
            <span className="bg-gray-100 px-2 py-1 text-sm fonst-semibold rounded">
                Toplam: {data.reduce((sum, job) => sum + (job.totalPrice! * (job.commissionRate! / 100) || 0), 0).toFixed(2)}₺
            </span> 
        </div>
        
        <ChartBar data={data}></ChartBar>
      </div>
    </div>
  );
}
