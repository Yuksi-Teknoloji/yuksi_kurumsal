"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const LogisticsTracking = dynamic(() => import("./LogisticsTracking"), {
  ssr: false,
});

export default function UserListPage() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <LogisticsTracking />
    </Suspense>
  );
}
