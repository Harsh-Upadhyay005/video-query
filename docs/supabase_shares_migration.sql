-- ============================================================
-- Migration: shares table + increment_share_views RPC
-- Run AFTER supabase_analyses_migration.sql (FK dependency).
--
-- How to run:
--   Supabase Dashboard → SQL Editor → New Query → paste → Run
-- ============================================================

-- 1. Create the shares table
create table if not exists shares (
  id               uuid        primary key default gen_random_uuid(),
  slug             text        unique not null,
  analysis_id      uuid        references analyses(id) on delete cascade,
  job_id           text,
  created_by       text        not null default 'guest',
  title            text        not null,
  summary          text,
  action_items     jsonb,
  key_decisions    text,
  open_questions   text,
  transcript       text,
  segments         jsonb,                        -- [{text, start, end}]
  transcript_source text,                        -- 'captions' | 'whisper' | 'sarvam'
  source_type      text        default 'video',
  video_id         text,
  views_count      integer     default 0,
  is_public        boolean     default true,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- 2. Indexes
create index if not exists idx_shares_slug        on shares(slug);
create index if not exists idx_shares_created_by  on shares(created_by);
create index if not exists idx_shares_analysis_id on shares(analysis_id);
create index if not exists idx_shares_is_public   on shares(is_public) where is_public = true;

-- 3. Row Level Security
alter table shares enable row level security;

-- Anyone can read public shares (used by SharedAnalysisPage)
create policy if not exists "Anyone can view public shares"
  on shares for select using (is_public = true);

-- Authenticated users and guests can insert their own shares
create policy if not exists "Users can insert own shares"
  on shares for insert
  with check (auth.uid()::text = created_by or created_by = 'guest');

create policy if not exists "Users can update own shares"
  on shares for update using (auth.uid()::text = created_by);

create policy if not exists "Users can delete own shares"
  on shares for delete using (auth.uid()::text = created_by);

-- 4. updated_at trigger
create or replace function update_shares_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_shares_updated_at on shares;
create trigger trigger_shares_updated_at
  before update on shares
  for each row execute function update_shares_updated_at();

-- 5. RPC: increment_share_views
-- Called by ShareService._increment_supabase_views(slug).
-- Using a stored procedure avoids a round-trip read + write.
create or replace function increment_share_views(share_slug text)
returns void language plpgsql security definer as $$
begin
  update shares
  set    views_count = coalesce(views_count, 0) + 1
  where  slug = share_slug;
end;
$$;

-- Grant execute to anon and authenticated roles so the client can call it
grant execute on function increment_share_views(text) to anon, authenticated;
