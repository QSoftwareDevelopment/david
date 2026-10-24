-- WhatsApp alongside SMS, through the same Twilio account.
--
-- A guest is one person with one phone number. They may text the hotel's
-- number or message its WhatsApp number; David answers on whichever they used
-- last. WhatsApp only lets a business start a conversation with an approved
-- template, and only lets it send free text within 24 hours of the guest's last
-- message, so the hotel stores the approved template for each campaign here.

alter table hotels
  add column if not exists whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{6,14}$'),
  add column if not exists whatsapp_templates jsonb not null default '{}'::jsonb;

alter table guests
  add column if not exists channel text not null default 'sms';
alter table messages
  add column if not exists channel text not null default 'sms';

alter table guests drop constraint if exists guests_channel_check;
alter table guests add constraint guests_channel_check check (channel in ('sms', 'whatsapp'));
alter table messages drop constraint if exists messages_channel_check;
alter table messages add constraint messages_channel_check check (channel in ('sms', 'whatsapp'));

create unique index if not exists hotels_whatsapp_number_idx on hotels (whatsapp_number) where whatsapp_number is not null;

-- Two messages can carry the same timestamp (a text and its instant reply). A sequence keeps threads in the order they happened.
alter table messages add column if not exists seq bigint generated always as identity;
