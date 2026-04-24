-- ============================================================
-- GAA Exchange — Demo Seed Script
-- Schema verified via information_schema.columns 2026-04-08
--
-- Paste each section separately into Supabase SQL Editor.
-- Sections that reference Conradfegan04 use a runtime lookup
-- so they are safe regardless of your actual UUID.
--
-- Fixed UUID prefixes used (will not collide with real data):
--   11…  demo auth/profile users
--   22…  demo listings
--   33…  demo listing_images
--   77…  demo likes
--   44…  demo messages
--   55…  demo reviews
--   66…  demo reports
-- ============================================================


-- ============================================================
-- SECTION: profiles
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


-- ============================================================
-- SECTION: listings
-- ============================================================
-- condition enum values : new | like_new | good | fair | poor
-- size enum values       : XS | S | M | L | XL | XXL | XXXL
-- release_year           : smallint (nullable)
-- ============================================================
DO $$
DECLARE
  u_me    uuid;

  u_kerry  CONSTANT uuid := '11000000-0000-4000-8000-000000000001';
  u_mayo   CONSTANT uuid := '11000000-0000-4000-8000-000000000002';
  u_galway CONSTANT uuid := '11000000-0000-4000-8000-000000000003';
  u_tipp   CONSTANT uuid := '11000000-0000-4000-8000-000000000004';
  u_dub    CONSTANT uuid := '11000000-0000-4000-8000-000000000005';
  u_don    CONSTANT uuid := '11000000-0000-4000-8000-000000000006';
  u_cork   CONSTANT uuid := '11000000-0000-4000-8000-000000000007';

  l01  CONSTANT uuid := '22000000-0000-4000-8000-000000000001';
  l02  CONSTANT uuid := '22000000-0000-4000-8000-000000000002';
  l03  CONSTANT uuid := '22000000-0000-4000-8000-000000000003';
  l04  CONSTANT uuid := '22000000-0000-4000-8000-000000000004';
  l05  CONSTANT uuid := '22000000-0000-4000-8000-000000000005';
  l06  CONSTANT uuid := '22000000-0000-4000-8000-000000000006';
  l07  CONSTANT uuid := '22000000-0000-4000-8000-000000000007';
  l08  CONSTANT uuid := '22000000-0000-4000-8000-000000000008';
  l09  CONSTANT uuid := '22000000-0000-4000-8000-000000000009';
  l10  CONSTANT uuid := '22000000-0000-4000-8000-000000000010';
  l11  CONSTANT uuid := '22000000-0000-4000-8000-000000000011';
  l12  CONSTANT uuid := '22000000-0000-4000-8000-000000000012';
  l13  CONSTANT uuid := '22000000-0000-4000-8000-000000000013';
  l14  CONSTANT uuid := '22000000-0000-4000-8000-000000000014';
  l15  CONSTANT uuid := '22000000-0000-4000-8000-000000000015';
  l16  CONSTANT uuid := '22000000-0000-4000-8000-000000000016';

BEGIN
  SELECT id INTO u_me
  FROM   profiles
  WHERE  lower(username) = 'conradfegan04'
  LIMIT  1;

  IF u_me IS NULL THEN
    RAISE EXCEPTION 'Profile Conradfegan04 not found. Run the profiles section first.';
  END IF;

  INSERT INTO listings
    (id, user_id, title, description, county, size, condition,
     release_year, price, is_sold, created_at)
  VALUES
    -- ── Conradfegan04 ──────────────────────────────────────
    (l01, u_me,
     'Dublin Home Jersey 2023',
     'Player-fit Dublin home jersey from the 2023 season. Purchased from the official GAA store, never worn in a match. Hill 16 forever.',
     'Dublin', 'L', 'new', 2023, 55.00, false,
     now() - interval '12 days'),

    (l02, u_me,
     'Dublin Away Jersey 2021',
     'Dublin away jersey from the 2021 All-Ireland winning campaign. Worn twice, washed carefully. A piece of Dublin history.',
     'Dublin', 'M', 'good', 2021, 35.00, true,
     now() - interval '22 days'),

    (l03, u_me,
     'Wexford Home Jersey 2020',
     'Bought as a gift — unfortunately the wrong size. Brand new with original tags still attached.',
     'Wexford', 'S', 'new', 2020, 30.00, false,
     now() - interval '8 days'),

    -- ── KerryKing1982 ──────────────────────────────────────
    (l04, u_kerry,
     'Kerry Home Jersey 2023',
     'Official Kerry home jersey 2023. Worn once to a league game, in perfect condition. The Kingdom forever — Sam is coming home!',
     'Kerry', 'L', 'like_new', 2023, 45.00, false,
     now() - interval '10 days'),

    (l05, u_kerry,
     'Kerry Away Jersey 2022',
     'Kerry away jersey 2022. Great condition, washed after each wear. Selling to make room for the 2023 away kit.',
     'Kerry', 'XL', 'good', 2022, 40.00, false,
     now() - interval '18 days'),

    -- ── MayoMadra ─────────────────────────────────────────
    (l06, u_mayo,
     'Mayo Home Jersey 2021',
     'Mayo home jersey from 2021. Worn twice, genuinely like new. Still waiting on that All-Ireland but the jersey is class.',
     'Mayo', 'L', 'like_new', 2021, 38.00, false,
     now() - interval '6 days'),

    (l07, u_mayo,
     'Mayo Away Jersey 2019',
     'Older Mayo away jersey from 2019. Good condition — slight fade on the crest from washing, priced accordingly.',
     'Mayo', 'M', 'good', 2019, 25.00, false,
     now() - interval '20 days'),

    -- ── GalwayTribeJerseys ────────────────────────────────
    (l08, u_galway,
     'Galway Home Jersey 2023',
     'Brand new Galway home jersey 2023. Purchased online, never worn. Comes with original packaging. Maroon and white done right.',
     'Galway', 'XL', 'new', 2023, 60.00, false,
     now() - interval '4 days'),

    (l09, u_galway,
     'Galway Hurling Jersey 2018',
     'Galway hurling jersey from 2018 — the year they won Leinster! Good condition with some wear around the collar.',
     'Galway', 'L', 'good', 2018, 28.00, false,
     now() - interval '25 days'),

    -- ── TippFan2023 ───────────────────────────────────────
    (l10, u_tipp,
     'Tipperary Home Jersey 2022',
     'Tipperary home jersey 2022. Like new, worn once to a league match in Thurles. Premier County blue and gold.',
     'Tipperary', 'M', 'like_new', 2022, 42.00, false,
     now() - interval '9 days'),

    (l11, u_tipp,
     'Tipperary Vintage Jersey 2016',
     'Vintage Tipperary jersey from the 2016 Munster campaign. Fair condition with some fading — priced to reflect. A rare find.',
     'Tipperary', 'L', 'fair', 2016, 22.00, true,
     now() - interval '30 days'),

    -- ── DublinJerseyStore ─────────────────────────────────
    (l12, u_dub,
     'Dublin Home Jersey 2024',
     'Dublin home jersey 2024 — fresh stock. Multiple sizes may be available, message me. Fast postage from D7.',
     'Dublin', 'XL', 'new', 2024, 65.00, false,
     now() - interval '3 days'),

    (l13, u_dub,
     'Dublin Training Jersey 2023',
     'Dublin training jersey from 2023. Great for training or casual wear. Well kept, size L.',
     'Dublin', 'L', 'good', 2023, 38.00, false,
     now() - interval '14 days'),

    -- ── DonegalDeals ──────────────────────────────────────
    (l14, u_don,
     'Donegal All-Ireland Jersey 2012',
     'Replica Donegal jersey from their legendary 2012 All-Ireland winning year. Good condition with some age-related wear.',
     'Donegal', 'M', 'good', 2012, 45.00, false,
     now() - interval '7 days'),

    (l15, u_don,
     'Donegal Home Jersey 2019',
     'Donegal home jersey from the 2019 Ulster Championship season. Like new, carefully stored. Gold and green in perfect nick.',
     'Donegal', 'L', 'like_new', 2019, 50.00, false,
     now() - interval '16 days'),

    -- ── CorkCollector ─────────────────────────────────────
    (l16, u_cork,
     'Cork Hurling Jersey 2023',
     'Cork hurling jersey 2023. Rebel County pride. Barely worn, pristine condition. Blood and bandage at its finest.',
     'Cork', 'M', 'like_new', 2023, 55.00, false,
     now() - interval '5 days')

  ON CONFLICT (id) DO NOTHING;
END $$;


-- ============================================================
-- SECTION: listing_images
-- ============================================================
-- image_type enum values: front | back | tag | main | detail
-- sort_order: smallint NOT NULL (default 0, we use 1-4)
-- Listing UUIDs are all fixed so no runtime lookup needed.
-- ============================================================
INSERT INTO listing_images (id, listing_id, image_url, image_type, sort_order)
VALUES
  -- l01  Dublin Home 2023
  ('33000001-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000001','https://picsum.photos/seed/gaa-l01-front/600/800', 'front',  1),
  ('33000001-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000001','https://picsum.photos/seed/gaa-l01-back/600/800',  'back',   2),
  ('33000001-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000001','https://picsum.photos/seed/gaa-l01-tag/400/400',   'tag',    3),
  ('33000001-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000001','https://picsum.photos/seed/gaa-l01-dtl/600/800',   'detail', 4),
  -- l02  Dublin Away 2021
  ('33000002-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000002','https://picsum.photos/seed/gaa-l02-front/600/800', 'front',  1),
  ('33000002-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000002','https://picsum.photos/seed/gaa-l02-back/600/800',  'back',   2),
  ('33000002-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000002','https://picsum.photos/seed/gaa-l02-tag/400/400',   'tag',    3),
  ('33000002-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000002','https://picsum.photos/seed/gaa-l02-dtl/600/800',   'detail', 4),
  -- l03  Wexford Home 2020
  ('33000003-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000003','https://picsum.photos/seed/gaa-l03-front/600/800', 'front',  1),
  ('33000003-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000003','https://picsum.photos/seed/gaa-l03-back/600/800',  'back',   2),
  ('33000003-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000003','https://picsum.photos/seed/gaa-l03-tag/400/400',   'tag',    3),
  ('33000003-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000003','https://picsum.photos/seed/gaa-l03-dtl/600/800',   'detail', 4),
  -- l04  Kerry Home 2023
  ('33000004-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000004','https://picsum.photos/seed/gaa-l04-front/600/800', 'front',  1),
  ('33000004-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000004','https://picsum.photos/seed/gaa-l04-back/600/800',  'back',   2),
  ('33000004-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000004','https://picsum.photos/seed/gaa-l04-tag/400/400',   'tag',    3),
  ('33000004-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000004','https://picsum.photos/seed/gaa-l04-dtl/600/800',   'detail', 4),
  -- l05  Kerry Away 2022
  ('33000005-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000005','https://picsum.photos/seed/gaa-l05-front/600/800', 'front',  1),
  ('33000005-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000005','https://picsum.photos/seed/gaa-l05-back/600/800',  'back',   2),
  ('33000005-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000005','https://picsum.photos/seed/gaa-l05-tag/400/400',   'tag',    3),
  ('33000005-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000005','https://picsum.photos/seed/gaa-l05-dtl/600/800',   'detail', 4),
  -- l06  Mayo Home 2021
  ('33000006-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000006','https://picsum.photos/seed/gaa-l06-front/600/800', 'front',  1),
  ('33000006-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000006','https://picsum.photos/seed/gaa-l06-back/600/800',  'back',   2),
  ('33000006-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000006','https://picsum.photos/seed/gaa-l06-tag/400/400',   'tag',    3),
  ('33000006-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000006','https://picsum.photos/seed/gaa-l06-dtl/600/800',   'detail', 4),
  -- l07  Mayo Away 2019
  ('33000007-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000007','https://picsum.photos/seed/gaa-l07-front/600/800', 'front',  1),
  ('33000007-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000007','https://picsum.photos/seed/gaa-l07-back/600/800',  'back',   2),
  ('33000007-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000007','https://picsum.photos/seed/gaa-l07-tag/400/400',   'tag',    3),
  ('33000007-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000007','https://picsum.photos/seed/gaa-l07-dtl/600/800',   'detail', 4),
  -- l08  Galway Home 2023
  ('33000008-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000008','https://picsum.photos/seed/gaa-l08-front/600/800', 'front',  1),
  ('33000008-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000008','https://picsum.photos/seed/gaa-l08-back/600/800',  'back',   2),
  ('33000008-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000008','https://picsum.photos/seed/gaa-l08-tag/400/400',   'tag',    3),
  ('33000008-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000008','https://picsum.photos/seed/gaa-l08-dtl/600/800',   'detail', 4),
  -- l09  Galway Hurling 2018
  ('33000009-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000009','https://picsum.photos/seed/gaa-l09-front/600/800', 'front',  1),
  ('33000009-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000009','https://picsum.photos/seed/gaa-l09-back/600/800',  'back',   2),
  ('33000009-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000009','https://picsum.photos/seed/gaa-l09-tag/400/400',   'tag',    3),
  ('33000009-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000009','https://picsum.photos/seed/gaa-l09-dtl/600/800',   'detail', 4),
  -- l10  Tipperary Home 2022
  ('33000010-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000010','https://picsum.photos/seed/gaa-l10-front/600/800', 'front',  1),
  ('33000010-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000010','https://picsum.photos/seed/gaa-l10-back/600/800',  'back',   2),
  ('33000010-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000010','https://picsum.photos/seed/gaa-l10-tag/400/400',   'tag',    3),
  ('33000010-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000010','https://picsum.photos/seed/gaa-l10-dtl/600/800',   'detail', 4),
  -- l11  Tipperary Vintage 2016
  ('33000011-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000011','https://picsum.photos/seed/gaa-l11-front/600/800', 'front',  1),
  ('33000011-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000011','https://picsum.photos/seed/gaa-l11-back/600/800',  'back',   2),
  ('33000011-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000011','https://picsum.photos/seed/gaa-l11-tag/400/400',   'tag',    3),
  ('33000011-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000011','https://picsum.photos/seed/gaa-l11-dtl/600/800',   'detail', 4),
  -- l12  Dublin Home 2024
  ('33000012-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000012','https://picsum.photos/seed/gaa-l12-front/600/800', 'front',  1),
  ('33000012-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000012','https://picsum.photos/seed/gaa-l12-back/600/800',  'back',   2),
  ('33000012-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000012','https://picsum.photos/seed/gaa-l12-tag/400/400',   'tag',    3),
  ('33000012-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000012','https://picsum.photos/seed/gaa-l12-dtl/600/800',   'detail', 4),
  -- l13  Dublin Training 2023
  ('33000013-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000013','https://picsum.photos/seed/gaa-l13-front/600/800', 'front',  1),
  ('33000013-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000013','https://picsum.photos/seed/gaa-l13-back/600/800',  'back',   2),
  ('33000013-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000013','https://picsum.photos/seed/gaa-l13-tag/400/400',   'tag',    3),
  ('33000013-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000013','https://picsum.photos/seed/gaa-l13-dtl/600/800',   'detail', 4),
  -- l14  Donegal All-Ireland 2012
  ('33000014-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000014','https://picsum.photos/seed/gaa-l14-front/600/800', 'front',  1),
  ('33000014-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000014','https://picsum.photos/seed/gaa-l14-back/600/800',  'back',   2),
  ('33000014-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000014','https://picsum.photos/seed/gaa-l14-tag/400/400',   'tag',    3),
  ('33000014-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000014','https://picsum.photos/seed/gaa-l14-dtl/600/800',   'detail', 4),
  -- l15  Donegal Home 2019
  ('33000015-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000015','https://picsum.photos/seed/gaa-l15-front/600/800', 'front',  1),
  ('33000015-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000015','https://picsum.photos/seed/gaa-l15-back/600/800',  'back',   2),
  ('33000015-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000015','https://picsum.photos/seed/gaa-l15-tag/400/400',   'tag',    3),
  ('33000015-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000015','https://picsum.photos/seed/gaa-l15-dtl/600/800',   'detail', 4),
  -- l16  Cork Hurling 2023
  ('33000016-0001-4000-8000-000000000000','22000000-0000-4000-8000-000000000016','https://picsum.photos/seed/gaa-l16-front/600/800', 'front',  1),
  ('33000016-0002-4000-8000-000000000000','22000000-0000-4000-8000-000000000016','https://picsum.photos/seed/gaa-l16-back/600/800',  'back',   2),
  ('33000016-0003-4000-8000-000000000000','22000000-0000-4000-8000-000000000016','https://picsum.photos/seed/gaa-l16-tag/400/400',   'tag',    3),
  ('33000016-0004-4000-8000-000000000000','22000000-0000-4000-8000-000000000016','https://picsum.photos/seed/gaa-l16-dtl/600/800',   'detail', 4)

ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SECTION: likes
-- ============================================================
-- likes.id is NOT NULL (gen_random_uuid() default).
-- Fixed UUIDs used here so the section is idempotent.
-- ============================================================
DO $$
DECLARE
  u_me    uuid;

  u_kerry  CONSTANT uuid := '11000000-0000-4000-8000-000000000001';
  u_mayo   CONSTANT uuid := '11000000-0000-4000-8000-000000000002';
  u_galway CONSTANT uuid := '11000000-0000-4000-8000-000000000003';
  u_tipp   CONSTANT uuid := '11000000-0000-4000-8000-000000000004';
  u_dub    CONSTANT uuid := '11000000-0000-4000-8000-000000000005';
  u_don    CONSTANT uuid := '11000000-0000-4000-8000-000000000006';
  u_cork   CONSTANT uuid := '11000000-0000-4000-8000-000000000007';

  -- listing UUIDs for readability
  l01 CONSTANT uuid := '22000000-0000-4000-8000-000000000001';
  l03 CONSTANT uuid := '22000000-0000-4000-8000-000000000003';
  l04 CONSTANT uuid := '22000000-0000-4000-8000-000000000004';
  l06 CONSTANT uuid := '22000000-0000-4000-8000-000000000006';
  l08 CONSTANT uuid := '22000000-0000-4000-8000-000000000008';
  l09 CONSTANT uuid := '22000000-0000-4000-8000-000000000009';
  l12 CONSTANT uuid := '22000000-0000-4000-8000-000000000012';
  l14 CONSTANT uuid := '22000000-0000-4000-8000-000000000014';
  l15 CONSTANT uuid := '22000000-0000-4000-8000-000000000015';

BEGIN
  SELECT id INTO u_me FROM profiles WHERE lower(username) = 'conradfegan04' LIMIT 1;
  IF u_me IS NULL THEN
    RAISE EXCEPTION 'Profile Conradfegan04 not found.';
  END IF;

  INSERT INTO likes (id, user_id, listing_id, created_at)
  VALUES
    -- Conrad likes 5 listings
    ('77000000-0000-4000-8000-000000000001', u_me,     l04, now() - interval '9 days'),
    ('77000000-0000-4000-8000-000000000002', u_me,     l06, now() - interval '5 days'),
    ('77000000-0000-4000-8000-000000000003', u_me,     l08, now() - interval '3 days'),
    ('77000000-0000-4000-8000-000000000004', u_me,     l14, now() - interval '6 days'),
    ('77000000-0000-4000-8000-000000000005', u_me,     l15, now() - interval '2 days'),
    -- Others like Conrad's listings
    ('77000000-0000-4000-8000-000000000006', u_kerry,  l01, now() - interval '10 days'),
    ('77000000-0000-4000-8000-000000000007', u_galway, l01, now() - interval '4 days'),
    ('77000000-0000-4000-8000-000000000008', u_cork,   l01, now() - interval '1 day'),
    ('77000000-0000-4000-8000-000000000009', u_dub,    l03, now() - interval '7 days'),
    -- Cross-user likes
    ('77000000-0000-4000-8000-000000000010', u_mayo,   l04, now() - interval '8 days'),
    ('77000000-0000-4000-8000-000000000011', u_mayo,   l12, now() - interval '2 days'),
    ('77000000-0000-4000-8000-000000000012', u_tipp,   l04, now() - interval '9 days'),
    ('77000000-0000-4000-8000-000000000013', u_dub,    l04, now() - interval '11 days'),
    ('77000000-0000-4000-8000-000000000014', u_don,    l08, now() - interval '3 days'),
    ('77000000-0000-4000-8000-000000000015', u_cork,   l14, now() - interval '5 days'),
    ('77000000-0000-4000-8000-000000000016', u_kerry,  l09, now() - interval '20 days')

  ON CONFLICT (id) DO NOTHING;
END $$;


-- ============================================================
-- SECTION: reviews
-- ============================================================
DO $$
DECLARE
  u_me    uuid;

  u_kerry  CONSTANT uuid := '11000000-0000-4000-8000-000000000001';
  u_mayo   CONSTANT uuid := '11000000-0000-4000-8000-000000000002';
  u_galway CONSTANT uuid := '11000000-0000-4000-8000-000000000003';
  u_dub    CONSTANT uuid := '11000000-0000-4000-8000-000000000005';
  u_don    CONSTANT uuid := '11000000-0000-4000-8000-000000000006';
  u_cork   CONSTANT uuid := '11000000-0000-4000-8000-000000000007';
  u_tipp   CONSTANT uuid := '11000000-0000-4000-8000-000000000004';

BEGIN
  SELECT id INTO u_me FROM profiles WHERE lower(username) = 'conradfegan04' LIMIT 1;
  IF u_me IS NULL THEN
    RAISE EXCEPTION 'Profile Conradfegan04 not found.';
  END IF;

  INSERT INTO reviews (id, reviewer_id, reviewed_user_id, rating, comment, created_at)
  VALUES
    -- Reviews left FOR Conrad (reviewer → Conrad)
    ('55000000-0000-4000-8000-000000000001', u_kerry,  u_me,
     5, 'Great buyer — transferred payment straight away, no messing. Would sell to him again without hesitation.',
     now() - interval '20 days'),

    ('55000000-0000-4000-8000-000000000002', u_mayo,   u_me,
     4, 'Good communication throughout. Paid quickly and jersey arrived safely. Solid transaction.',
     now() - interval '15 days'),

    ('55000000-0000-4000-8000-000000000003', u_galway, u_me,
     5, 'Brilliant lad to deal with — sorted everything quickly and was easy to communicate with. Highly recommend.',
     now() - interval '10 days'),

    ('55000000-0000-4000-8000-000000000004', u_don,    u_me,
     5, 'Fast payment, friendly messages. One of the best buyers I''ve dealt with on GAA Exchange.',
     now() - interval '5 days'),

    -- Conrad reviews KerryKing
    ('55000000-0000-4000-8000-000000000005', u_me,     u_kerry,
     5, 'Class seller. Kerry jersey was exactly as described, well packaged and posted the next day. Cheers!',
     now() - interval '18 days'),

    -- Cross-user reviews
    ('55000000-0000-4000-8000-000000000006', u_cork,   u_don,
     5, 'Fast postage and the Donegal 2012 jersey was in great nick. Very happy with the purchase.',
     now() - interval '4 days'),

    ('55000000-0000-4000-8000-000000000007', u_don,    u_cork,
     4, 'Smooth transaction. Paid promptly and was easy to deal with.',
     now() - interval '3 days'),

    ('55000000-0000-4000-8000-000000000008', u_tipp,   u_dub,
     3, 'Jersey was as described but took over a week to post and communication was a bit slow.',
     now() - interval '8 days')

  ON CONFLICT (id) DO NOTHING;
END $$;


-- ============================================================
-- SECTION: messages
-- ============================================================
-- messages.listing_id is NOT NULL — every row must reference
-- a real listing from this seed.
-- 6 threads, 22 messages total.
-- ============================================================
DO $$
DECLARE
  u_me    uuid;

  u_kerry  CONSTANT uuid := '11000000-0000-4000-8000-000000000001';
  u_mayo   CONSTANT uuid := '11000000-0000-4000-8000-000000000002';
  u_galway CONSTANT uuid := '11000000-0000-4000-8000-000000000003';
  u_tipp   CONSTANT uuid := '11000000-0000-4000-8000-000000000004';
  u_dub    CONSTANT uuid := '11000000-0000-4000-8000-000000000005';
  u_don    CONSTANT uuid := '11000000-0000-4000-8000-000000000006';
  u_cork   CONSTANT uuid := '11000000-0000-4000-8000-000000000007';

  l01 CONSTANT uuid := '22000000-0000-4000-8000-000000000001';
  l04 CONSTANT uuid := '22000000-0000-4000-8000-000000000004';
  l05 CONSTANT uuid := '22000000-0000-4000-8000-000000000005';
  l06 CONSTANT uuid := '22000000-0000-4000-8000-000000000006';
  l08 CONSTANT uuid := '22000000-0000-4000-8000-000000000008';
  l14 CONSTANT uuid := '22000000-0000-4000-8000-000000000014';

BEGIN
  SELECT id INTO u_me FROM profiles WHERE lower(username) = 'conradfegan04' LIMIT 1;
  IF u_me IS NULL THEN
    RAISE EXCEPTION 'Profile Conradfegan04 not found.';
  END IF;

  -- Thread 1: Conrad ↔ KerryKing  (re l04 Kerry Home 2023, 5 msgs)
  INSERT INTO messages (id, sender_id, receiver_id, listing_id, content, sent_at)
  VALUES
    ('44000000-0000-4000-8000-000000000001', u_me,    u_kerry, l04,
     'Hi, is the Kerry home jersey still available? Would you take £40 for it?',
     now() - interval '3 days' - interval '50 minutes'),
    ('44000000-0000-4000-8000-000000000002', u_kerry, u_me,    l04,
     'Hey! Yeah still available. Best I can do is £43 — only wore it once at a league game last September.',
     now() - interval '3 days' - interval '40 minutes'),
    ('44000000-0000-4000-8000-000000000003', u_me,    u_kerry, l04,
     'Grand, I''ll take it at £43. Can you post to Dublin?',
     now() - interval '3 days' - interval '28 minutes'),
    ('44000000-0000-4000-8000-000000000004', u_kerry, u_me,    l04,
     'No bother, I''ll use An Post tracked — about €5. Want to sort payment by bank transfer?',
     now() - interval '3 days' - interval '15 minutes'),
    ('44000000-0000-4000-8000-000000000005', u_me,    u_kerry, l04,
     'Perfect. Send me your details and I''ll transfer now.',
     now() - interval '3 days' - interval '5 minutes')
  ON CONFLICT (id) DO NOTHING;

  -- Thread 2: Conrad ↔ MayoMadra  (re l06 Mayo Home 2021, 4 msgs)
  INSERT INTO messages (id, sender_id, receiver_id, listing_id, content, sent_at)
  VALUES
    ('44000000-0000-4000-8000-000000000006', u_me,   u_mayo, l06,
     'Hi, what size is the Mayo jersey? And would you consider £35?',
     now() - interval '2 days' - interval '3 hours'),
    ('44000000-0000-4000-8000-000000000007', u_mayo, u_me,   l06,
     'It''s a Large, fits true to size. Lowest I''d go is £36 — it''s barely been worn.',
     now() - interval '2 days' - interval '150 minutes'),
    ('44000000-0000-4000-8000-000000000008', u_me,   u_mayo, l06,
     'Fair enough, £36 works. Can you post Monday?',
     now() - interval '2 days' - interval '120 minutes'),
    ('44000000-0000-4000-8000-000000000009', u_mayo, u_me,   l06,
     'Monday is perfect. I''ll drop it to the post office first thing.',
     now() - interval '2 days' - interval '90 minutes')
  ON CONFLICT (id) DO NOTHING;

  -- Thread 3: GalwayTribeJerseys → Conrad  (re l01 Dublin Home 2023, 4 msgs)
  INSERT INTO messages (id, sender_id, receiver_id, listing_id, content, sent_at)
  VALUES
    ('44000000-0000-4000-8000-000000000010', u_galway, u_me,     l01,
     'Hi there — any chance you''d swap the Dublin Home 2023 for my Galway Home 2023? Straight swap, both brand new.',
     now() - interval '1 day' - interval '5 hours'),
    ('44000000-0000-4000-8000-000000000011', u_me,     u_galway, l01,
     'Ha, interesting idea! Which listing is it?',
     now() - interval '1 day' - interval '4 hours'),
    ('44000000-0000-4000-8000-000000000012', u_galway, u_me,     l01,
     'The Galway Home 2023 I have listed here too — brand new, straight swap.',
     now() - interval '1 day' - interval '3 hours'),
    ('44000000-0000-4000-8000-000000000013', u_me,     u_galway, l01,
     'Tempting but I think I''d rather sell for now. Cheers for reaching out — class jersey though!',
     now() - interval '1 day' - interval '2 hours')
  ON CONFLICT (id) DO NOTHING;

  -- Thread 4: DublinJerseyStore → Conrad  (re l01 Dublin Home 2023, 4 msgs)
  INSERT INTO messages (id, sender_id, receiver_id, listing_id, content, sent_at)
  VALUES
    ('44000000-0000-4000-8000-000000000014', u_dub,  u_me,  l01,
     'Is the Dublin Home 2023 still available?',
     now() - interval '4 hours' - interval '30 minutes'),
    ('44000000-0000-4000-8000-000000000015', u_me,   u_dub, l01,
     'Yes still here!',
     now() - interval '4 hours' - interval '15 minutes'),
    ('44000000-0000-4000-8000-000000000016', u_dub,  u_me,  l01,
     'Would you take £50? I''m in D6 so I can collect, save you the postage.',
     now() - interval '3 hours' - interval '45 minutes'),
    ('44000000-0000-4000-8000-000000000017', u_me,   u_dub, l01,
     'Listed at £55 but yeah, £50 is fine if collecting. Message me when you''re free to come over.',
     now() - interval '3 hours')
  ON CONFLICT (id) DO NOTHING;

  -- Thread 5: TippFan2023 ↔ KerryKing1982  (re l05 Kerry Away 2022, 2 msgs)
  INSERT INTO messages (id, sender_id, receiver_id, listing_id, content, sent_at)
  VALUES
    ('44000000-0000-4000-8000-000000000018', u_tipp,  u_kerry, l05,
     'Hi, is the Kerry Away 2022 still available? Any room on the price at all?',
     now() - interval '5 days' - interval '2 hours'),
    ('44000000-0000-4000-8000-000000000019', u_kerry, u_tipp,  l05,
     'Still here yeah. I could do £38 if that works for you?',
     now() - interval '5 days' - interval '1 hour')
  ON CONFLICT (id) DO NOTHING;

  -- Thread 6: CorkCollector ↔ DonegalDeals  (re l14 Donegal 2012, 3 msgs)
  INSERT INTO messages (id, sender_id, receiver_id, listing_id, content, sent_at)
  VALUES
    ('44000000-0000-4000-8000-000000000020', u_cork,  u_don,  l14,
     'How much to post the Donegal 2012 jersey down to Cork?',
     now() - interval '6 days' - interval '3 hours'),
    ('44000000-0000-4000-8000-000000000021', u_don,   u_cork, l14,
     'Should be about €7 tracked with An Post. Can get it in Monday.',
     now() - interval '6 days' - interval '2 hours'),
    ('44000000-0000-4000-8000-000000000022', u_cork,  u_don,  l14,
     'Sorted, I''ll take it. Sending payment now via Revolut.',
     now() - interval '6 days' - interval '1 hour')
  ON CONFLICT (id) DO NOTHING;

END $$;


-- ============================================================
-- SECTION: reports
-- ============================================================
-- Real columns: id, reporter_id, listing_id (NOT NULL),
--               reason (NOT NULL), details (nullable),
--               created_at.
-- Both reports reference an existing listing.
-- No runtime lookup needed — all UUIDs are fixed.
-- ============================================================
INSERT INTO reports (id, reporter_id, listing_id, reason, details, created_at)
VALUES
  -- TippFan reports Cork Hurling 2023 (l16) as suspected counterfeit
  ('66000000-0000-4000-8000-000000000001',
   '11000000-0000-4000-8000-000000000004',   -- reporter: TippFan2023
   '22000000-0000-4000-8000-000000000016',   -- listing:  Cork Hurling 2023
   'Suspected counterfeit',
   'Stitching pattern does not match authentic O''Neills specification. Crest print looks off compared to official stock.',
   now() - interval '2 days'),

  -- MayoMadra reports Dublin Home 2024 (l12) for suspicious pricing
  ('66000000-0000-4000-8000-000000000002',
   '11000000-0000-4000-8000-000000000002',   -- reporter: MayoMadra
   '22000000-0000-4000-8000-000000000012',   -- listing:  Dublin Home 2024
   'Suspicious pricing',
   'Same jersey listed across multiple accounts at inflated prices. Possible bulk commercial reseller operating on the platform.',
   now() - interval '1 day')

ON CONFLICT (id) DO NOTHING;
