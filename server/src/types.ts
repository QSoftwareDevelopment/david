export type Consent = "unknown" | "opted_in" | "opted_out";

export interface Hotel {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  smsNumber: string | null;
  tone: string;
  signature: string;
  quietStart: number;
  quietEnd: number;
  checkinTime: string;
  checkoutTime: string;
  /** Where happy guests are sent to leave a review. */
  /** The hotel's WhatsApp number, if it has one (E.164). */
  whatsappNumber?: string | null;
  /** Approved WhatsApp template (Twilio Content SID) for each campaign kind. */
  whatsappTemplates?: Record<string, string>;
  reviewUrl?: string | null;
  /** Local hour the manager's morning briefing goes out. */
  briefingHour?: number;
  /** Never includes the access token. */
  square?: { connected: boolean; locationId: string | null; environment: "production" | "sandbox"; syncedAt: string | null };
}

export interface Guest {
  id: string;
  hotelId: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  language: string;
  consent: Consent;
  consentAt: string | null;
  vip: boolean;
  notes: string | null;
  createdAt: string;
  /** Where they last wrote from, so replies go the same way. */
  channel?: "sms" | "whatsapp";
}

export type StayStatus = "booked" | "in_house" | "departed" | "cancelled";

export interface Stay {
  id: string;
  hotelId: string;
  guestId: string;
  room: string | null;
  arrival: string;
  departure: string;
  partySize: number;
  status: StayStatus;
  notes: string | null;
  /** When they told us they'd arrive, local time as HH:MM. */
  eta?: string | null;
}

export const MEMORY_KINDS = ["preference", "habit", "dietary", "occasion", "dislike", "contact"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];
export type MemorySource = "guest" | "observed" | "staff";

export interface Memory {
  id: string;
  guestId: string;
  kind: MemoryKind;
  key: string;
  value: string;
  confidence: number;
  evidence: number;
  source: MemorySource;
  hidden: boolean;
  firstSeen: string;
  lastSeen: string;
}

export const REQUEST_KINDS = [
  "room_service",
  "housekeeping",
  "laundry",
  "amenities",
  "maintenance",
  "transport",
  "late_checkout",
  "early_checkin",
  "restaurant",
  "other",
] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export type RequestStatus = "new" | "in_progress" | "done" | "cancelled";

export interface GuestRequest {
  id: string;
  hotelId: string;
  guestId: string;
  stayId: string | null;
  kind: RequestKind;
  summary: string;
  details: Record<string, unknown>;
  status: RequestStatus;
  priority: "normal" | "urgent";
  createdBy: "david" | "staff";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  squareOrderId?: string | null;
  squareError?: string | null;
  notifiedAt?: string | null;
  remindedAt?: string | null;
  escalatedAt?: string | null;
}

export type MessageAuthor = "guest" | "david" | "staff" | "campaign";

export interface Message {
  id: string;
  hotelId: string;
  guestId: string;
  direction: "in" | "out";
  author: MessageAuthor;
  body: string;
  status: string;
  campaignId: string | null;
  createdAt: string;
  channel?: "sms" | "whatsapp";
}

export const CAMPAIGN_KINDS = ["pre_arrival", "arrival_day", "mid_stay", "post_stay", "win_back", "custom"] as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

export interface CampaignAudience {
  repeatOnly?: boolean;
  vipOnly?: boolean;
  minNights?: number;
}

export interface Campaign {
  id: string;
  hotelId: string;
  name: string;
  kind: CampaignKind;
  enabled: boolean;
  offsetDays: number;
  sendHour: number;
  messageMode: "generated" | "custom";
  template: string;
  guidance: string;
  audience: CampaignAudience;
}

export type ServiceCategory = "room_service" | "housekeeping" | "laundry" | "amenity" | "transport" | "other";

export interface Service {
  id: string;
  hotelId: string;
  category: ServiceCategory;
  name: string;
  description: string;
  priceCents: number | null;
  availableFrom: string | null;
  availableUntil: string | null;
  active: boolean;
  squareVariationId?: string | null;
}
