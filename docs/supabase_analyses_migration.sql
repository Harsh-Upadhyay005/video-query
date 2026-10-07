-- ============================================================
-- Migration: analyses table
-- Run FIRST (shares table has a FK to this one).
--
-- How to run:
--   Supabase Dashboard → SQL Editor → New Query → paste → Run
-- ============================================================

-- 1. Create the analyses table
create table if not exists analyses (
  id                uuid        primary key default gen_random_uuid(),
  user_id           text        not null default 'guest',
  source_type       text        not null check (source_type in ('youtube','audio','video','pdf','meeting')),
  source_ref        text,                         -- URL or file path
  video_id          text,                         -- YouTube video ID (for global cache lookups)
  title             text,
  transcript        jsonb,                        -- [{text, start, end}] timestamped segments
  transcript_source text,                         -- 'captions' | 'whisper' | 'sarvam' | null
  summary           text,
  action_items      jsonb,                        -- structured action items list
  key_decisions     text,
  open_questions    text,
  status            text        not null default 'processing'
                                check (status in ('processing','completed','failed')),
  error_message     text,
  language          text        default 'english',
  duration_seconds  float,
  job_id            text        unique,           -- links to in-process progress_store job
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- 2. Indexes
create index if not exists idx_analyses_user_id    on analyses(user_id);
create index if not exists idx_analyses_video_id   on analyses(video_id)  where video_id is not null;
create index if not exists idx_analyses_job_id     on analyses(job_id)    where job_id   is not null;
create index if not exists idx_analyses_status     on analyses(status);
create index if not exists idx_analyses_created_at on analyses(created_at desc);

-- 3. Full-text search on title + summary
alter table analyses
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title,   '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B')
  ) stored;

create index if not exists idx_analyses_search on analyses using gin(search_vector);

-- 4. Row Level Security
alter table analyses enable row level security;

create policy if not exists "Users can read own analyses"
  on analyses for select using (auth.uid()::text = user_id);

create policy if not exists "Users can insert own analyses"
  on analyses for insert with check (auth.uid()::text = user_id);

create policy if not exists "Users can update own analyses"
  on analyses for update using (auth.uid()::text = user_id);

create policy if not exists "Users can delete own analyses"
  on analyses for delete using (auth.uid()::text = user_id);

-- Guests can access rows where user_id = 'guest'
create policy if not exists "Guests can read guest analyses"
  on analyses for select using (user_id = 'guest');

create policy if not exists "Guests can insert guest analyses"
  on analyses for insert with check (user_id = 'guest');

-- 5. updated_at trigger
create or replace function update_analyses_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_analyses_updated_at on analyses;
create trigger trigger_analyses_updated_at
  before update on analyses
  for each row execute function update_analyses_updated_at();
