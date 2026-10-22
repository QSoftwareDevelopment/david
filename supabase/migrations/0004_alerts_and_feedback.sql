-- Alerts and feedback.
--
-- Hotels already have ways of working: a kitchen phone, a Slack channel, a duty
-- manager. David tells those, instead of asking staff to live in another app.
-- And David asks guests how it is going, and acts on the answer.

-- Where each department's alerts go: a phone that gets a text, and/or a webhook
-- (Slack, Teams or anything that accepts a JSON post). 'manager' is who hears
-- about escalations and gets the morning briefing.
create table if not exists department_contacts (
  hotel_id    uuid not null references hotels(id) on delete cascade,
  department  text not null check (department in ('front_desk', 'room_service', 'restaurant', 'housekeeping', 'laundry', 'maintenance', 'manager')),
  sms_number  text check (sms_number is null or sms_number ~ '^\+[1-9][0-9]{6,14}$'),
  webhook_url text check (webhook_url is null or (length(webhook_url) <= 500 and webhook_url ~ '^https://')),
  primary key (hotel_id, department)
);

alter table hotels
  add column if not exists review_url text check (review_url is null or (length(review_url) <= 500 and review_url ~ '^https://')),
  add column if not exists briefing_hour int not null default 7 check (briefing_hour between 0 and 23),
  add column if not exists last_briefing_date date;

-- What a guest told us about when they will arrive (local time, HH:MM).
alter table stays
  add column if not exists eta text check (eta is null or eta ~ '^[0-2][0-9]:[0-5][0-9]$');

-- One reminder and one escalation per request, never more.
alter table requests
  add column if not exists notified_at  timestamptz,
  add column if not exists reminded_at  timestamptz,
  add column if not exists escalated_at timestamptz;

-- "How is everything, 1 to 10?"
create table if not exists feedback (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references hotels(id) on delete cascade,
  guest_id   uuid not null references guests(id) on delete cascade,
  stay_id    uuid references stays(id) on delete set null,
  moment     text not null check (moment in ('mid_stay', 'post_stay')),
  score      int not null check (score between 0 and 10),
  created_at timestamptz not null default now()
);
create index if not exists feedback_hotel_idx on feedback (hotel_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['department_contacts', 'feedback']
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
