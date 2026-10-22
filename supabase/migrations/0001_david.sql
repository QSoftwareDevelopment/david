-- David: an SMS concierge for hotels.
--
-- One Postgres schema, used by the server directly (the server connects with a
-- service connection string) and replayed in tests on PGlite. Nothing here is
-- meant to be read by the browser or the mobile app through the Supabase API:
-- every table has row level security on and no policy, and is revoked from the
-- public roles. The staff app talks to the David server, which checks who is
-- asking and which hotel they belong to.
--
-- ── What is remembered ─────────────────────────────────────────────────────
--
-- A guest belongs to one hotel and is identified by phone number. Everything we
-- learn about them is a row in `memories`: a kind (preference, habit, dietary,
-- occasion, dislike), a key ("pillows"), a value ("firm, two extra") and how
-- sure we are. Memories outlive stays on purpose: that is what turns a second
-- visit into "welcome back" rather than "who are you".


create table if not exists hotels (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 1 and 120),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  timezone      text not null default 'America/Toronto',
  -- The hotel's own number guests text, E.164. Null until one is bought.
  sms_number    text check (sms_number is null or sms_number ~ '^\+[1-9][0-9]{6,14}$'),
  -- How David should sound, in the hotel's words.
  tone          text not null default 'warm, polished and brief' check (length(tone) <= 300),
  signature     text not null default '' check (length(signature) <= 80),
  -- Local hours (0-23) outside which David never texts first.
  quiet_start   int not null default 21 check (quiet_start between 0 and 23),
  quiet_end     int not null default 8  check (quiet_end between 0 and 23),
  checkin_time  text not null default '15:00',
  checkout_time text not null default '11:00',
  created_at    timestamptz not null default now()
);

-- Which signed-in people may see a hotel. user_id is the Supabase auth user.
create table if not exists staff (
  user_id  uuid not null,
  hotel_id uuid not null references hotels(id) on delete cascade,
  role     text not null default 'staff' check (role in ('owner', 'staff')),
  email    text,
  primary key (user_id, hotel_id)
);

create table if not exists guests (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references hotels(id) on delete cascade,
  phone        text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  first_name   text,
  last_name    text,
  language     text not null default 'en',
  -- `unknown` until the guest says yes (booking opt-in or a first text). David
  -- only starts a conversation with `opted_in` guests, and stops for good at
  -- `opted_out`.
  consent      text not null default 'unknown' check (consent in ('unknown', 'opted_in', 'opted_out')),
  consent_at   timestamptz,
  consent_source text,
  vip          boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now(),
  unique (hotel_id, phone)
);

create table if not exists stays (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references hotels(id) on delete cascade,
  guest_id   uuid not null references guests(id) on delete cascade,
  room       text,
  arrival    date not null,
  departure  date not null,
  party_size int not null default 1 check (party_size between 1 and 20),
  status     text not null default 'booked' check (status in ('booked', 'in_house', 'departed', 'cancelled')),
  notes      text,
  created_at timestamptz not null default now(),
  check (departure > arrival)
);
create index if not exists stays_guest_idx on stays (guest_id, arrival desc);
create index if not exists stays_hotel_dates_idx on stays (hotel_id, arrival, departure);

create table if not exists memories (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references hotels(id) on delete cascade,
  guest_id   uuid not null references guests(id) on delete cascade,
  kind       text not null check (kind in ('preference', 'habit', 'dietary', 'occasion', 'dislike', 'contact')),
  key        text not null check (length(key) between 1 and 60),
  value      text not null check (length(value) between 1 and 300),
  confidence real not null default 0.5 check (confidence between 0 and 1),
  -- How many separate times this has been seen.
  evidence   int not null default 1 check (evidence >= 1),
  source     text not null default 'guest' check (source in ('guest', 'observed', 'staff')),
  stay_id    uuid references stays(id) on delete set null,
  -- Staff can hide a memory without deleting what David learned.
  hidden     boolean not null default false,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  unique (guest_id, kind, key)
);
create index if not exists memories_guest_idx on memories (guest_id) where not hidden;

create table if not exists requests (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references hotels(id) on delete cascade,
  guest_id     uuid not null references guests(id) on delete cascade,
  stay_id      uuid references stays(id) on delete set null,
  kind         text not null check (kind in ('room_service', 'housekeeping', 'laundry', 'amenities', 'maintenance', 'transport', 'late_checkout', 'early_checkin', 'other')),
  summary      text not null check (length(summary) between 1 and 300),
  details      jsonb not null default '{}'::jsonb,
  status       text not null default 'new' check (status in ('new', 'in_progress', 'done', 'cancelled')),
  priority     text not null default 'normal' check (priority in ('normal', 'urgent')),
  created_by   text not null default 'david' check (created_by in ('david', 'staff')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists requests_hotel_status_idx on requests (hotel_id, status, created_at desc);
create index if not exists requests_guest_idx on requests (guest_id, created_at desc);

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references hotels(id) on delete cascade,
  guest_id    uuid not null references guests(id) on delete cascade,
  direction   text not null check (direction in ('in', 'out')),
  author      text not null check (author in ('guest', 'david', 'staff', 'campaign')),
  body        text not null check (length(body) between 1 and 1600),
  twilio_sid  text,
  status      text not null default 'received',
  campaign_id uuid,
  created_at  timestamptz not null default now()
);
create index if not exists messages_thread_idx on messages (guest_id, created_at);
create unique index if not exists messages_sid_idx on messages (twilio_sid) where twilio_sid is not null;

create table if not exists campaigns (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references hotels(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 80),
  kind         text not null check (kind in ('pre_arrival', 'arrival_day', 'mid_stay', 'post_stay', 'win_back', 'custom')),
  enabled      boolean not null default true,
  -- Days from arrival (negative = before) or from departure for post_stay and win_back.
  offset_days  int not null default 0 check (offset_days between -60 and 365),
  -- Local hour to send at.
  send_hour    int not null default 10 check (send_hour between 0 and 23),
  message_mode text not null default 'generated' check (message_mode in ('generated', 'custom')),
  -- Used as the exact words for `custom`, and as the starting point for `generated`.
  template     text not null default '' check (length(template) <= 1000),
  guidance     text not null default '' check (length(guidance) <= 500),
  -- Who: { repeat_only: bool, vip_only: bool, min_nights: int }
  audience     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists campaign_sends (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  hotel_id      uuid not null references hotels(id) on delete cascade,
  guest_id      uuid not null references guests(id) on delete cascade,
  stay_id       uuid references stays(id) on delete cascade,
  scheduled_for timestamptz not null,
  sent_at       timestamptz,
  message_id    uuid,
  status        text not null check (status in ('sent', 'skipped', 'failed')),
  reason        text,
  -- A campaign reaches a stay once. Win-backs have no stay and use the guest.
  unique (campaign_id, stay_id)
);
create unique index if not exists campaign_sends_guest_once on campaign_sends (campaign_id, guest_id) where stay_id is null;

create table if not exists services (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid not null references hotels(id) on delete cascade,
  category        text not null check (category in ('room_service', 'housekeeping', 'laundry', 'amenity', 'transport', 'other')),
  name            text not null check (length(btrim(name)) between 1 and 80),
  description     text not null default '' check (length(description) <= 300),
  price_cents     int check (price_cents is null or price_cents >= 0),
  available_from  text,
  available_until text,
  active          boolean not null default true,
  sort            int not null default 0
);
create index if not exists services_hotel_idx on services (hotel_id, category, sort);

-- ── Nobody reads these through the Supabase API ────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['hotels','staff','guests','stays','memories','requests','messages','campaigns','campaign_sends','services']
  loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on %I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on %I from authenticated', t);
    end if;
  end loop;
end $$;
