-- ============================================================
-- GAA Exchange — Seed  [1 / 7]  profiles
-- Run this first.
-- ============================================================

-- Step 1 — auth.users rows for the 7 demo accounts.
--   These cannot be logged into (password is a random hash).
--   Required because profiles.id is a FK → auth.users.id.
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_anonymous, is_sso_user, is_super_admin
)
VALUES
  ('11000000-0000-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'kerrykiing1982@demo.gaa',
   crypt(encode(gen_random_bytes(16), 'hex'), gen_salt('bf', 4)),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, false),

  ('11000000-0000-4000-8000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'mayomadra@demo.gaa',
   crypt(encode(gen_random_bytes(16), 'hex'), gen_salt('bf', 4)),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, false),

  ('11000000-0000-4000-8000-000000000003',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'galwaytribejerseys@demo.gaa',
   crypt(encode(gen_random_bytes(16), 'hex'), gen_salt('bf', 4)),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, false),

  ('11000000-0000-4000-8000-000000000004',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'tippfan2023@demo.gaa',
   crypt(encode(gen_random_bytes(16), 'hex'), gen_salt('bf', 4)),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, false),

  ('11000000-0000-4000-8000-000000000005',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dublinjerseystore@demo.gaa',
   crypt(encode(gen_random_bytes(16), 'hex'), gen_salt('bf', 4)),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, false),

  ('11000000-0000-4000-8000-000000000006',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'donegaldeals@demo.gaa',
   crypt(encode(gen_random_bytes(16), 'hex'), gen_salt('bf', 4)),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, false),

  ('11000000-0000-4000-8000-000000000007',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'corkcollector@demo.gaa',
   crypt(encode(gen_random_bytes(16), 'hex'), gen_salt('bf', 4)),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, false)

ON CONFLICT (id) DO NOTHING;


-- Step 2 — demo profiles
INSERT INTO profiles (id, username, avatar_url, county, bio)
VALUES
  ('11000000-0000-4000-8000-000000000001',
   'KerryKing1982', null, 'Kerry',
   'Lifelong Kingdom man. Collecting GAA jerseys since the Páidí Ó Sé era. Sam Maguire always finds its way home.'),

  ('11000000-0000-4000-8000-000000000002',
   'MayoMadra', null, 'Mayo',
   'Mayo through and through. Still waiting on that All-Ireland — the jerseys are class though. Open to swaps.'),

  ('11000000-0000-4000-8000-000000000003',
   'GalwayTribeJerseys', null, 'Galway',
   'Tribal jersey hunter. Football and hurling, I collect them all. Based out of Salthill.'),

  ('11000000-0000-4000-8000-000000000004',
   'TippFan2023', null, 'Tipperary',
   'Premier County supporter. Hurling purist. Building a full Tipp collection from 1990 to present.'),

  ('11000000-0000-4000-8000-000000000005',
   'DublinJerseyStore', null, 'Dublin',
   'Dublin GAA fan with too many jerseys. Clearance seller, competitive prices. Fast postage from D7.'),

  ('11000000-0000-4000-8000-000000000006',
   'DonegalDeals', null, 'Donegal',
   'Donegal man selling off duplicate jerseys. Some rare Ulster campaign finds from the 2010s.'),

  ('11000000-0000-4000-8000-000000000007',
   'CorkCollector', null, 'Cork',
   'Leeside collector. Hurling and football. Fair prices, honest descriptions. Rebel til I die.')

ON CONFLICT (id) DO NOTHING;


-- Step 3 — fill in your own bio/county only if currently blank
UPDATE profiles
SET
  county = COALESCE(NULLIF(trim(county), ''), 'Dublin'),
  bio    = COALESCE(NULLIF(trim(bio),    ''),
             'Dublin native, collecting county jerseys since 2015. Always on the lookout for rare finds. Hill 16 and proud.')
WHERE lower(username) = 'conradfegan04';
