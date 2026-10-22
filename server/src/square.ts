/**
 * Square, the part David needs: read the menu, send an order.
 *
 * `SquareApi` is the seam. `HttpSquare` talks to Square's REST API with fetch;
 * `RecordingSquare` stands in for it in the demo and the tests.
 */

export interface SquareCredentials {
  accessToken: string;
  locationId: string;
  environment: "production" | "sandbox";
}

export interface SquareMenuItem {
  itemId: string;
  variationId: string;
  name: string;
  description: string;
  priceCents: number | null;
}

export interface SquareOrderLine {
  variationId: string;
  quantity: number;
  note?: string;
}

export interface SquareApi {
  /** Every sellable item at the location, one entry per variation. */
  menu(): Promise<SquareMenuItem[]>;
  /** Create an open order; returns Square's order id. Safe to retry with the same key. */
  createOrder(input: { key: string; ticketName: string; lines: SquareOrderLine[] }): Promise<{ orderId: string }>;
}

export type SquareFactory = (credentials: SquareCredentials) => SquareApi;

const VERSION = "2025-01-23";
const base = (env: SquareCredentials["environment"]) => (env === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com");

interface CatalogObject {
  id: string;
  type: string;
  is_deleted?: boolean;
  item_data?: { name?: string; description?: string; variations?: CatalogObject[]; product_type?: string };
  item_variation_data?: { name?: string; price_money?: { amount?: number } };
  present_at_all_locations?: boolean;
  present_at_location_ids?: string[];
  absent_at_location_ids?: string[];
}

const atLocation = (o: CatalogObject, locationId: string) =>
  o.present_at_all_locations ? !o.absent_at_location_ids?.includes(locationId) : !!o.present_at_location_ids?.includes(locationId);

export class HttpSquare implements SquareApi {
  constructor(private readonly c: SquareCredentials, private readonly fetchImpl: typeof fetch = fetch) {}

  private async call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await this.fetchImpl(`${base(this.c.environment)}${path}`, {
      method: init.method ?? "GET",
      headers: { authorization: `Bearer ${this.c.accessToken}`, "square-version": VERSION, "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const json = (await res.json().catch(() => ({}))) as { errors?: { code?: string; detail?: string }[] } & T;
    if (!res.ok) {
      const first = json.errors?.[0];
      throw new Error(`Square ${res.status}: ${first?.detail ?? first?.code ?? "request failed"}`);
    }
    return json;
  }

  async menu(): Promise<SquareMenuItem[]> {
    const out: SquareMenuItem[] = [];
    let cursor: string | undefined;
    do {
      const q = new URLSearchParams({ types: "ITEM" });
      if (cursor) q.set("cursor", cursor);
      const page = await this.call<{ objects?: CatalogObject[]; cursor?: string }>(`/v2/catalog/list?${q}`);
      for (const item of page.objects ?? []) {
        if (item.is_deleted || item.type !== "ITEM" || !atLocation(item, this.c.locationId)) continue;
        const variations = (item.item_data?.variations ?? []).filter((v) => !v.is_deleted && !v.absent_at_location_ids?.includes(this.c.locationId));
        const base = item.item_data?.name?.trim();
        if (!base) continue;
        for (const v of variations) {
          const vname = v.item_variation_data?.name?.trim();
          // "Latte" with one variation called "Regular" is just "Latte".
          const single = variations.length === 1 || !vname || /^(regular|default)$/i.test(vname);
          out.push({
            itemId: item.id, variationId: v.id,
            name: (single ? base : `${base} (${vname})`).slice(0, 80),
            description: (item.item_data?.description ?? "").slice(0, 300),
            priceCents: typeof v.item_variation_data?.price_money?.amount === "number" ? v.item_variation_data.price_money.amount : null,
          });
        }
      }
      cursor = page.cursor;
    } while (cursor);
    return out;
  }

  async createOrder(input: { key: string; ticketName: string; lines: SquareOrderLine[] }): Promise<{ orderId: string }> {
    const res = await this.call<{ order?: { id?: string } }>("/v2/orders", {
      method: "POST",
      body: {
        idempotency_key: input.key.slice(0, 45),
        order: {
          location_id: this.c.locationId,
          ticket_name: input.ticketName.slice(0, 64),
          line_items: input.lines.map((l) => ({ catalog_object_id: l.variationId, quantity: String(l.quantity), ...(l.note ? { note: l.note.slice(0, 500) } : {}) })),
        },
      },
    });
    if (!res.order?.id) throw new Error("Square did not return an order id.");
    return { orderId: res.order.id };
  }
}

/** Demo and tests: a small menu, and a log of the orders it was given. */
export class RecordingSquare implements SquareApi {
  readonly orders: { key: string; ticketName: string; lines: SquareOrderLine[]; orderId: string }[] = [];
  fail: string | null = null;
  constructor(public items: SquareMenuItem[] = DEMO_SQUARE_MENU) {}
  async menu() {
    if (this.fail) throw new Error(this.fail);
    return this.items;
  }
  async createOrder(input: { key: string; ticketName: string; lines: SquareOrderLine[] }) {
    if (this.fail) throw new Error(this.fail);
    const seen = this.orders.find((o) => o.key === input.key);
    if (seen) return { orderId: seen.orderId };
    const orderId = `demo-order-${this.orders.length + 1}`;
    this.orders.push({ ...input, orderId });
    return { orderId };
  }
}

export const DEMO_SQUARE_MENU: SquareMenuItem[] = [
  { itemId: "I-FLAT", variationId: "V-FLAT", name: "Oat flat white", description: "Our barista blend", priceCents: 575 },
  { itemId: "I-EGGS", variationId: "V-EGGS", name: "Eggs Benedict", description: "", priceCents: 2300 },
  { itemId: "I-CLUB", variationId: "V-CLUB", name: "Club sandwich", description: "", priceCents: 2500 },
  { itemId: "I-BURG", variationId: "V-BURG", name: "Harbour burger", description: "", priceCents: 2700 },
  { itemId: "I-PASTA", variationId: "V-PASTA", name: "Truffle linguine", description: "Fresh pasta, shaved truffle", priceCents: 3100 },
  { itemId: "I-COOK", variationId: "V-COOK", name: "Warm cookie plate", description: "", priceCents: 900 },
];
