// STAGE 1 MOCK tool results. No data-portal calls are made yet.
// Each future real adapter (Stage 2) will replace one function here.
export type ToolSource = { title: string; publisher: string; url: string; fetched_at: string };

const today = new Date().toISOString();
const mockSource = (title: string): ToolSource => ({
  title: `${title} (MOCK)`,
  publisher: "City of Detroit Open Data Portal",
  url: "https://data.detroitmi.gov",
  fetched_at: today,
});

export function mockLookupParcel(input: { address?: string | null; parcel_id?: string | null }) {
  return {
    parcel_id: input.parcel_id || "00000000.000 (MOCK)",
    address: input.address || "Not specified in source",
    zoning_district: "B4 (MOCK — sample value)",
    building_status: "Occupied (MOCK)",
    land_bank_owned: false,
    historic_overlap: "Possible historic review, confirm with the commission (MOCK)",
    source: mockSource("Parcels (Assessor)"),
  };
}

export function mockCheckUse() {
  return {
    result: "Conditional" as const,
    ordinance_section: "Not specified in source",
    link: "https://library.municode.com/mi/detroit",
    flags: ["Conditional use hearing may be needed (MOCK)"],
    source: mockSource("Zoning rules library"),
  };
}

export function mockBlockers() {
  return {
    open_blight_tickets: 0,
    certificate_of_compliance: "Not found (MOCK)",
    source: mockSource("Blight Tickets"),
  };
}

export function mockPermitHistory() {
  return {
    permits: [{ id: "MOCK-0001", type: "Alteration (MOCK)", issued: "2019-05-01" }],
    source: mockSource("Building Permits (BSEED)"),
  };
}
