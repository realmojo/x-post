-- Apply only to the pflow-kr project. Insert just url in the Table Editor.
create table public.x_post_queue (
  id uuid primary key default gen_random_uuid(),
  url text not null check (length(url) <= 4000),
  source text not null default '',
  source_key text not null default '' unique,
  status text not null default 'pending' check (status in ('pending','processing','posting','posted','failed','unknown')),
  title text,
  post_text text,
  image_count integer check (image_count between 1 and 4),
  x_post_url text,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  next_attempt_at timestamptz not null default now(),
  claim_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  posted_at timestamptz
);
comment on table public.x_post_queue is 'URL만 등록하면 로컬 Chrome 작업자가 5분마다 X에 게시합니다. unknown은 X 게시 여부를 확인한 뒤 수동 처리하세요.';
comment on column public.x_post_queue.url is '블라인드 또는 오늘의유머 공개 게시물 URL. 유일한 필수 입력값.';
comment on column public.x_post_queue.status is 'pending 대기 / processing 이미지 준비 / posting X 게시 중 / posted 완료 / failed 실패 / unknown 게시 여부 확인 필요';

create function public.x_post_queue_normalize() returns trigger
language plpgsql set search_path = '' as $$
declare cleaned text; slug text; board text; post_no text;
begin
  if TG_OP = 'UPDATE' and new.url is distinct from old.url and old.status <> 'pending' then
    raise exception '이미 처리한 행의 URL은 변경할 수 없습니다. 새 행을 추가하세요.';
  end if;
  cleaned := btrim(new.url);
  if cleaned ~ '^https://(www\.)?teamblind\.com/kr/post/[^/?#]+/?([?#].*)?$' then
    slug := substring(cleaned from '/kr/post/([^/?#]+)');
    new.source := 'blind';
    new.source_key := 'blind-' || substring(slug from '([^-]+)$');
    new.url := 'https://www.teamblind.com/kr/post/' || slug;
  elsif cleaned ~ '^https://(www\.)?todayhumor\.co\.kr/board/view\.php\?' then
    board := substring(cleaned from '[?&]table=([a-zA-Z0-9_]+)(&|#|$)');
    post_no := substring(cleaned from '[?&]no=([0-9]+)(&|#|$)');
    if board is null or post_no is null then raise exception '오늘의유머 table/no가 올바르지 않습니다.'; end if;
    new.source := 'todayhumor';
    new.source_key := 'todayhumor-' || board || '-' || post_no;
    new.url := 'https://www.todayhumor.co.kr/board/view.php?table=' || board || '&no=' || post_no;
  else
    raise exception '블라인드 또는 오늘의유머의 https 게시물 URL을 입력하세요.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger x_post_queue_normalize before insert or update on public.x_post_queue
for each row execute function public.x_post_queue_normalize();
create index x_post_queue_pending on public.x_post_queue(next_attempt_at,created_at) where status = 'pending';
alter table public.x_post_queue enable row level security;
revoke all on public.x_post_queue from anon, authenticated;
grant select, insert, update, delete on public.x_post_queue to service_role;

-- Row lock + claim token stop concurrent workers from submitting the same URL.
create function public.claim_x_post() returns setof public.x_post_queue
language plpgsql security definer set search_path = '' as $$
begin
  update public.x_post_queue set status = 'unknown', last_error = '게시 중 작업 연결이 끊겼습니다. X에서 게시 여부를 확인하세요.', claim_token = null, lease_until = null
    where status = 'posting' and lease_until < now();
  update public.x_post_queue set status = case when attempts < 3 then 'pending' else 'failed' end,
    last_error = '이미지 준비 중 작업이 중단되었습니다.', claim_token = null, lease_until = null
    where status = 'processing' and lease_until < now();
  return query
    update public.x_post_queue q set status = 'processing', attempts = attempts + 1,
      claim_token = gen_random_uuid(), lease_until = now() + interval '15 minutes', last_error = null
    where q.id = (select candidate.id from public.x_post_queue candidate
      where candidate.status = 'pending' and candidate.next_attempt_at <= now()
      order by candidate.created_at for update skip locked limit 1)
    returning q.*;
end;
$$;

create function public.mark_x_post_posting(p_id uuid, p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.x_post_queue set status = 'posting', lease_until = now() + interval '15 minutes'
    where id = p_id and claim_token = p_token and status = 'processing' and lease_until > now();
  return found;
end;
$$;

revoke all on function public.x_post_queue_normalize() from public, anon, authenticated;
revoke all on function public.claim_x_post() from public, anon, authenticated;
revoke all on function public.mark_x_post_posting(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_x_post(), public.mark_x_post_posting(uuid,uuid) to service_role;
