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
