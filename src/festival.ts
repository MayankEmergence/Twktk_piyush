// Original festival price list. Server/database prices take precedence after editing.
export const categoryNames = [
  "GENERAL ACCESS",
  "VIP",
  "FAN PIT",
  "ON STAGE",
  "EM LOUNGE",
  "TABLES STARTING",
];
export const originalPrices: Record<string, number[]> = {
  mumbai: [199900, 499900, 699900, 999900, 999900, 5000000],
  delhi: [199900, 399900, 499900, 699900, 999900, 3000000],
  bangalore: [199900, 399900, 499900, 699900, 999900, 3000000],
};
export function initialEvents() {
  return [
    {
      id: "33333333-3333-4333-8333-333333333331",
      city: "Delhi",
      key: "delhi",
      starts_at: "2026-10-31T18:00:00+05:30",
    },
    {
      id: "33333333-3333-4333-8333-333333333332",
      city: "Bengaluru",
      key: "bangalore",
      starts_at: "2026-11-01T18:00:00+05:30",
    },
  ].map((e) => ({
    ...e,
    title: `TWKTK — ${e.city}`,
    venue: "Venue to be announced",
    price: 199900,
    capacity: 2200,
    sales_open: false,
    sold: "0",
    reserved: "0",
    ticket_types: categoryNames.map((name, i) => ({
      id: `${e.key}-${i}`,
      event_id: e.id,
      name,
      price: originalPrices[e.key][i],
      capacity: 200,
      admissions: i === 5 ? 6 : 1,
      sales_open: false,
    })),
  }));
}
