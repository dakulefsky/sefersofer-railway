-- SeferSofer: Supabase Initial Schema
-- This migration creates all tables, RLS policies, indexes, and triggers for the OCR platform.

-- ─── Enable Extensions ───────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ─── Profiles (extends auth.users) ───────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'user' check (role in ('user', 'admin', 'gm', 'employee')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  last_signed_in timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, new.user_metadata->>'name', 'user');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Jobs ───────────────────────────────────────────────────────────────────

create table if not exists public.jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  archived boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.jobs enable row level security;

create policy "Users can view own jobs"
  on public.jobs for select
  using (auth.uid() = user_id);

create policy "Users can create jobs"
  on public.jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own jobs"
  on public.jobs for update
  using (auth.uid() = user_id);

create policy "Users can delete own jobs"
  on public.jobs for delete
  using (auth.uid() = user_id);

create index idx_jobs_user_id on public.jobs(user_id);
create index idx_jobs_archived on public.jobs(archived);

-- ─── Pages ──────────────────────────────────────────────────────────────────

create table if not exists public.pages (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  page_order integer not null,
  storage_path text not null,
  page_label text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.pages enable row level security;

create policy "Users can view own pages"
  on public.pages for select
  using (
    job_id in (
      select id from public.jobs where user_id = auth.uid()
    )
  );

create policy "Users can create pages"
  on public.pages for insert
  with check (
    job_id in (
      select id from public.jobs where user_id = auth.uid()
    )
  );

create index idx_pages_job_id on public.pages(job_id);

-- ─── Text Regions ───────────────────────────────────────────────────────────

create table if not exists public.text_regions (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid not null references public.pages(id) on delete cascade,
  region_type text not null check (region_type in ('main', 'margin_right', 'margin_left', 'margin_top', 'margin_bottom', 'interlinear')),
  anchor_word_index integer,
  bbox_x integer,
  bbox_y integer,
  bbox_w integer,
  bbox_h integer,
  created_at timestamp with time zone default now()
);

alter table public.text_regions enable row level security;

create policy "Users can view own regions"
  on public.text_regions for select
  using (
    page_id in (
      select id from public.pages where job_id in (
        select id from public.jobs where user_id = auth.uid()
      )
    )
  );

create policy "Users can create regions"
  on public.text_regions for insert
  with check (
    page_id in (
      select id from public.pages where job_id in (
        select id from public.jobs where user_id = auth.uid()
      )
    )
  );

create index idx_text_regions_page_id on public.text_regions(page_id);

-- ─── Words ──────────────────────────────────────────────────────────────────

create table if not exists public.words (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid not null references public.pages(id) on delete cascade,
  region_id uuid references public.text_regions(id) on delete set null,
  word_index integer not null,
  text text not null,
  confidence numeric(3, 2),
  is_flagged boolean default false,
  is_scribble boolean default false,
  is_insertion boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.words enable row level security;

create policy "Users can view own words"
  on public.words for select
  using (
    page_id in (
      select id from public.pages where job_id in (
        select id from public.jobs where user_id = auth.uid()
      )
    )
  );

create policy "Users can update own words"
  on public.words for update
  using (
    page_id in (
      select id from public.pages where job_id in (
        select id from public.jobs where user_id = auth.uid()
      )
    )
  );

create policy "Users can create words"
  on public.words for insert
  with check (
    page_id in (
      select id from public.pages where job_id in (
        select id from public.jobs where user_id = auth.uid()
      )
    )
  );

create index idx_words_page_id on public.words(page_id);
create index idx_words_region_id on public.words(region_id);

-- ─── Word Corrections ───────────────────────────────────────────────────────

create table if not exists public.word_corrections (
  id uuid primary key default uuid_generate_v4(),
  word_id uuid not null references public.words(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  original_text text not null,
  corrected_text text not null,
  is_user_marked_scribble boolean default false,
  created_at timestamp with time zone default now()
);

alter table public.word_corrections enable row level security;

create policy "Users can view own corrections"
  on public.word_corrections for select
  using (auth.uid() = user_id);

create policy "Users can create corrections"
  on public.word_corrections for insert
  with check (auth.uid() = user_id);

create index idx_word_corrections_word_id on public.word_corrections(word_id);
create index idx_word_corrections_user_id on public.word_corrections(user_id);

-- ─── Letter Confusion Pairs (Learning) ──────────────────────────────────────

create table if not exists public.letter_confusion_pairs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  original_letter text not null,
  corrected_letter text not null,
  count integer default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.letter_confusion_pairs enable row level security;

create policy "Users can view own confusions"
  on public.letter_confusion_pairs for select
  using (auth.uid() = user_id);

create policy "Users can create confusions"
  on public.letter_confusion_pairs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own confusions"
  on public.letter_confusion_pairs for update
  using (auth.uid() = user_id);

create index idx_letter_confusion_user_job on public.letter_confusion_pairs(user_id, job_id);

-- ─── Letter Morphology Variants (Learning) ──────────────────────────────────

create table if not exists public.letter_morphology_variants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  letter text not null,
  morphology text not null,
  context text,
  count integer default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.letter_morphology_variants enable row level security;

create policy "Users can view own morphologies"
  on public.letter_morphology_variants for select
  using (auth.uid() = user_id);

create policy "Users can create morphologies"
  on public.letter_morphology_variants for insert
  with check (auth.uid() = user_id);

create policy "Users can update own morphologies"
  on public.letter_morphology_variants for update
  using (auth.uid() = user_id);

create index idx_morphology_user_job on public.letter_morphology_variants(user_id, job_id);

-- ─── OCR Accuracy Metrics ───────────────────────────────────────────────────

create table if not exists public.ocr_accuracy_metrics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  total_words integer not null,
  correct_words integer not null,
  accuracy integer not null,
  created_at timestamp with time zone default now()
);

alter table public.ocr_accuracy_metrics enable row level security;

create policy "Users can view own metrics"
  on public.ocr_accuracy_metrics for select
  using (auth.uid() = user_id);

create policy "Users can create metrics"
  on public.ocr_accuracy_metrics for insert
  with check (auth.uid() = user_id);

create index idx_ocr_accuracy_user_id on public.ocr_accuracy_metrics(user_id);
create index idx_ocr_accuracy_created_at on public.ocr_accuracy_metrics(created_at);

-- ─── RPC Functions ──────────────────────────────────────────────────────────

-- Upsert letter confusion with atomic count increment
create or replace function public.upsert_letter_confusion(
  p_user_id uuid,
  p_job_id uuid,
  p_original text,
  p_corrected text
)
returns void as $$
begin
  insert into public.letter_confusion_pairs (user_id, job_id, original_letter, corrected_letter, count)
  values (p_user_id, p_job_id, p_original, p_corrected, 1)
  on conflict (user_id, job_id, original_letter, corrected_letter)
  do update set
    count = letter_confusion_pairs.count + 1,
    updated_at = now();
end;
$$ language plpgsql security definer;

-- Grant execute on RPC to authenticated users
grant execute on function public.upsert_letter_confusion(uuid, uuid, text, text) to authenticated;
