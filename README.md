# x-post

블라인드·오늘의유머 게시물 URL 을 입력하면 Supabase `public.x_post_queue` 에 저장하는 작은 웹 폼이다.
X 에 실제로 올리는 일은 이 저장소가 하지 않는다. 로컬 Mac 의 게시 작업자(clipseo `x/blind-to-x/queue-runner.mjs`)가
5분마다 대기열을 읽어 처리한다.

## 구성

| 경로 | 역할 |
| --- | --- |
| `app/page.tsx` | URL 입력 폼 + 최근 등록 30건과 상태 |
| `app/api/queue/route.ts` | `GET` 목록 조회, `POST` URL 저장. 접근 암호(`x-access-token` 헤더)가 맞아야 동작 |
| `supabase/queue.sql` | 테이블·정규화 트리거·작업자용 함수. 처음 한 번 적용 |

URL 검사와 정규화는 DB 트리거가 한다. 블라인드 `/kr/post/…`, 오늘의유머 `view.php?table=…&no=…` 만 받고,
추적 파라미터나 제목이 달라도 같은 게시물이면 `source_key` 가 같아 두 번 들어가지 않는다(`이미 등록된 게시물입니다`).

## 설정

```bash
cp .env.example .env.local
```

| 변수 | 설명 |
| --- | --- |
| `X_QUEUE_SUPABASE_URL` | `https://프로젝트ID.supabase.co` |
| `X_QUEUE_SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 키. 테이블이 RLS 로 막혀 있어 이 키로만 읽고 쓴다 |
| `X_POST_ACCESS_TOKEN` | 폼에서 입력하는 접근 암호. 이게 없으면 누구나 대기열에 넣을 수 있으니 길게 정한다 |

테이블이 아직 없다면 Supabase SQL Editor 에서 `supabase/queue.sql` 을 실행한다.

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
```

Vercel 에 올릴 때는 위 세 변수를 프로젝트 환경변수로 넣는다. 접근 암호는 브라우저 localStorage 에만 저장된다.

## 상태

| status | 뜻 |
| --- | --- |
| `pending` | 대기 |
| `processing` | 이미지 준비 중 |
| `posting` | X 게시 중 |
| `posted` | 완료 (`x_post_url` 에 링크) |
| `failed` | 3회 실패. 원인을 고친 뒤 `pending` 으로 바꾸면 다시 처리 |
| `unknown` | 게시 여부 불확실. X 에서 확인한 뒤 손으로 정리 |
