"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { RefreshCcw, MapPin, Loader2 } from "lucide-react";
import { getAuthToken } from "@/src/utils/auth";
import { Header } from "next/dist/lib/load-custom-routes";

const LiveLeafletMap = dynamic(
    () => import("@/src/components/map/LiveLeaflet").then((mod) => mod.default),
    { ssr: false }
);

type HeadersDict = HeadersInit;
const bearerHeaders = (token: string | null): HeadersDict => {
     const h: HeadersDict = { Accept: 'application/json' };
  if (token) (h as any).Authorization = `Bearer ${token}`;
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

type LeafletMarker = {
    id: string;
    name: string;
    phone: string;
    lat: number;
    lng: number;
};

export default function MapsPage() {
    return(
        <div>Maps</div>
    )
}
            