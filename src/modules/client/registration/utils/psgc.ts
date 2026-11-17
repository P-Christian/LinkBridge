// src/modules/client/registration/utils/psgc.ts

export interface PsgcItem {
  code: string;
  name: string;
}

const NCR_PROVINCE_CODE = "133900000";

const NCR_REGION_CITIES_URL =
  "https://psgc.gitlab.io/api/regions/130000000/cities-municipalities/";

const FALLBACK_PROVINCES: PsgcItem[] = [
  { code: "133900000", name: "Metro Manila (NCR)" },
  { code: "072200000", name: "Cebu" },
  { code: "112400000", name: "Davao del Sur" },
  { code: "035400000", name: "Pampanga" },
  { code: "042100000", name: "Cavite" },
  { code: "043400000", name: "Laguna" },
  { code: "041000000", name: "Batangas" },
  { code: "045800000", name: "Rizal" },
  { code: "031400000", name: "Bulacan" },
  { code: "141100000", name: "Benguet" },
  { code: "063000000", name: "Iloilo" },
  { code: "064500000", name: "Negros Occidental" },
];

const FALLBACK_CITIES: Record<string, PsgcItem[]> = {
  "133900000": [
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
  ],
  "072200000": [
    { code: "072217000", name: "Cebu City" },
    { code: "072230000", name: "Mandaue City" },
    { code: "072226000", name: "Lapu-Lapu City" },
    { code: "072250000", name: "Talisay City" },
  ],
  "112400000": [
    { code: "112402000", name: "Davao City" },
    { code: "112403000", name: "Digos City" },
  ],
};

const FALLBACK_BARANGAYS: Record<string, PsgcItem[]> = {
  "133900001": [
    { code: "13390000101", name: "Bel-Air" },
    { code: "13390000102", name: "Poblacion" },
    { code: "13390000103", name: "San Lorenzo" },
    { code: "13390000104", name: "Urdaneta" },
  ],
  "133900003": [
    { code: "13390000301", name: "Barangay 649 (Baseco)" },
    { code: "13390000302", name: "Intramuros" },
    { code: "13390000303", name: "Binondo" },
  ],
};

export async function fetchProvinces(): Promise<PsgcItem[]> {
  try {
    const res = await fetch("https://psgc.gitlab.io/api/provinces/");
    if (!res.ok) throw new Error();
    const data = await res.json();
    const provinces = data as PsgcItem[];
    const ncr = FALLBACK_PROVINCES.find((p) => p.code === NCR_PROVINCE_CODE);
    if (ncr && !provinces.some((p) => p.code === ncr.code)) {
      provinces.push(ncr);
    }
    return provinces.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return FALLBACK_PROVINCES;
  }
}

export async function fetchCities(provinceCode: string): Promise<PsgcItem[]> {
  if (!provinceCode) return [];
  try {
    const url =
      provinceCode === NCR_PROVINCE_CODE
        ? NCR_REGION_CITIES_URL
        : `https://psgc.gitlab.io/api/provinces/${provinceCode}/cities-municipalities/`;
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return (data as PsgcItem[]).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return FALLBACK_CITIES[provinceCode] || [
      { code: `${provinceCode}01`, name: "City Center" },
      { code: `${provinceCode}02`, name: "East District" }
    ];
  }
}

export async function fetchBarangays(cityCode: string): Promise<PsgcItem[]> {
  if (!cityCode) return [];
  try {
    const res = await fetch(`https://psgc.gitlab.io/api/cities-municipalities/${cityCode}/barangays/`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return (data as PsgcItem[]).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return FALLBACK_BARANGAYS[cityCode] || [
      { code: `${cityCode}001`, name: "Barangay I" },
      { code: `${cityCode}002`, name: "Barangay II" }
    ];
  }
}

