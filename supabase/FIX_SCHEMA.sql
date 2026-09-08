-- ==========================================================
-- life-vocab-app · 表结构修正脚本 (阶段 5)
-- ==========================================================
-- 用途: 若之前用简化版 SQL 建过表(字段与应用代码不一致),执行本脚本可
--       先删除旧表,再按正确结构重建。表当前为空,删除无数据损失。
-- 创建方式: Supabase Dashboard → SQL Editor → 粘贴全部 → Run
-- ==========================================================

-- 0) 删除旧表(若存在)
drop table if exists public.cards_progress cascade;
drop table if exists public.user_settings   cascade;
drop table if exists public.rec_scores      cascade;

-- 1. 卡片学习进度 (SRS + 错题标记)
create table if not exists cards_progress (
  user_id        uuid references auth.users not null,
  card_id        int not null,
  mode           text not null,             -- match/listen/memory/gravity/record/browse/self-rate
  reps           int  default 0,           -- 连续 known 次数
  correct        int  default 0,           -- 累计答对次数
  ease           real default 2.5,         -- SM-2 ease factor
  last_review    timestamptz,
  next_due       timestamptz,
  shadow_pool    boolean default false,    -- 是否在错题池
  rec_score      real,                     -- 最近一次录音评分(0-100)
  rec_attempts   int default 0,            -- 录音尝试次数
  updated_at     timestamptz default now(),
  primary key (user_id, card_id, mode)
);
create index if not exists idx_cards_progress_user_due
  on cards_progress (user_id, next_due);

-- 2. 用户设置 (XP、连续天数、shadow pool 详情、UI 偏好)
create table if not exists user_settings (
  user_id          uuid references auth.users primary key,
  xp               int default 0,
  streak           int default 0,
  last_active_date date,
  shadow_pool_meta jsonb default '{}'::jsonb,   -- [{card_id,added_at,count,mode},...]
  settings         jsonb default '{}'::jsonb,   -- {voice:'en-GB',rate:1.0,...}
  updated_at       timestamptz default now()
);

-- 3. 录音评分历史(详细,用于趋势分析)
create table if not exists rec_scores (
  id          bigserial primary key,
  user_id     uuid references auth.users not null,
  card_id     int not null,
  mode        text not null,                -- 'word' | 'example'
  score       real not null,                -- 0-100
  transcript  text,                         -- 浏览器转写全文
  raw         jsonb,                        -- 原始命中矩阵(供调试)
  created_at  timestamptz default now()
);
create index if not exists idx_rec_scores_user_card
  on rec_scores (user_id, card_id, created_at desc);

-- ------------------------------------------------------------
-- Row Level Security: 每个用户只能读写自己的数据
-- ------------------------------------------------------------
alter table cards_progress enable row level security;
alter table user_settings   enable row level security;
alter table rec_scores     enable row level security;

-- 幂等创建策略
drop policy if exists "own rows cards_progress" on cards_progress;
drop policy if exists "own rows user_settings"  on user_settings;
drop policy if exists "own rows rec_scores"     on rec_scores;

create policy "own rows cards_progress"
  on cards_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows user_settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows rec_scores"
  on rec_scores for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 触发器: 自动维护 updated_at
-- ------------------------------------------------------------
create or replace function trigger_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cards_progress_updated on cards_progress;
drop trigger if exists trg_user_settings_updated  on user_settings;

create trigger trg_cards_progress_updated
  before update on cards_progress
  for each row execute procedure trigger_set_updated_at();

create trigger trg_user_settings_updated
  before update on user_settings
  for each row execute procedure trigger_set_updated_at();

-- 完成。验证: select tablename from pg_tables where schemaname='public';
