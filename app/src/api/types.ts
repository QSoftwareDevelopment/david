export type Consent = 'unknown' | 'opted_in' | 'opted_out';
export type RequestStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

export interface Hotel {
  id: string; name: string; slug: string; timezone: string; smsNumber: string | null; tone: string; signature: string;
  quietStart: number; quietEnd: number; checkinTime: string; checkoutTime: string;
  reviewUrl?: string | null; briefingHour?: number;
  whatsappNumber?: string | null; whatsappTemplates?: Record<string, string>;
  square?: SquareStatus;
}
export interface SquareStatus { connected: boolean; locationId: string | null; environment: 'production' | 'sandbox'; syncedAt: string | null }
export interface Guest {
  id: string; hotelId: string; phone: string; firstName: string | null; lastName: string | null; language: string;
  consent: Consent; vip: boolean; notes: string | null; createdAt: string; channel?: 'sms' | 'whatsapp';
}
export interface CatalogueLine { text: string; source: 'guest' | 'observed' | 'staff'; sure: boolean; memoryId: string }
export interface CatalogueSection { key: string; title: string; department: Department | null; lines: CatalogueLine[]; orders: { item: string; count: number }[]; facts: string[] }
export interface Catalogue {
  highlights: string[];
  stats: { stays: number; pastStays: number; nights: number; firstArrival: string | null; lastArrival: string | null; requests: number; memories: number };
  sections: CatalogueSection[];
  gaps: string[];
}
export interface GuestRow extends Guest { stayCount: number; lastArrival: string | null; openRequests: number; memoryCount: number; interests?: string[] }
export interface Stay { id: string; guestId: string; room: string | null; arrival: string; departure: string; partySize: number; status: 'booked' | 'in_house' | 'departed' | 'cancelled'; notes: string | null; eta?: string | null }
export interface Memory { id: string; guestId: string; kind: string; key: string; value: string; confidence: number; evidence: number; source: 'guest' | 'observed' | 'staff'; hidden: boolean; lastSeen: string }
export interface GuestRequest {
  id: string; guestId: string; kind: string; summary: string; status: RequestStatus; priority: 'normal' | 'urgent'; createdBy: 'david' | 'staff'; createdAt: string;
  details: Record<string, unknown>; squareOrderId?: string | null; squareError?: string | null;
  /** Null while the request is waiting at the front desk to be sent on. */
  dispatchedAt?: string | null; dispatchedBy?: string | null; dispatchNote?: string | null; confirmation?: Confirmation | null;
}
export interface Confirmation { status: 'confirmed' | 'declined' | 'seated' | 'done'; table?: string | null; time?: string | null; note?: string | null; at: string; source?: string | null }
export interface Handoff { department: Department; headline: string; lines: string[]; text: string }
export interface RequestRow extends GuestRequest { guestName: string; room: string | null; department?: Department }
export interface Message { id: string; direction: 'in' | 'out'; author: 'guest' | 'david' | 'staff' | 'campaign'; body: string; status: string; createdAt: string; channel?: 'sms' | 'whatsapp' }
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
  scope?: Access;
  toSend?: RequestRow[];
  board?: DepartmentStat;
  departments: DepartmentStat[];
}
export type Department = 'front_desk' | 'room_service' | 'restaurant' | 'housekeeping' | 'laundry' | 'maintenance';
export interface Access { role: 'owner' | 'manager' | 'staff'; department: Department | null }
export interface DepartmentStat { department: Department; label: string; open: number; urgent: number; doneToday: number; oldestMinutes: number | null; held?: number; oldestSentMinutes?: number | null }
export interface TeamMember { userId: string; email: string | null; role: Access['role']; department: Department | null }
export interface TeamInvite { id: string; email: string; role: Access['role']; department: Department | null; createdAt: string }
export interface Team { members: TeamMember[]; invites: TeamInvite[] }
export interface Me { hotel: Hotel; hotels: Hotel[]; demo: boolean; now: string; access: Access; actualAccess?: Access }
