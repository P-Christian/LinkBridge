// src/lib/psgc.ts

export interface PsgcItem {
  code: string;
  name: string;
}

export const PSGC_NCR_PROVINCE: PsgcItem = {
  code: "133900000",
  name: "Metro Manila (NCR)",
};

export const PSGC_NCR_CITIES: PsgcItem[] = [
  { code: "137501000", name: "City of Caloocan" },
  { code: "137601000", name: "City of Las Piñas" },
  { code: "137602000", name: "City of Makati" },
  { code: "137502000", name: "City of Malabon" },
  { code: "137401000", name: "City of Mandaluyong" },
  { code: "133900000", name: "City of Manila" },
  { code: "137402000", name: "City of Marikina" },
  { code: "137603000", name: "City of Muntinlupa" },
  { code: "137503000", name: "City of Navotas" },
  { code: "137604000", name: "City of Parañaque" },
  { code: "137605000", name: "Pasay City" },
  { code: "137403000", name: "City of Pasig" },
  { code: "137606000", name: "Pateros" },
  { code: "137404000", name: "Quezon City" },
  { code: "137405000", name: "City of San Juan" },
  { code: "137607000", name: "City of Taguig" },
  { code: "137504000", name: "City of Valenzuela" },
];

const PSGC_NCR_REGION_CITIES_URL =
  "https://psgc.gitlab.io/api/regions/130000000/cities-municipalities/";

export async function fetchProvinces(): Promise<PsgcItem[]> {
  const res = await fetch("https://psgc.gitlab.io/api/provinces/");
  if (!res.ok) throw new Error("Failed to fetch provinces");
  const data = (await res.json()) as PsgcItem[];
  if (!data.some((p) => p.code === PSGC_NCR_PROVINCE.code)) {
    data.push(PSGC_NCR_PROVINCE);
  }
  return data.sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchNcrCities(): Promise<PsgcItem[]> {
  try {
    const res = await fetch(PSGC_NCR_REGION_CITIES_URL);
    if (!res.ok) throw new Error("Failed to fetch NCR cities");
    const data = (await res.json()) as PsgcItem[];
    return data.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [...PSGC_NCR_CITIES];
  }
}

export async function fetchCities(provinceCode: string): Promise<PsgcItem[]> {
  if (!provinceCode) return [];
  if (provinceCode === PSGC_NCR_PROVINCE.code) return fetchNcrCities();
  const res = await fetch(`https://psgc.gitlab.io/api/provinces/${provinceCode}/cities-municipalities/`);
  if (!res.ok) throw new Error("Failed to fetch cities");
  const data = await res.json();
  return (data as PsgcItem[]).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchBarangays(cityCode: string): Promise<PsgcItem[]> {
  if (!cityCode) return [];
  const res = await fetch(`https://psgc.gitlab.io/api/cities-municipalities/${cityCode}/barangays/`);
  if (!res.ok) throw new Error("Failed to fetch barangays");
  const data = await res.json();
  return (data as PsgcItem[]).sort((a, b) => a.name.localeCompare(b.name));
}
