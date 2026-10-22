export type Consent = 'unknown' | 'opted_in' | 'opted_out';
export type RequestStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

export interface Hotel {
  id: string; name: string; slug: string; timezone: string; smsNumber: string | null; tone: string; signature: string;
  quietStart: number; quietEnd: number; checkinTime: string; checkoutTime: string;
  square?: SquareStatus;
}
export interface SquareStatus { connected: boolean; locationId: string | null; environment: 'production' | 'sandbox'; syncedAt: string | null }
export interface Guest {
  id: string; hotelId: string; phone: string; firstName: string | null; lastName: string | null; language: string;
  consent: Consent; vip: boolean; notes: string | null; createdAt: string;
}
export interface GuestRow extends Guest { stayCount: number; lastArrival: string | null; openRequests: number; memoryCount: number }
export interface Stay { id: string; guestId: string; room: string | null; arrival: string; departure: string; partySize: number; status: 'booked' | 'in_house' | 'departed' | 'cancelled'; notes: string | null }
export interface Memory { id: string; guestId: string; kind: string; key: string; value: string; confidence: number; evidence: number; source: 'guest' | 'observed' | 'staff'; hidden: boolean; lastSeen: string }
export interface GuestRequest {
  id: string; guestId: string; kind: string; summary: string; status: RequestStatus; priority: 'normal' | 'urgent'; createdBy: 'david' | 'staff'; createdAt: string;
  details: Record<string, unknown>; squareOrderId?: string | null; squareError?: string | null;
}
export interface RequestRow extends GuestRequest { guestName: string; room: string | null }
export interface Message { id: string; direction: 'in' | 'out'; author: 'guest' | 'david' | 'staff' | 'campaign'; body: string; status: string; createdAt: string }
export interface Conversation { guestId: string; guestName: string; phone: string; consent: Consent; last: Message; openRequests: number }
export interface Campaign {
  id: string; name: string; kind: string; enabled: boolean; offsetDays: number; sendHour: number; messageMode: 'generated' | 'custom';
  template: string; guidance: string; audience: { repeatOnly?: boolean; vipOnly?: boolean; minNights?: number }; sent: number; skipped: number;
}
export interface Service { id: string; category: string; name: string; description: string; priceCents: number | null; availableFrom: string | null; availableUntil: string | null; active: boolean; squareVariationId?: string | null }
export interface Dashboard {
  today: string;
  stats: { arrivalsToday: number; inHouse: number; departuresToday: number; openRequests: number; urgentRequests: number; requestsToday: number; repeatGuestsInHouse: number; guestsTotal: number; memoriesTotal: number; optedOut: number };
  arrivals: { stay: Stay; guest: Guest; pastStays: number; memories: Memory[]; asked: GuestRequest[]; touches: { text: string; because: string }[] }[];
  urgent: RequestRow[];
}
export interface Me { hotel: Hotel; hotels: Hotel[]; demo: boolean; now: string }
