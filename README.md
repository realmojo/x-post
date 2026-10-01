# x-post

블라인드·오늘의유머 게시물 URL 을 입력하면 Supabase `public.x_post_queue` 에 저장하는 작은 웹 폼이다.
X 에 실제로 올리는 일은 이 저장소가 하지 않는다. 로컬 Mac 의 게시 작업자(clipseo `x/blind-to-x/queue-runner.mjs`)가
5분마다 대기열을 읽어 처리한다.

## 구성

| 경로 | 역할 |
| --- | --- |
| `app/page.tsx` | 서버에서 로그인 확인 후 대기열 화면 표시. 미인증 시 `/login`으로 이동 |
| `app/login/` | 비밀번호 로그인 화면 |
| `app/queue.tsx` | URL 입력 폼 + 최근 등록 30건과 상태, 로그아웃 |
| `app/api/auth/` | 로그인·로그아웃, 7일간 유효한 HttpOnly 세션 쿠키 |
| `app/lib/auth.ts` | 서명된 세션 검증, 비밀번호 비교, 동일 출처 검사 |
| `app/api/queue/route.ts` | `GET` 목록 조회, `POST` URL 저장. 로그인 쿠키 또는 기존 `x-access-token` 헤더 필요 |
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
| `X_POST_ACCESS_TOKEN` | 기존 API 호출용 접근 토큰 및 세션 서명 키. 길고 추측하기 어려운 값으로 정한다 |
| `X_POST_PASSWORD` | 화면 로그인 비밀번호. Cloudflare Secret으로 저장한다 |

메인 화면과 대기열 API는 서버에서 인증을 확인한다. 비밀번호를 브라우저 저장소에 저장하지 않으며,
로그인 쿠키는 HTTPS에서 `Secure`, `HttpOnly`, `SameSite=Strict`로 설정된다.
비밀번호나 API 토큰을 변경하면 기존 로그인도 만료된다. 로그아웃은 브라우저의 쿠키를 지운다.
로그인 요청은 `LOGIN_RATE_LIMITER` 바인딩으로 IP별 1분당 5회로 제한한다(Cloudflare 위치별 적용).
브라우저의 저장·로그아웃 요청은 동일 출처인지 검사하며 기존 API 토큰 호출은 계속 지원한다.

테이블이 아직 없다면 Supabase SQL Editor 에서 `supabase/queue.sql` 을 실행한다.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000 (.env.local 또는 .dev.vars 사용)
npm run preview    # Cloudflare Workers 런타임으로 로컬 실행 (.dev.vars 필요)
```

## Cloudflare Workers 배포

[OpenNext Cloudflare 어댑터](https://opennext.js.org/cloudflare)로 Workers 에 올린다. 설정은 `wrangler.jsonc`·`open-next.config.ts` 에 있다.

Workers Builds(Git 연결) 빌드 구성:

| 항목 | 값 |
| --- | --- |
| 빌드 명령 | `npx opennextjs-cloudflare build` |
| 배포 명령 | `npx opennextjs-cloudflare deploy` |
| 버전 명령 | `npx wrangler versions upload` |
| 루트 디렉터리 | `/` |

Worker 이름은 `wrangler.jsonc` 의 `name`(`x-post`)과 대시보드의 Worker 이름이 같아야 한다.

환경변수는 대시보드 **설정 → 변수 및 비밀**에 **비밀(Secret)** 로 넣는다. 빌드 때는 필요 없고 실행 때만 읽는다.

```bash
# CLI 로 넣을 때
npx wrangler secret put X_QUEUE_SUPABASE_URL
npx wrangler secret put X_QUEUE_SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put X_POST_ACCESS_TOKEN
npx wrangler secret put X_POST_PASSWORD
```

로컬 `npm run preview` 는 `.dev.vars` 를 읽는다(`.dev.vars.example` 참고, Git 에서 제외됨).
`wrangler.jsonc`의 `keep_vars: true`는 대시보드에서 설정한 기존 환경변수를 배포 시 보존한다.

## 상태

| status | 뜻 |
| --- | --- |
| `pending` | 대기 |
| `processing` | 이미지 준비 중 |
| `posting` | X 게시 중 |
| `posted` | 완료 (`x_post_url` 에 링크) |
| `failed` | 3회 실패. 원인을 고친 뒤 `pending` 으로 바꾸면 다시 처리 |
| `unknown` | 게시 여부 불확실. X 에서 확인한 뒤 손으로 정리 |
