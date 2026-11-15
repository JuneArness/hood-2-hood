-- Hood 2 Hood Rydas: Showroom, Events, Get Involved, Neighborhood Voices and Team.
-- Run ONCE in Supabase > SQL Editor > New query on a NEW project. Paste everything, press Run.
-- Security model:
--   * The website only calls the functions below. Browsers never touch tables directly.
--   * Visitors can see PUBLISHED cars and events with their photos, APPROVED neighborhood
--     stories (never the writer's email or phone), and can send forms and stories.
--   * Photos live in a PUBLIC bucket (they're meant to be seen); only staff can add or remove them.
--   * Staff are the logins listed in public.admins. "owner" can also add and remove staff.
-- Errors use the format "CODE|message".

-- ------------------------------------------------------------------ tables
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create table public.cars (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),                -- e.g. MelTee
  year int check (year is null or year between 1900 and 2100),
  make text not null default '' check (length(make) <= 40),
  model text not null default '' check (length(model) <= 60),
  wrap_name text not null default '' check (length(wrap_name) <= 60),       -- e.g. Alien Skin
  owner_name text not null default '' check (length(owner_name) <= 80),
  tagline text not null default '' check (length(tagline) <= 160),
  story text not null default '' check (length(story) <= 4000),
  specs jsonb not null default '[]'::jsonb,                                  -- [{label, value}]
  anthem_url text not null default '' check (anthem_url = '' or anthem_url ~ '^https://(www\.|m\.)?(youtube\.com/(watch\?v=|shorts/)|youtu\.be/)[A-Za-z0-9_-]{11}([?&#][^\s<>"]*)?$'),
  accent text not null default '#39f3ff' check (accent ~ '^#[0-9a-fA-F]{6}$'), -- showroom light color
  mode text not null default 'ring' check (mode in ('ring', 'film')),        -- gallery style
  speed int not null default 5 check (speed between 2 and 15),               -- seconds per photo
  bay int not null default 0,
  featured boolean not null default false,
  published boolean not null default false,
  cover_photo_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  event_date date not null,
  end_date date,
  time_text text not null default '' check (length(time_text) <= 80),
  location text not null default '' check (length(location) <= 160),
  summary text not null default '' check (length(summary) <= 400),
  details text not null default '' check (length(details) <= 4000),
  link_url text not null default '' check (link_url = '' or link_url ~ '^https://[^\s<>"]+$'),
  link_label text not null default '' check (length(link_label) <= 40),
  published boolean not null default false,
  cover_photo_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= event_date)
);

-- one photo table for cars and events
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  car_id uuid references public.cars (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  path text not null unique,
  caption text not null default '' check (length(caption) <= 200),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  check (num_nonnulls(car_id, event_id) = 1)
);
create index photos_car on public.photos (car_id, sort);
create index photos_event on public.photos (event_id, sort);
alter table public.cars add constraint cars_cover_fk foreign key (cover_photo_id) references public.photos (id) on delete set null;
alter table public.events add constraint events_cover_fk foreign key (cover_photo_id) references public.photos (id) on delete set null;

-- Donate / Supporter / Volunteer forms (private: only staff can read)
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  kind text not null check (kind in ('donate', 'support', 'volunteer')),
  name text not null check (length(name) between 1 and 100),
  organization text not null default '' check (length(organization) <= 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 160),
  phone text not null default '' check (length(phone) <= 30),
  interests text[] not null default '{}',
  availability text[] not null default '{}',
  adult boolean,
  message text not null default '' check (length(message) <= 3000),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  notes text not null default '' check (length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index requests_created on public.requests (created_at desc);

-- "Speak for your block": public stories. Nothing shows until staff approve it.
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  name text not null default '' check (length(name) <= 80),
  show_name boolean not null default false,
  neighborhood text not null check (length(neighborhood) between 1 and 100),
  city text not null default '' check (length(city) <= 80),
  needs text[] not null default '{}',
  story text not null check (length(story) between 20 and 2000),
  email text not null default '' check (email = '' or (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 160)),
  phone text not null default '' check (length(phone) <= 30),
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  notes text not null default '' check (length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stories_created on public.stories (created_at desc);

-- Club members shown on the website (Home > The Club). Staff add and edit them in Admin > Members.
create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  role text not null default '' check (length(role) <= 60),       -- e.g. Founder & President
  ride text not null default '' check (length(ride) <= 80),       -- e.g. MelTee, 1990 Lincoln Town Car
  bio text not null default '' check (length(bio) <= 600),
  photo_path text check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$'),
  sort int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  target text not null default '',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ security: no direct table access
alter table public.admins enable row level security;
alter table public.cars enable row level security;
alter table public.events enable row level security;
alter table public.photos enable row level security;
alter table public.requests enable row level security;
alter table public.stories enable row level security;
alter table public.members enable row level security;
alter table public.audit_log enable row level security;
revoke all on all tables in schema public from anon, authenticated;

-- ------------------------------------------------------------------ photo storage
-- media: PUBLIC to view. 10 MB per file, images only. Only staff can add/change/remove.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid()) $$;

create function public.is_owner() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and role = 'owner') $$;

create policy "staff manage media" on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin()
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$');

-- ------------------------------------------------------------------ helpers
create function public._require_admin() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH|Please sign in.'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN|Staff access only.'; end if;
end $$;

create function public._require_owner() returns void language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  if not public.is_owner() then raise exception 'FORBIDDEN|Only the club owner account can manage the team.'; end if;
end $$;

create function public._log(p_action text, p_target text) returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor, action, target) values (auth.uid(), p_action, left(coalesce(p_target, ''), 200)) $$;

create function public._txt(p jsonb, k text, maxlen int) returns text language sql immutable set search_path = public as $$
  select left(trim(coalesce(p ->> k, '')), maxlen) $$;

create function public._picks(p jsonb, k text, allowed text[]) returns text[] language plpgsql immutable set search_path = public as $$
declare out text[] := '{}'; v text;
begin
  if p -> k is null or jsonb_typeof(p -> k) <> 'array' then return out; end if;
  for v in select jsonb_array_elements_text(p -> k) loop
    if not (v = any (allowed)) then raise exception 'INVALID|Unknown option: %', left(v, 60); end if;
    if not (v = any (out)) then out := out || v; end if;
  end loop;
  return out;
end $$;

create function public._date(p jsonb, k text) returns date language plpgsql immutable set search_path = public as $$
begin
  if coalesce(trim(p ->> k), '') = '' then return null; end if;
  if (p ->> k) !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID|Dates must look like 2026-05-30.'; end if;
  return (p ->> k)::date;
end $$;

create function public._phone_ok(v text) returns boolean language sql immutable set search_path = public as $$
  select coalesce(v, '') = '' or regexp_replace(v, '\D', '', 'g') ~ '^1?\d{10}$' $$;

create function public._ref(prefix text) returns text language sql volatile set search_path = public as $$
  select prefix || '-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 5)) $$;

create function public._photos(p_kind text, p_owner uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'path', path, 'caption', caption) order by sort, created_at), '[]')
  from public.photos where (p_kind = 'car' and car_id = p_owner) or (p_kind = 'event' and event_id = p_owner) $$;

create function public._car_json(c public.cars) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'name', c.name, 'year', c.year, 'make', c.make, 'model', c.model, 'wrap_name', c.wrap_name,
    'owner_name', c.owner_name, 'tagline', c.tagline, 'story', c.story, 'specs', c.specs, 'anthem_url', c.anthem_url,
    'accent', c.accent, 'mode', c.mode, 'speed', c.speed, 'bay', c.bay, 'featured', c.featured, 'published', c.published,
    'cover', (select path from public.photos where id = c.cover_photo_id), 'cover_photo_id', c.cover_photo_id,
    'photos', public._photos('car', c.id)) $$;

-- ------------------------------------------------------------------ public (anyone)
create function public.list_showroom() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._car_json(c) - 'published' - 'cover_photo_id' order by c.featured desc, c.bay, c.created_at), '[]')
  from public.cars c where c.published $$;

create function public.list_events() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'title', e.title, 'event_date', e.event_date, 'end_date', e.end_date, 'time_text', e.time_text,
      'location', e.location, 'summary', e.summary, 'details', e.details, 'link_url', e.link_url, 'link_label', e.link_label,
      'cover', (select path from public.photos where id = e.cover_photo_id),
      'photos', public._photos('event', e.id)) order by e.event_date desc, e.created_at desc), '[]')
  from public.events e where e.published $$;

create function public.list_members() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role, 'ride', ride, 'bio', bio, 'photo', photo_path)
    order by sort, created_at), '[]') from public.members where published $$;

-- Approved stories only. Never returns email or phone; the name only if the writer allowed it.
create function public.list_stories() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', case when s.show_name then s.name else '' end,
      'neighborhood', s.neighborhood, 'city', s.city, 'needs', s.needs, 'story', s.story, 'created_at', s.created_at)
    order by s.created_at desc), '[]')
  from (select * from public.stories where status = 'approved' order by created_at desc limit 200) s $$;

create function public.submit_request(p jsonb) returns text language plpgsql security definer set search_path = public as $$
declare
  v_ref text; v_kind text := public._txt(p, 'kind', 20); v_email text := lower(public._txt(p, 'email', 160));
  v_interests text[]; v_avail text[] := '{}'; v_adult boolean;
begin
  if public._txt(p, 'website', 200) <> '' then raise exception 'SPAM|Submission blocked.'; end if;   -- honeypot
  if v_kind not in ('donate', 'support', 'volunteer') then raise exception 'INVALID|Unknown form.'; end if;
  if public._txt(p, 'name', 100) = '' then raise exception 'INVALID|Please enter your name.'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID|Please enter a valid email address.'; end if;
  if not public._phone_ok(public._txt(p, 'phone', 30)) then raise exception 'INVALID|Please enter a 10-digit phone number, or leave it blank.'; end if;
  if coalesce((p ->> 'consent')::boolean, false) is not true then raise exception 'INVALID|Please agree to be contacted.'; end if;
  if v_kind = 'donate' then
    v_interests := public._picks(p, 'interests', array['Non-perishable food', 'Clothing', 'Shoes', 'School supplies', 'Money', 'Something else']);
    v_avail := public._picks(p, 'availability', array['Drop off at a show', 'I need a pickup', 'Not sure yet']);
  elsif v_kind = 'support' then
    v_interests := public._picks(p, 'interests', array['Host a show at our park or lot', 'Church partner for redistribution',
      'Business sponsor', 'Food, drinks or vendor booth', 'Media or promotion', 'Something else']);
    if public._txt(p, 'organization', 120) = '' then raise exception 'INVALID|Please enter your church, park, business or organization.'; end if;
  else
    v_interests := public._picks(p, 'interests', array['Show day setup and parking', 'Donation collection and sorting',
      'Delivering to churches', 'Photos and social media', 'Wherever needed']);
    v_avail := public._picks(p, 'availability', array['Weekdays', 'Weekday evenings', 'Weekends']);
    if p ->> 'adult' is null then raise exception 'INVALID|Please tell us if you are 18 or older.'; end if;
    v_adult := (p ->> 'adult')::boolean;
  end if;
  if coalesce(array_length(v_interests, 1), 0) = 0 then raise exception 'INVALID|Please choose at least one option.'; end if;
  if (select count(*) from public.requests where lower(email) = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'LIMIT|We already have several forms from this email today. We will be in touch.'; end if;
  if (select count(*) from public.requests where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'LIMIT|We are receiving a lot of forms right now. Please try again shortly.'; end if;
  loop v_ref := public._ref('H2H'); exit when not exists (select 1 from public.requests where ref = v_ref); end loop;
  insert into public.requests (ref, kind, name, organization, email, phone, interests, availability, adult, message)
  values (v_ref, v_kind, public._txt(p, 'name', 100), public._txt(p, 'organization', 120), v_email, public._txt(p, 'phone', 30),
    v_interests, v_avail, v_adult, public._txt(p, 'message', 3000));
  return v_ref;
end $$;

create function public.submit_story(p jsonb) returns text language plpgsql security definer set search_path = public as $$
declare v_ref text; v_email text := lower(public._txt(p, 'email', 160)); v_story text := public._txt(p, 'story', 2000);
begin
  if public._txt(p, 'website', 200) <> '' then raise exception 'SPAM|Submission blocked.'; end if;
  if public._txt(p, 'neighborhood', 100) = '' then raise exception 'INVALID|Please tell us the neighborhood.'; end if;
  if length(v_story) < 20 then raise exception 'INVALID|Please tell us a little more (at least 20 characters).'; end if;
  if v_email <> '' and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID|Please enter a valid email address, or leave it blank.'; end if;
  if not public._phone_ok(public._txt(p, 'phone', 30)) then raise exception 'INVALID|Please enter a 10-digit phone number, or leave it blank.'; end if;
  if coalesce((p ->> 'consent')::boolean, false) is not true then raise exception 'INVALID|Please confirm the story can be shared after review.'; end if;
  if exists (select 1 from public.stories where story = v_story) then raise exception 'LIMIT|We already received this story. Thank you!'; end if;
  if v_email <> '' and (select count(*) from public.stories where email = v_email and created_at > now() - interval '1 day') >= 3 then
    raise exception 'LIMIT|We already have a few stories from this email today. Thank you!'; end if;
  if (select count(*) from public.stories where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'LIMIT|We are receiving a lot of stories right now. Please try again shortly.'; end if;
  loop v_ref := public._ref('VOICE'); exit when not exists (select 1 from public.stories where ref = v_ref); end loop;
  insert into public.stories (ref, name, show_name, neighborhood, city, needs, story, email, phone)
  values (v_ref, public._txt(p, 'name', 80), coalesce((p ->> 'show_name')::boolean, false) and public._txt(p, 'name', 80) <> '',
    public._txt(p, 'neighborhood', 100), public._txt(p, 'city', 80),
    public._picks(p, 'needs', array['Non-perishable food', 'Clothing', 'Shoes', 'School supplies', 'Something else']),
    v_story, v_email, public._txt(p, 'phone', 30));
  return v_ref;
end $$;

-- ------------------------------------------------------------------ staff
create function public.admin_me() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('signed_in', auth.uid() is not null, 'is_admin', public.is_admin(),
    'role', (select role from public.admins where user_id = auth.uid()),
    'email', (select email from auth.users where id = auth.uid())) $$;

create function public.admin_overview() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'cars', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'year', c.year, 'make', c.make, 'model', c.model,
        'published', c.published, 'featured', c.featured, 'bay', c.bay, 'accent', c.accent,
        'photos', (select count(*) from public.photos ph where ph.car_id = c.id),
        'cover', (select path from public.photos where id = c.cover_photo_id)) order by c.featured desc, c.bay, c.created_at) from public.cars c), '[]'),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'event_date', e.event_date, 'end_date', e.end_date,
        'published', e.published, 'photos', (select count(*) from public.photos ph where ph.event_id = e.id),
        'cover', (select path from public.photos where id = e.cover_photo_id)) order by e.event_date desc, e.created_at desc) from public.events e), '[]'),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'ref', ref, 'kind', kind, 'name', name, 'organization', organization,
        'email', email, 'status', status, 'created_at', created_at) order by created_at desc) from public.requests), '[]'),
    'stories', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'ref', ref, 'neighborhood', neighborhood, 'city', city,
        'status', status, 'created_at', created_at, 'preview', left(story, 90)) order by created_at desc) from public.stories), '[]'),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role, 'ride', ride, 'bio', bio, 'photo', photo_path,
        'published', published) order by sort, created_at) from public.members), '[]'));
end $$;

-- ---- cars (showroom)
create function public._specs(p jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare out jsonb := '[]'::jsonb; it jsonb; l text; v text;
begin
  if p is null or jsonb_typeof(p) <> 'array' then return out; end if;
  if jsonb_array_length(p) > 12 then raise exception 'INVALID|Up to 12 spec lines.'; end if;
  for it in select * from jsonb_array_elements(p) loop
    l := left(trim(coalesce(it ->> 'label', '')), 30); v := left(trim(coalesce(it ->> 'value', '')), 60);
    if l <> '' and v <> '' then out := out || jsonb_build_array(jsonb_build_object('label', l, 'value', v)); end if;
  end loop;
  return out;
end $$;

create function public.admin_get_car(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public._require_admin();
  select public._car_json(c) into r from public.cars c where c.id = p_id;
  if r is null then raise exception 'NOT_FOUND|Car not found.'; end if;
  return r;
end $$;

create function public.admin_save_car(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_year int; v_anthem text := public._txt(p, 'anthem_url', 300); v_accent text := coalesce(nullif(public._txt(p, 'accent', 7), ''), '#39f3ff');
  v_mode text := coalesce(nullif(public._txt(p, 'mode', 10), ''), 'ring'); v_speed int;
begin
  perform public._require_admin();
  if public._txt(p, 'name', 60) = '' then raise exception 'INVALID|Please give the car a name.'; end if;
  if public._txt(p, 'year', 4) <> '' then
    if public._txt(p, 'year', 4) !~ '^\d{4}$' then raise exception 'INVALID|Year must be 4 digits, like 1990.'; end if;
    v_year := public._txt(p, 'year', 4)::int;
    if v_year < 1900 or v_year > 2100 then raise exception 'INVALID|Please check the year.'; end if;
  end if;
  if v_anthem <> '' and v_anthem !~ '^https://(www\.|m\.)?(youtube\.com/(watch\?v=|shorts/)|youtu\.be/)[A-Za-z0-9_-]{11}([?&#][^\s<>"]*)?$' then
    raise exception 'INVALID|The anthem must be a YouTube link (https://youtu.be/... or https://www.youtube.com/watch?v=...).'; end if;
  if v_accent !~ '^#[0-9a-fA-F]{6}$' then raise exception 'INVALID|Please pick a light color.'; end if;
  if v_mode not in ('ring', 'film') then raise exception 'INVALID|Unknown gallery style.'; end if;
  v_speed := least(15, greatest(2, coalesce(nullif(public._txt(p, 'speed', 3), '')::int, 5)));
  if nullif(p ->> 'id', '') is null then
    insert into public.cars (name, year, make, model, wrap_name, owner_name, tagline, story, specs, anthem_url, accent, mode, speed, bay, featured, published)
    values (public._txt(p, 'name', 60), v_year, public._txt(p, 'make', 40), public._txt(p, 'model', 60), public._txt(p, 'wrap_name', 60),
      public._txt(p, 'owner_name', 80), public._txt(p, 'tagline', 160), public._txt(p, 'story', 4000), public._specs(p -> 'specs'),
      v_anthem, lower(v_accent), v_mode, v_speed, coalesce((select max(bay) + 1 from public.cars), 1),
      coalesce((p ->> 'featured')::boolean, false), coalesce((p ->> 'published')::boolean, false))
    returning id into v_id;
    perform public._log('car.create', v_id::text);
  else
    update public.cars set name = public._txt(p, 'name', 60), year = v_year, make = public._txt(p, 'make', 40), model = public._txt(p, 'model', 60),
      wrap_name = public._txt(p, 'wrap_name', 60), owner_name = public._txt(p, 'owner_name', 80), tagline = public._txt(p, 'tagline', 160),
      story = public._txt(p, 'story', 4000), specs = public._specs(p -> 'specs'), anthem_url = v_anthem, accent = lower(v_accent),
      mode = v_mode, speed = v_speed, featured = coalesce((p ->> 'featured')::boolean, false),
      published = coalesce((p ->> 'published')::boolean, false), updated_at = now()
    where id = (p ->> 'id')::uuid returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND|Car not found.'; end if;
    perform public._log('car.update', v_id::text);
  end if;
  return v_id;
end $$;

-- Move a car one bay earlier (-1) or later (1) on the showroom floor.
create function public.admin_move_car(p_id uuid, p_dir int) returns void language plpgsql security definer set search_path = public as $$
declare me public.cars; other public.cars;
begin
  perform public._require_admin();
  update public.cars c set bay = x.rn from (select id, row_number() over (order by bay, created_at) as rn from public.cars) x where c.id = x.id;
  select * into me from public.cars where id = p_id;
  if me.id is null then raise exception 'NOT_FOUND|Car not found.'; end if;
  select * into other from public.cars where bay = me.bay + sign(p_dir)::int;
  if other.id is null then return; end if;
  update public.cars set bay = other.bay where id = me.id;
  update public.cars set bay = me.bay where id = other.id;
end $$;

create function public.admin_delete_car(p_id uuid) returns text[] language plpgsql security definer set search_path = public as $$
declare v_paths text[];
begin
  perform public._require_admin();
  select coalesce(array_agg(path), '{}') into v_paths from public.photos where car_id = p_id;
  update public.cars set cover_photo_id = null where id = p_id;
  delete from public.cars where id = p_id;
  if not found then raise exception 'NOT_FOUND|Car not found.'; end if;
  perform public._log('car.delete', p_id::text);
  return v_paths;
end $$;

-- ---- events
create function public.admin_get_event(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public._require_admin();
  select to_jsonb(e) || jsonb_build_object('photos', public._photos('event', e.id)) into r from public.events e where e.id = p_id;
  if r is null then raise exception 'NOT_FOUND|Event not found.'; end if;
  return r;
end $$;

create function public.admin_save_event(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_start date := public._date(p, 'event_date'); v_end date := public._date(p, 'end_date');
begin
  perform public._require_admin();
  if public._txt(p, 'title', 120) = '' then raise exception 'INVALID|Please give the event a title.'; end if;
  if v_start is null then raise exception 'INVALID|Please choose the event date.'; end if;
  if v_end is not null and v_end < v_start then raise exception 'INVALID|The end date can’t be before the start date.'; end if;
  if v_end = v_start then v_end := null; end if;
  if public._txt(p, 'link_url', 500) <> '' and public._txt(p, 'link_url', 500) !~ '^https://[^\s<>"]+$' then
    raise exception 'INVALID|The link must start with https://'; end if;
  if nullif(p ->> 'id', '') is null then
    insert into public.events (title, event_date, end_date, time_text, location, summary, details, link_url, link_label, published)
    values (public._txt(p, 'title', 120), v_start, v_end, public._txt(p, 'time_text', 80), public._txt(p, 'location', 160),
      public._txt(p, 'summary', 400), public._txt(p, 'details', 4000), public._txt(p, 'link_url', 500), public._txt(p, 'link_label', 40),
      coalesce((p ->> 'published')::boolean, false))
    returning id into v_id;
    perform public._log('event.create', v_id::text);
  else
    update public.events set title = public._txt(p, 'title', 120), event_date = v_start, end_date = v_end,
      time_text = public._txt(p, 'time_text', 80), location = public._txt(p, 'location', 160), summary = public._txt(p, 'summary', 400),
      details = public._txt(p, 'details', 4000), link_url = public._txt(p, 'link_url', 500), link_label = public._txt(p, 'link_label', 40),
      published = coalesce((p ->> 'published')::boolean, false), updated_at = now()
    where id = (p ->> 'id')::uuid returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND|Event not found.'; end if;
    perform public._log('event.update', v_id::text);
  end if;
  return v_id;
end $$;

create function public.admin_delete_event(p_id uuid) returns text[] language plpgsql security definer set search_path = public as $$
declare v_paths text[];
begin
  perform public._require_admin();
  select coalesce(array_agg(path), '{}') into v_paths from public.photos where event_id = p_id;
  update public.events set cover_photo_id = null where id = p_id;
  delete from public.events where id = p_id;
  if not found then raise exception 'NOT_FOUND|Event not found.'; end if;
  perform public._log('event.delete', p_id::text);
  return v_paths;
end $$;

-- ---- photos (cars and events). p_kind is 'car' or 'event'.
create function public.admin_add_photos(p_kind text, p_owner uuid, p_paths text[]) returns jsonb
language plpgsql security definer set search_path = public, storage as $$
declare v text; v_sort int; v_first uuid; v_new uuid;
begin
  perform public._require_admin();
  if p_kind = 'car' then
    if not exists (select 1 from public.cars where id = p_owner) then raise exception 'NOT_FOUND|Car not found.'; end if;
  elsif p_kind = 'event' then
    if not exists (select 1 from public.events where id = p_owner) then raise exception 'NOT_FOUND|Event not found.'; end if;
  else raise exception 'INVALID|Unknown photo type.'; end if;
  if coalesce(array_length(p_paths, 1), 0) = 0 then return public._photos(p_kind, p_owner); end if;
  if array_length(p_paths, 1) > 50 then raise exception 'INVALID|Up to 50 photos at a time.'; end if;
  if (select count(*) from public.photos where car_id = p_owner or event_id = p_owner) + array_length(p_paths, 1) > 300 then
    raise exception 'INVALID|Up to 300 photos each.'; end if;
  select coalesce(max(sort), 0) into v_sort from public.photos where car_id = p_owner or event_id = p_owner;
  foreach v in array p_paths loop
    if v !~ ('^' || p_owner::text || '/[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$') then raise exception 'INVALID|Photo path not allowed.'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = v) then
      raise exception 'INVALID|A photo didn’t finish uploading. Please try again.'; end if;
    if exists (select 1 from public.photos where path = v) then continue; end if;
    v_sort := v_sort + 1;
    if p_kind = 'car' then insert into public.photos (car_id, path, sort) values (p_owner, v, v_sort) returning id into v_new;
    else insert into public.photos (event_id, path, sort) values (p_owner, v, v_sort) returning id into v_new; end if;
    v_first := coalesce(v_first, v_new);
  end loop;
  if v_first is not null then
    if p_kind = 'car' then update public.cars set cover_photo_id = v_first, updated_at = now() where id = p_owner and cover_photo_id is null;
    else update public.events set cover_photo_id = v_first, updated_at = now() where id = p_owner and cover_photo_id is null; end if;
  end if;
  perform public._log('photos.add', p_kind || ':' || p_owner::text);
  return public._photos(p_kind, p_owner);
end $$;

create function public.admin_update_photo(p_id uuid, p_caption text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  update public.photos set caption = left(trim(coalesce(p_caption, '')), 200) where id = p_id;
  if not found then raise exception 'NOT_FOUND|Photo not found.'; end if;
end $$;

create function public.admin_move_photo(p_id uuid, p_dir int) returns void language plpgsql security definer set search_path = public as $$
declare me public.photos; other public.photos;
begin
  perform public._require_admin();
  select * into me from public.photos where id = p_id;
  if me.id is null then raise exception 'NOT_FOUND|Photo not found.'; end if;
  update public.photos ph set sort = x.rn from (
    select id, row_number() over (order by sort, created_at) as rn from public.photos
    where car_id is not distinct from me.car_id and event_id is not distinct from me.event_id) x
  where ph.id = x.id;
  select * into me from public.photos where id = p_id;
  select * into other from public.photos where car_id is not distinct from me.car_id and event_id is not distinct from me.event_id and sort = me.sort + sign(p_dir)::int;
  if other.id is null then return; end if;
  update public.photos set sort = other.sort where id = me.id;
  update public.photos set sort = me.sort where id = other.id;
end $$;

create function public.admin_set_cover(p_photo uuid) returns void language plpgsql security definer set search_path = public as $$
declare ph public.photos;
begin
  perform public._require_admin();
  select * into ph from public.photos where id = p_photo;
  if ph.id is null then raise exception 'NOT_FOUND|Photo not found.'; end if;
  if ph.car_id is not null then update public.cars set cover_photo_id = ph.id, updated_at = now() where id = ph.car_id;
  else update public.events set cover_photo_id = ph.id, updated_at = now() where id = ph.event_id; end if;
end $$;

create function public.admin_delete_photo(p_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare ph public.photos;
begin
  perform public._require_admin();
  delete from public.photos where id = p_id returning * into ph;
  if ph.id is null then raise exception 'NOT_FOUND|Photo not found.'; end if;
  if ph.car_id is not null then
    update public.cars set cover_photo_id = (select id from public.photos where car_id = ph.car_id order by sort, created_at limit 1)
     where id = ph.car_id and cover_photo_id is null;
  else
    update public.events set cover_photo_id = (select id from public.photos where event_id = ph.event_id order by sort, created_at limit 1)
     where id = ph.event_id and cover_photo_id is null;
  end if;
  perform public._log('photo.delete', ph.path);
  return ph.path;
end $$;

-- ---- forms
create function public.admin_get_request(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public._require_admin();
  select to_jsonb(q) into r from public.requests q where q.id = p_id;
  if r is null then raise exception 'NOT_FOUND|Form not found.'; end if;
  return r;
end $$;

create function public.admin_update_request(p_id uuid, p_status text, p_notes text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  if p_status not in ('new', 'contacted', 'closed') then raise exception 'INVALID|Unknown status.'; end if;
  update public.requests set status = p_status, notes = left(coalesce(p_notes, ''), 4000), updated_at = now() where id = p_id;
  if not found then raise exception 'NOT_FOUND|Form not found.'; end if;
  perform public._log('request.update', p_id::text);
end $$;

create function public.admin_delete_request(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  delete from public.requests where id = p_id;
  if not found then raise exception 'NOT_FOUND|Form not found.'; end if;
  perform public._log('request.delete', p_id::text);
end $$;

create function public.admin_export_requests() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('ref', ref, 'type', kind, 'received', created_at, 'status', status, 'name', name,
    'organization', organization, 'email', email, 'phone', phone, 'interests', array_to_string(interests, '; '),
    'availability', array_to_string(availability, '; '), 'age_18_plus', adult, 'message', message, 'notes', notes) order by created_at desc)
    from public.requests), '[]');
end $$;

-- ---- neighborhood stories
create function public.admin_get_story(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public._require_admin();
  select to_jsonb(s) into r from public.stories s where s.id = p_id;
  if r is null then raise exception 'NOT_FOUND|Story not found.'; end if;
  return r;
end $$;

create function public.admin_update_story(p_id uuid, p_status text, p_notes text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  if p_status not in ('pending', 'approved', 'hidden') then raise exception 'INVALID|Unknown status.'; end if;
  update public.stories set status = p_status, notes = left(coalesce(p_notes, ''), 4000), updated_at = now() where id = p_id;
  if not found then raise exception 'NOT_FOUND|Story not found.'; end if;
  perform public._log('story.' || p_status, p_id::text);
end $$;

create function public.admin_delete_story(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  delete from public.stories where id = p_id;
  if not found then raise exception 'NOT_FOUND|Story not found.'; end if;
  perform public._log('story.delete', p_id::text);
end $$;

-- ---- members (Home > The Club)
create function public.admin_save_member(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public._require_admin();
  if public._txt(p, 'name', 80) = '' then raise exception 'INVALID|Please enter the member’s name.'; end if;
  if nullif(p ->> 'id', '') is null then
    insert into public.members (name, role, ride, bio, sort, published)
    values (public._txt(p, 'name', 80), public._txt(p, 'role', 60), public._txt(p, 'ride', 80), public._txt(p, 'bio', 600),
      coalesce((select max(sort) + 1 from public.members), 1), coalesce((p ->> 'published')::boolean, false))
    returning id into v_id;
    perform public._log('member.create', v_id::text);
  else
    update public.members set name = public._txt(p, 'name', 80), role = public._txt(p, 'role', 60), ride = public._txt(p, 'ride', 80),
      bio = public._txt(p, 'bio', 600), published = coalesce((p ->> 'published')::boolean, false), updated_at = now()
    where id = (p ->> 'id')::uuid returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND|Member not found.'; end if;
    perform public._log('member.update', v_id::text);
  end if;
  return v_id;
end $$;

-- Sets the member's photo (already uploaded to <member id>/...). Returns the old photo path so the page can delete that file.
create function public.admin_set_member_photo(p_id uuid, p_path text) returns text language plpgsql security definer set search_path = public, storage as $$
declare v_old text;
begin
  perform public._require_admin();
  select photo_path into v_old from public.members where id = p_id;
  if not found then raise exception 'NOT_FOUND|Member not found.'; end if;
  if p_path is not null then
    if p_path !~ ('^' || p_id::text || '/[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$') then raise exception 'INVALID|Photo path not allowed.'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = p_path) then
      raise exception 'INVALID|The photo didn’t finish uploading. Please try again.'; end if;
  end if;
  update public.members set photo_path = p_path, updated_at = now() where id = p_id;
  return case when v_old is distinct from p_path then v_old end;
end $$;

create function public.admin_move_member(p_id uuid, p_dir int) returns void language plpgsql security definer set search_path = public as $$
declare me public.members; other public.members;
begin
  perform public._require_admin();
  update public.members m set sort = x.rn from (select id, row_number() over (order by sort, created_at) as rn from public.members) x where m.id = x.id;
  select * into me from public.members where id = p_id;
  if me.id is null then raise exception 'NOT_FOUND|Member not found.'; end if;
  select * into other from public.members where sort = me.sort + sign(p_dir)::int;
  if other.id is null then return; end if;
  update public.members set sort = other.sort where id = me.id;
  update public.members set sort = me.sort where id = other.id;
end $$;

create function public.admin_delete_member(p_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare v_path text;
begin
  perform public._require_admin();
  delete from public.members where id = p_id returning photo_path into v_path;
  if not found then raise exception 'NOT_FOUND|Member not found.'; end if;
  perform public._log('member.delete', p_id::text);
  return v_path;
end $$;

-- ---- team (owner only). New staff first get a login in Supabase > Authentication > Users > Add user.
create function public.admin_team() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'email', u.email, 'role', a.role, 'me', a.user_id = auth.uid())
    order by a.role, u.email) from public.admins a join auth.users u on u.id = a.user_id), '[]');
end $$;

create function public.admin_add_member(p_email text, p_role text) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  perform public._require_owner();
  if p_role not in ('owner', 'staff') then raise exception 'INVALID|Unknown role.'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'NOT_FOUND|No login with that email yet. Create it first in Supabase > Authentication > Users > Add user.'; end if;
  insert into public.admins (user_id, role) values (v_uid, p_role) on conflict (user_id) do update set role = excluded.role;
  perform public._log('team.add', lower(trim(p_email)) || ':' || p_role);
end $$;

create function public.admin_remove_member(p_user uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_owner();
  if p_user = auth.uid() then raise exception 'INVALID|You can’t remove yourself.'; end if;
  delete from public.admins where user_id = p_user;
  if not found then raise exception 'NOT_FOUND|Not on the team.'; end if;
  perform public._log('team.remove', p_user::text);
end $$;

-- ------------------------------------------------------------------ who can call what
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.list_showroom(), public.list_events(), public.list_stories(), public.list_members(), public.submit_request(jsonb),
  public.submit_story(jsonb), public.is_admin() to anon, authenticated;
grant execute on function public.admin_me(), public.admin_overview(),
  public.admin_get_car(uuid), public.admin_save_car(jsonb), public.admin_move_car(uuid, int), public.admin_delete_car(uuid),
  public.admin_get_event(uuid), public.admin_save_event(jsonb), public.admin_delete_event(uuid),
  public.admin_add_photos(text, uuid, text[]), public.admin_update_photo(uuid, text), public.admin_move_photo(uuid, int),
  public.admin_set_cover(uuid), public.admin_delete_photo(uuid),
  public.admin_get_request(uuid), public.admin_update_request(uuid, text, text), public.admin_delete_request(uuid), public.admin_export_requests(),
  public.admin_get_story(uuid), public.admin_update_story(uuid, text, text), public.admin_delete_story(uuid),
  public.admin_save_member(jsonb), public.admin_set_member_photo(uuid, text), public.admin_move_member(uuid, int), public.admin_delete_member(uuid),
  public.admin_team(), public.admin_add_member(text, text), public.admin_remove_member(uuid) to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
