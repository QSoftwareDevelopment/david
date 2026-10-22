-- Square: room service menu comes from the hotel's Square catalog, and each
-- confirmed room service order is sent to Square as an open order.
--
-- The access token lives on the hotel row. These tables are already closed to
-- the Supabase API (see 0001) and only the David server reads them; the server
-- never returns the token to the app.

alter table hotels
  add column if not exists square_access_token text,
  add column if not exists square_location_id  text,
  add column if not exists square_environment  text not null default 'production',
  add column if not exists square_synced_at    timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hotels_square_environment_check') then
    alter table hotels add constraint hotels_square_environment_check check (square_environment in ('production', 'sandbox'));
  end if;
end $$;

-- Which Square catalog variation a menu item came from. Null for items added by hand.
alter table services
  add column if not exists square_item_id      text,
  add column if not exists square_variation_id text;
create unique index if not exists services_square_variation_idx on services (hotel_id, square_variation_id) where square_variation_id is not null;

-- What happened when the order was sent.
alter table requests
  add column if not exists square_order_id text,
  add column if not exists square_error    text;
