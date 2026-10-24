-- The front desk orchestrates. A department can be set to "review": its
-- requests wait at the front desk, which sends them on with one button and a
-- briefing about the guest. The send can also post a structured reservation to
-- the department's own system (a restaurant's booking/POS software, via a
-- webhook), and that system can call back with the table and time.

alter table department_contacts
  add column if not exists dispatch text not null default 'direct',
  add column if not exists integration_url text,
  add column if not exists integration_secret text;

alter table department_contacts drop constraint if exists department_contacts_dispatch_check;
alter table department_contacts add constraint department_contacts_dispatch_check check (dispatch in ('direct', 'review'));
alter table department_contacts drop constraint if exists department_contacts_integration_url_check;
alter table department_contacts add constraint department_contacts_integration_url_check
  check (integration_url is null or (length(integration_url) <= 500 and integration_url ~ '^https://'));
create unique index if not exists department_contacts_secret_idx on department_contacts (integration_secret) where integration_secret is not null;

alter table requests
  add column if not exists dispatched_at timestamptz,
  add column if not exists dispatched_by text,
  add column if not exists dispatch_note text,
  add column if not exists confirmation jsonb;

-- Everything that already exists went straight to its department.
update requests set dispatched_at = created_at where dispatched_at is null;
