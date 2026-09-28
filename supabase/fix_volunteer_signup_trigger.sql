-- ====================================================================
-- PVMS Fix: Volunteer Registration Trigger Update
-- ====================================================================
-- Run this in your Supabase SQL Editor:
-- Project -> SQL Editor -> New Query -> Paste -> Run
--
-- Why: The previous trigger aborted signups if the email wasn't
-- pre-entered on the roster, causing "Database error saving new user".
-- This update automatically creates a volunteer profile for new
-- signups or links to their existing roster entry without crashing.
-- ====================================================================

create or replace function public.link_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_student_id text;
  v_full_name  text;
  v_dept       text;
  v_batch      text;
  v_phone      text;
  v_is_admin   boolean := false;
begin
  -- Extract user metadata supplied during registration
  v_student_id := coalesce(trim(new.raw_user_meta_data->>'student_id'), '');
  v_full_name  := coalesce(trim(new.raw_user_meta_data->>'full_name'), split_part(new.email, '@', 1));
  v_dept       := coalesce(trim(new.raw_user_meta_data->>'department'), 'Other');
  v_batch      := coalesce(trim(new.raw_user_meta_data->>'batch'), '');
  v_phone      := trim(new.raw_user_meta_data->>'phone');

  -- Check if this student ID is configured as the Master Admin
  if v_student_id <> '' then
    select exists (
      select 1 from public.app_config
      where key = 'master_admin_student_id' and value = v_student_id
    ) into v_is_admin;
  end if;

  -- 1. Try to link by student_id if provided
  if v_student_id <> '' then
    update public.volunteers
    set auth_user_id = new.id,
        email = coalesce(volunteers.email, new.email),
        full_name = case when volunteers.full_name is null or volunteers.full_name = '' then v_full_name else volunteers.full_name end,
        department = case when volunteers.department is null or volunteers.department = '' then v_dept else volunteers.department end,
        batch = case when volunteers.batch is null or volunteers.batch = '' then v_batch else volunteers.batch end,
        phone = coalesce(volunteers.phone, v_phone),
        role_level = case when v_is_admin then 6 else volunteers.role_level end
    where student_id = v_student_id;

    if found then
      return new;
    end if;
  end if;

  -- 2. Try to link by email if student_id wasn't matched
  if new.email is not null and new.email <> '' then
    update public.volunteers
    set auth_user_id = new.id,
        student_id = case when volunteers.student_id is null or volunteers.student_id = '' then v_student_id else volunteers.student_id end,
        full_name = case when volunteers.full_name is null or volunteers.full_name = '' then v_full_name else volunteers.full_name end,
        department = case when volunteers.department is null or volunteers.department = '' then v_dept else volunteers.department end,
        batch = case when volunteers.batch is null or volunteers.batch = '' then v_batch else volunteers.batch end,
        phone = coalesce(volunteers.phone, v_phone),
        role_level = case when v_is_admin then 6 else volunteers.role_level end
    where lower(email) = lower(new.email);

    if found then
      return new;
    end if;
  end if;

  -- 3. If volunteer row does not exist yet, create a new volunteer profile
  insert into public.volunteers (
    auth_user_id,
    student_id,
    full_name,
    email,
    department,
    batch,
    phone,
    role_level,
    target_classes,
    designated_days
  ) values (
    new.id,
    case when v_student_id <> '' then v_student_id else ('CUET_' || substr(new.id::text, 1, 8)) end,
    v_full_name,
    new.email,
    v_dept,
    v_batch,
    v_phone,
    case when v_is_admin then 6 else 1 end,
    20,
    '{}'
  );

  return new;
exception
  when others then
    -- Never crash auth.users insert if volunteer profile creation raises a constraint warning
    raise warning 'link_new_auth_user warning: %', SQLERRM;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_new_auth_user();
