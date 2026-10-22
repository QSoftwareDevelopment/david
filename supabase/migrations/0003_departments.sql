-- Departments: the people who do the work (kitchen, restaurant, laundry,
-- housekeeping, maintenance, front desk) see only their own requests. Owners
-- and managers see everything.

-- A restaurant is a kind of request too (a table, a reservation).
alter table requests drop constraint if exists requests_kind_check;
alter table requests add constraint requests_kind_check
  check (kind in ('room_service', 'housekeeping', 'laundry', 'amenities', 'maintenance', 'transport', 'late_checkout', 'early_checkin', 'restaurant', 'other'));

-- Staff: a role, and for 'staff' the one department they work in.
-- A 'staff' row with no department keeps the old behaviour: sees everything.
alter table staff drop constraint if exists staff_role_check;
alter table staff add constraint staff_role_check check (role in ('owner', 'manager', 'staff'));
alter table staff add column if not exists department text;
alter table staff drop constraint if exists staff_department_check;
alter table staff add constraint staff_department_check
  check (department is null or department in ('front_desk', 'room_service', 'restaurant', 'housekeeping', 'laundry', 'maintenance'));

-- Someone invited by email who hasn't signed in yet. When they do (with that
-- address), they are added to the hotel with this role and department.
create table if not exists staff_invites (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references hotels(id) on delete cascade,
  email      text not null check (email = lower(email) and length(email) between 3 and 200),
  role       text not null default 'staff' check (role in ('manager', 'staff')),
  department text check (department is null or department in ('front_desk', 'room_service', 'restaurant', 'housekeeping', 'laundry', 'maintenance')),
  created_at timestamptz not null default now(),
  unique (hotel_id, email)
);
alter table staff_invites enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on staff_invites from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on staff_invites from authenticated; end if;
end $$;
