create table if not exists future_runs (
  id text primary key default ('run_' || replace(gen_random_uuid()::text, '-', '')),
  status text not null check (status in ('generating', 'completed', 'failed')),
  profile_json jsonb not null,
  choice_context_json jsonb not null,
  input_json jsonb not null,
  output_json jsonb,
  model text not null,
  prompt_version text not null,
  error text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists future_paths (
  id text primary key default ('path_' || replace(gen_random_uuid()::text, '-', '')),
  run_id text not null references future_runs(id) on delete cascade,
  path_index integer not null,
  label text not null,
  summary text,
  scores_json jsonb not null,
  timeline_json jsonb not null,
  risks_json jsonb not null,
  advice text not null,
  raw_output_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (run_id, path_index)
);

create table if not exists llm_events (
  id text primary key default ('evt_' || replace(gen_random_uuid()::text, '-', '')),
  run_id text references future_runs(id) on delete cascade,
  event_type text not null,
  model text,
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists future_runs_created_at_idx on future_runs(created_at desc);
create index if not exists future_paths_run_id_idx on future_paths(run_id);
create index if not exists llm_events_run_id_idx on llm_events(run_id);
