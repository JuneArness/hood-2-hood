-- Hood 2 Hood Rydas: make a login the club OWNER (can manage staff in the Admin page).
-- 1) First create the login: Supabase > Authentication > Users > Add user > Create new user
--    (type the email and a strong password, tick "Auto Confirm User").
-- 2) Change the email below if needed, then run this in Supabase > SQL Editor.
insert into public.admins (user_id, role)
select id, 'owner' from auth.users where lower(email) = lower('H2HRydas@gmail.com')
on conflict (user_id) do update set role = 'owner';

-- Shows who has access now:
select u.email, a.role from public.admins a join auth.users u on u.id = a.user_id order by a.role, u.email;
