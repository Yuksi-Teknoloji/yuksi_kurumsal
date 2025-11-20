"use client";

import { redirect } from "next/navigation";
import { getAuthToken } from "@/src/utils/auth";
import { decodeJwt, isExpired, roleSegment } from "@/src/utils/jwt";

export default function CorporateHome() {
  const token = getAuthToken();

  if (!token) {
    redirect("/");
  }

  const claims = decodeJwt(token);

  if (!claims || isExpired(claims)) {
    redirect("/");
  }

  const role = String(roleSegment(claims.userType) || "").toLowerCase();

  if (role !== "corporate") {
    redirect("/");
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      Kurumsal Üye Paneline Hoşgeldiniz
    </div>
  );
}
