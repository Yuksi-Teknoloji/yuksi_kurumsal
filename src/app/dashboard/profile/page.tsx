"use client";

import * as React from "react";
import Image from "next/image";
import MapPicker, {type GeoPoint} from "@/src/components/map/MapPicker";
import { getAuthToken } from "@/src/utils/auth";

const readJson = async(res: Response): Promise<any> => {
    const t = await res.text();
    try{
        return t ? JSON.parse(t) : null;
    } catch {
        return t;
    }
};

type CorporateProfileForm = {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    fullAddress: string;
    countryId: number;
    stateId: number;
    cityId: number;
    latitude: number;
    longitude: number;
    tax_office: string;
    tax_number: string;
    iban: string;
    resume: string;
};

export default function CorporateProfilePage() {
    const token = React.useMemo(getAuthToken, []);

    const [form, setForm] = React.useState<CorporateProfileForm>({
        email: "",
        phone: "",
        firstName: "",
        lastName: "",
        fullAddress: "",
        countryId: 0,
        stateId: 0,
        cityId: 0,
        latitude: 0,
        longitude: 0,
        tax_office: "",
        tax_number: "",
        iban: "",
        resume: "",
    });

    const [commissionRate, setCommissionRate] = React.useState<number | null>(null);
    const [commissionRateDescription, setCommissionRateDescription] = React.useState<string>("");

    const [editing, setEditing] = React.useState({
        email: false,
        phone: false,
        firstName: false,
        lastName: false,
        fullAddress: false,
        countryId: false,
        stateId: false,
        cityId: false,
        latitude: false,
        longitude: false,
        tax_office: false,
        tax_number: false,
        iban: false,
        resume: false,
    });

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [okMsg, setOkMsg] = React.useState<string | null>(null);
    const [errMsg, setErrMsg] = React.useState<string | null>(null);

    const toggle = (k: keyof typeof editing) =>
        setEditing((s) => ({ ...s, [k]: !s[k] }));

    React.useEffect(() => {
        if (!token) 
            return;
        let alive = true;

        (async () => {
            setLoading(true);
            setErrMsg(null);
            try{
                const res = await fetch("/yuksi/corporate/profile", {
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });

                const j = await readJson(res);
                if(!res.ok){
                    const msg = j?.message || j?.detail || j?.title || (typeof j === "string" ? j : `HTTP ${res.status}`);
                    throw new Error(msg);
                }

                const data = j?.data ?? j ?? {};

                if(!alive)
                    return;

                setForm({
                   email: data.email ?? "",
                   phone: data.phone ?? "",
                   firstName: data.firstName ?? "",
                   lastName: data.lastName ?? "",
                   fullAddress: data.fullAddress ?? "",
                   countryId: data.countryId ?? 0,
                   stateId: data.stateId ?? 0,
                   cityId: data.cityId ?? 0,
                   tax_office: data.taz_office ?? "",
                   tax_number: data.tax_number ?? "",
                   iban: data.iban ?? "",
                   resume: data.resume ?? "",
                   latitude: data.latitude ?? "",
                   longitude: data.longitude ?? "",
                });

                if (data.commissionRate != null)
                    setCommissionRate(data.commissionRate || 0);
                if(data.commissionDescription != null)
                    setCommissionRateDescription(data.commissionDescription);
            } catch (e: any){
                if(!alive) 
                    return;
                setErrMsg(e?.message || "Profil bilgileri alınamadı.");
            } finally {
                if (alive) 
                    setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [token]);

    const mapValue: GeoPoint | null = React.useMemo(() => {
        const lat = form.latitude;
        const lng = form.longitude;
        if (Number.isFinite(lat) && Number.isFinite(lng))
            return { lat, lng, };
        return null;
    }, [form.latitude, form.longitude]);

    const onPickFromMap = (p: GeoPoint) => {
        setForm((prev) => ({
            ...prev,
            latitude: Number(p.lat.toFixed(6)),
            longitude: Number(p.lng.toFixed(6)),
            fullAddress: p.address ? String(p.address) : prev.fullAddress,
        }));
    };

    const saveAll = async() => {
        if(!token || saving)
            return;
        setSaving(true);
        setOkMsg(null);
        setErrMsg(null);
        try{
            const body: any = {
                email: form.email,
                phone: form.phone,
                firstName: form.firstName,
                lastName: form.lastName,
                fullAddress: form.fullAddress,
                tax_office: form.tax_office,
                tax_number: form.tax_number,
                iban: form.iban,
                resume: form.resume,
            };

            const countryIdNum = Number(form.countryId);
            const stateIdNum = Number(form.stateId);
            const cityIdNum = Number(form.cityId);
            if(Number.isFinite(countryIdNum))
                body.countryId = countryIdNum;
            if(Number.isFinite(stateIdNum))
                body.stateId = stateIdNum;
            if(Number.isFinite(cityIdNum))
                body.cityId = cityIdNum;

            const latNum = Number(form.latitude);
            const lngNum = Number(form.longitude);
            if(Number.isFinite(latNum)) 
                body.latitude = latNum;
            if(Number.isFinite(lngNum))
                body.longitude = lngNum;

            const res = await fetch("/yuksi/corporate/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(body),
            });

            const j = await readJson(res);
            if (!res.ok) {
                const msg = j?.message || j?.detail || j?.title || (typeof j === "string" ? j : `HTTP ${res.status}`);
                throw new Error(msg);
            }

            setOkMsg(j?.message || "Profil başarıyla getirildi.");
            setEditing({
                email: false,
                phone: false,
                firstName: false,
                lastName: false,
                fullAddress: false,
                countryId: false,
                stateId: false,
                cityId: false,
                tax_office: false,
                tax_number: false,
                iban: false,
                resume: false,
                latitude: false,
                longitude: false,
            });
        } catch(e: any) {
            setErrMsg(e?.message || "Profil güncellenemedi.");
        } finally {
            setSaving(false);
        }
    };

    const onChange = (k: keyof CorporateProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((p) => ({ ...p, [k]: e.target.value}));

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">Bayi Profili</h1>

            {loading && (
                <div className="rounded-xl border border-neutral-200 bg-white p-4">Yükleniyor...</div>
            )}
            
            {!loading && (
                <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    <div className="rounded-2xl border border-neutral200/70 bg-orange-50 p-4 sm:p-6">
                        {okMsg && (
                            <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                                {okMsg}
                            </div>
                        )}
                        {errMsg && (
                            <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                                {errMsg}
                            </div>
                        )}

                        <Block title="Genel Bilgiler">
                            <Row>
                                <input 
                                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                                placeholder="Ad"
                                value={form.firstName}
                                onChange={onChange("firstName")}
                                disabled={!editing.firstName}
                                />
                                <EditButton onClick={() => toggle("firstName")} active={editing.firstName}/>
                            </Row>
                            <Row>
                                <input 
                                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                                placeholder="Soyad"
                                value={form.lastName}
                                onChange={onChange("lastName")}
                                disabled={!editing.lastName}
                                />
                                <EditButton onClick={() => toggle("lastName")} active={editing.lastName}/>
                            </Row>
                            <Row>
                                <input 
                                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                                placeholder="Özgeçmiş / açıklama"
                                value={form.resume}
                                onChange={onChange("resume")}
                                disabled={!editing.resume}
                                />
                                <EditButton onClick={() => toggle("resume")} active={editing.firstName}/>
                            </Row>
                        </Block>
                        <Block title="İletişim & Adres">
                            <Row>
                            <input 
                            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                            placeholder="Telefon"
                            value={form.phone}
                            onChange={onChange("phone")}
                            disabled={!editing.phone}
                            />
                            <EditButton onClick={() => toggle("phone")} active={editing.phone}/>
                            </Row>
                            <Row>
                            <input 
                            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                            placeholder="E-Posta"
                            value={form.email}
                            onChange={onChange("email")}
                            disabled={!editing.email}
                            />
                            <EditButton onClick={() => toggle("email")} active={editing.email}/>
                            </Row>
                            <Row>
                            <textarea
                            rows={3} 
                            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                            placeholder="Adres"
                            value={form.fullAddress}
                            onChange={onChange("fullAddress")}
                            disabled={!editing.fullAddress}
                            />
                            <EditButton onClick={() => toggle("fullAddress")} active={editing.fullAddress}/>
                            </Row>
                        </Block>

                        <Block title="Vergi/Finans">
                            <Row>
                            <input 
                            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                            placeholder="Vergi Dairesi"
                            value={form.tax_office}
                            onChange={onChange("tax_office")}
                            disabled={!editing.tax_office}
                            />
                            <EditButton onClick={() => toggle("tax_office")} active={editing.tax_office}/>
                            </Row>
                            <Row>
                            <input 
                            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                            placeholder="Vergi No"
                            value={form.tax_number}
                            onChange={onChange("tax_number")}
                            disabled={!editing.tax_number}
                            />
                            <EditButton onClick={() => toggle("tax_number")} active={editing.tax_number}/>
                            </Row>
                            <Row>
                            <input 
                            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                            placeholder="IBAN"
                            value={form.iban}
                            onChange={onChange("iban")}
                            disabled={!editing.iban}
                            />
                            <EditButton onClick={() => toggle("iban")} active={editing.iban}/>
                            </Row>
                        </Block>
                        <Block title="Konum">
                            <Row>
                            <input
                            type="number"
                            inputMode="decimal"
                            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                            placeholder="Enlem (örn: 40.123456)"
                            value={form.latitude}
                            onChange={onChange("latitude")}
                            disabled={!editing.latitude}
                            />
                            <EditButton onClick={() => toggle("latitude")} active={editing.latitude}/>
                            </Row>
                            <Row>
                            <input
                            type="number"
                            inputMode="decimal"
                            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                            placeholder="Boylam (örn: 29.123456)"
                            value={form.longitude}
                            onChange={onChange("longitude")}
                            disabled={!editing.longitude}
                            />
                            <EditButton onClick={() => toggle("longitude")} active={editing.longitude}/>
                            </Row>

                            <div className="mt-3">
                                <MapPicker
                                label="Haritada Konum Seç"
                                value={mapValue}
                                onChange={onPickFromMap}
                                defaultCenter={{ lat: 41.015137, lng: 28.97953 }}
                                />
                            </div>
                        </Block>

                        <Block title="Komisyon Bilgisi (sadece görüntüleme)">
                            <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800">
                                <div>
                                    <span className="font-semibold">Komisyon Oranı: </span>
                                    {commissionRate != null ? `%${commissionRate}` : '-'}
                                </div>
                                <div className="mt-1">
                                    <div className="font-semibold">Açıklama: </div>
                                    {commissionRateDescription || "-"}
                                </div>
                            </div>
                        </Block>

                        <div className="flex justify-center pt-2">
                            <button
                            type="button"
                            onClick={saveAll}
                            disabled={saving || !token}
                            className="rounded-xl border border-orange-300 bg-white px-6 py-2.5 text-sm font-semibold text-orange-600 shadow-sm hover:bg-orange-50 disabled:opacity-60"
                            >
                                {saving ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>

                    <aside className="rounded-2xl border border-neutral-200/70 bg-white p-6">
                        <div className="flex flex-col items-center text-center">
                            <div className="relative h-40 w-40">
                                <Image
                                    src="/Brand/yuksi.png"
                                    alt="profile"
                                    fill
                                    className="rounded-full object-cover ring-4 ring-orange-500"
                                >
                                </Image>
                            </div>
                            <div className="mt-4 space-y-2 text-sm">
                                <p>
                                    <span className="font-semibold text-orange-600">Ad Soyad:</span>
                                    {form.firstName || form.lastName ? `${form.firstName} ${form.lastName}` : "-"}
                                </p>
                                <p>
                                    <span className="font-semibold text-orange-600">Telefon:</span>
                                    {form.phone || "-"}
                                </p>
                                <p>
                                    <span className="font-semibold text-orange-600">E-Posta:</span>
                                    {form.email || "-"}
                                </p>
                                <p>
                                    <span className="font-semibold text-orange-600">Komisyon Oranı:</span>
                                    {commissionRate != null ? `${commissionRate}` : "-"}
                                </p>
                            </div>
                        </div>
                    </aside>
                </section>
            )}
        </div>
    );
}

function Block({ title, children }: {title: string; children: React.ReactNode }) {
    return (
        <div className="mb-6">
            <div className="mb-2 text-sm font-semibold text-neutral-800">{title}</div>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

function Row({ children }: {children: React.ReactNode }) {
    return <div className="grid grid-cols-[1fr_auto] items-center gap-3">{children}</div>
}

function EditButton({ onClick, active }: {onClick: () => void; active: boolean}) {
    return(
        <button 
        type="button"
        onClick={onClick}
        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${active ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-500 hover:bg-emerald-600"}`}
        >
            DÜZENLE
        </button>
    )
}