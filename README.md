# 기억할 권리

사진을 다시 보고 한 줄 메모와 함께 보관하는 모바일 웹앱입니다. 정책은 [PROJECT.md](PROJECT.md), API·DB 계약은 [ARCHITECTURE.md](ARCHITECTURE.md), 검증 상태는 [ROADMAP.md](ROADMAP.md)를 기준으로 합니다.

## 현재 상태

2026년 10월 11일 Cloudflare Worker `recall-memory`를 [https://recall-memory.jwjoo0512.workers.dev](https://recall-memory.jwjoo0512.workers.dev)에 배포하고 같은 원격 Supabase 프로젝트를 MVP 운영에도 사용하도록 연결했습니다. Supabase URL·공개 키·서버 비밀 키와 `APP_BASE_URL`은 Cloudflare secret binding으로 설정했습니다. `/`·`/login`은 HTTP 200, 비로그인 `/api/me`는 예상된 `401 UNAUTHENTICATED`를 반환합니다. Supabase가 Worker callback 주소를 허용하는 것도 사전 확인했지만, Worker에서 실제 Google 로그인을 끝내지는 않았습니다. GitHub 저장소 연결은 등록했지만 Workers Builds trigger는 아직 없어 `main` push가 자동 배포를 시작하지 않습니다.

2026년 10월 10일 현재 lint·typecheck·단위 테스트 15개·원격 통합 테스트 6개·모바일 Chromium E2E 8개와 운영 빌드가 통과했습니다. 당시 통합/E2E는 합성 계정과 파일을 만들고 정리했습니다. 실제 모바일 기기·오프라인 시험과 48시간 경과 후 재접속은 남아 있습니다. 2026-10-10 Storage 전송 변경 후 Supabase 원격 로그 10분 집계에서 합성 파일명·메모 문구·`token=`은 없었습니다. 관리 로그에는 계정·IP·요청 경로 같은 메타데이터가 남으므로 운영 로그 접근·보존 검토가 필요합니다. 원격 migration `20261010053800`, `20261010053830`, `20261010055100`과 예약 업로드 정책의 `private` 함수 배치를 확인했습니다. Google OAuth 개발 로그인을 확인했고, 콜백이 시작한 loopback 주소를 유지하도록 수정했습니다. 같은 Supabase 프로젝트의 10분 Cron은 HTTP 200을 반환하며 현재 운영 DB에도 적용됩니다. 합성 업로드와 계정 삭제 대상으로 유지관리 worker의 실제 Storage·DB·Auth 정리까지 검증했습니다. 운영 모드에서는 이 DB를 통합/E2E fixture로 쓰지 못하도록 차단합니다.

2026-10-10 리팩토링으로 업로드 확정 API는 `{ photo }`만 반환합니다. 사용하지 않는 계정 조회를 제거해 사진 확정 후 부가 조회 실패로 업로드 실패가 표시되지 않도록 했습니다. 업로드 확정·계정 삭제의 내부 RPC는 같은 요청에서 검증한 인증 결과를 재사용합니다. 실험 시각은 `GET /api/me`에서 조회하며, 요청 간 인증 공유나 DB 권한 검사의 생략은 없습니다.

연결된 Supabase 조직의 현재 요금제는 Free입니다. [Supabase 로그 안내](https://supabase.com/docs/guides/troubleshooting/check-usage-for-monthly-active-users-mau-MwZaBs)는 Free 요금제에서 최근 1일 로그를 볼 수 있다고 설명합니다. [백업 안내](https://supabase.com/docs/guides/platform/backups)에 따르면 자동 일일 DB 백업은 Pro 이상이며 Free에는 정기 오프사이트 DB export가 권장되고, DB 백업은 Storage API 파일을 포함하지 않습니다. 별도 DB·사진 파일 백업과 복구 연습은 아직 구성하지 않았으므로 실제 참여자 데이터 수집 전 결정해야 합니다.

사용자의 후속 지시에 따라 **기존 원격 Supabase 프로젝트를 개발과 MVP 운영이 함께 쓰는 DB로 사용합니다.** [recall-memory 프로젝트](https://supabase.com/dashboard/project/mgedpimvznbatmipaacn)는 `JooJeongwon` 조직·서울 지역에 있으며 생성 시 조회한 비용은 월 $0입니다. 5개 테이블·서버 전용 함수·RLS·최소 GRANT·비공개 `memory-assets` 버킷이 적용되어 있고 원격 SQL·익명 HTTP 접근 차단을 확인했습니다. 현재 Security Advisor에는 Auth의 leaked password protection 비활성화 WARN 1건이 남아 있습니다. `events`·`cleanup_jobs`의 정책 없음 INFO 2건은 일반 사용자 접근을 전부 막는 설계에 따른 결과입니다. 현재 Google 로그인만 사용하며 이메일/비밀번호 로그인을 허용한다면 [유출 비밀번호 보호](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)를 켜야 합니다. [RLS advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)을 참고합니다.

`.env.local`의 ID·URL·키는 Worker와 같은 Supabase 프로젝트를 가리킵니다. 서버 키는 브라우저 정적 번들에 포함되지 않는 것을 확인했습니다. 기존 원격 통합 검증에서는 서로 다른 두 계정의 Auth 세션·프로필 분리·직접 변경 차단·서버 전용 RPC 차단을 통과했습니다. 현재 이 프로젝트는 운영에도 쓰므로 `SUPABASE_ENVIRONMENT=production`으로 표시하고 통합/E2E fixture 생성을 거절합니다. 해당 검증은 별도 Supabase 프로젝트에서만 실행해야 합니다. 실제 48시간 경과 후 재접속은 아직 확인하지 않았습니다. 로컬 DB는 중지했습니다.

참여자 로그인에는 [Google Cloud Console](https://console.cloud.google.com/auth/clients)의 Web application OAuth client와 [Supabase Google Provider 설정](https://supabase.com/dashboard/project/mgedpimvznbatmipaacn/auth/providers?provider=Google)이 필요합니다. Authorized JavaScript origins에 `http://localhost:3000`을 넣고, Google의 Authorized redirect URI에는 Supabase callback `https://mgedpimvznbatmipaacn.supabase.co/auth/v1/callback`을 넣습니다. Supabase [Auth URL 설정](https://supabase.com/dashboard/project/mgedpimvznbatmipaacn/auth/url-configuration)에는 `http://localhost:3000/auth/confirm`, `http://127.0.0.1:3000/auth/confirm`, `https://recall-memory.jwjoo0512.workers.dev/auth/confirm`을 허용합니다. Worker 주소는 Supabase authorize 응답에서 허용되는 것을 사전 확인했지만, 실제 Worker 로그인은 아직 확인하지 않았습니다. Client Secret은 Supabase 대시보드에만 저장하며 `.env.local`이나 저장소에 넣지 않습니다. 인증된 기존 이메일 계정과 같은 Google 이메일을 사용하면 Supabase Auth가 identity를 자동 연결하므로 기존 데이터를 이어 쓸 수 있습니다 ([Supabase Google OAuth 설정](https://supabase.com/docs/guides/auth/social-login/auth-google), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)). 개발 환경에서 Google 로그인을 완료하고 `/start` 도착을 확인했습니다. 원인은 `127.0.0.1`과 `APP_BASE_URL`의 `localhost`가 달라 세션 쿠키가 다른 host로 이동한 것이었습니다. 콜백과 개발 환경 Origin 검사를 시작한 host에 맞췄습니다.

Sharp 0.35.5·Vitest 4.1.11을 고정했습니다. `npm audit --omit=dev`는 0건입니다. 전체 개발·빌드 도구 감사에는 12건(중간 4, 높음 8)의 전이 취약점이 남으며, npm이 제안하는 강제 수정은 vinext를 호환성 없는 0.2.1로 내립니다. [braces 보안 공지](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)를 참고합니다.

웹 런타임은 Cloudflare Workers + vinext입니다. Sharp는 테스트 fixture 생성에만 남고 Worker 이미지 검증·WebP 썸네일은 Cloudflare Images binding을 사용합니다. 변환은 매월 5,000개의 고유 변환까지 무료이며 초과하면 새 변환이 실패합니다 ([가격](https://developers.cloudflare.com/images/pricing/)). 로컬 binding은 과금되지 않습니다 ([로컬 개발](https://developers.cloudflare.com/images/optimization/binding/)). 사진은 변환을 위해 Cloudflare에서 처리됩니다. `vinext check`·typecheck·Worker build는 통과했고 build artifact에 Supabase 서버 키가 포함되지 않는 것을 확인했습니다. Worker에는 `ASSETS`·`IMAGES`와 Supabase URL·공개 키·서버 비밀 키·`APP_BASE_URL` secret binding이 있습니다. Cloudflare Workers Builds trigger는 아직 없어 Git push만으로 자동 배포되지 않습니다.

## 설치와 실행

Node.js 22.18 이상을 사용합니다. Cloudflare typed config 로딩에 필요한 최소 버전입니다.

```sh
npm ci
```

`.env.example`을 `.env.local`로 복사하고 앱이 연결할 Supabase 프로젝트 값을 지정합니다. 실제 키는 버전 관리에 넣지 않습니다. 현재 `.env.local`과 Worker는 사용자의 결정에 따라 같은 프로젝트를 사용합니다.

- `SUPABASE_PROJECT_ID`: 앱 연결 프로젝트 ID.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: 프로젝트 URL과 공개용 키.
- `SUPABASE_SERVER_SECRET_KEY`: 서버 전용 secret key. `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.
- `APP_BASE_URL`: 개발 앱 주소. 개발 서버와 E2E는 `http://localhost:3000`을 사용합니다.
- `SUPABASE_ENVIRONMENT`: `development` 또는 `production`. 운영 DB를 가리키는 로컬 환경은 반드시 `production`으로 표시합니다.
- `INTEGRATION_SUPABASE_PROJECT_ID`, `INTEGRATION_SUPABASE_URL`, `INTEGRATION_SUPABASE_PUBLISHABLE_KEY`, `INTEGRATION_SUPABASE_SECRET_KEY`: 앱 DB와 분리된 통합/E2E 검증 전용 프로젝트 연결. 운영 프로젝트를 지정하지 않습니다.

```sh
npm run dev
```

Google OAuth를 사용할 때는 Google Authorized redirect URI를 Supabase 프로젝트 callback으로, Supabase Auth의 허용 redirect URL을 앱의 `/auth/confirm` 경로로 설정합니다. Client ID·Secret은 Supabase Google provider 설정에만 보관합니다.

## DB 변경과 타입

최초 migration은 [supabase/migrations/20261008045831_initial_schema.sql](supabase/migrations/20261008045831_initial_schema.sql)입니다. `supabase/schema.sql`은 최초 원본이며 후속 변경은 새 migration으로 남깁니다. `db:prepare`는 최초 파일을 생성한 작업이므로 다시 실행할 필요가 없습니다.

`db:types`는 `.env.local`의 `SUPABASE_PROJECT_ID`로 지정한 원격 프로젝트에서 [src/types/database.ts](src/types/database.ts)를 생성합니다. Supabase CLI 로그인이 필요합니다. 최초 연결에서는 Supabase 플러그인의 실제 프로젝트 타입 생성 기능도 사용할 수 있습니다.

```sh
npx supabase login --help
npx supabase login
npm run db:types
npm run typecheck
```

원격 migration은 Supabase 플러그인 또는 인증된 CLI로 적용합니다. 로컬 `db reset`으로 원격 환경을 구성하지 않습니다. 공개 테이블에는 RLS와 최소 GRANT를 적용하고 `memory-assets` 버킷은 비공개로 유지합니다.

## 유지관리

[supabase/functions/maintenance](supabase/functions/maintenance/index.ts)은 같은 Supabase 프로젝트에 배포되며 인증 없는 POST가 `401`을 반환합니다. Supabase는 함수 런타임에 `SUPABASE_URL`과 `SUPABASE_SECRET_KEYS`를 제공하므로 별도 서버 키를 함수 secret으로 복사하지 않습니다 ([환경변수 문서](https://supabase.com/docs/guides/functions/secrets)). `pg_cron`·`pg_net`은 활성화되어 `extensions` schema에 있습니다. `MAINTENANCE_CALL_SECRET`은 Supabase API 키와 별개인 내부 Cron 인증 비밀이며, 같은 값을 Edge Function secret과 Vault의 `recall_maintenance_secret`에 저장합니다. `recall_project_url`에는 프로젝트 URL을 저장합니다. 2026-10-10에 등록한 `recall-maintenance` 일정은 10분마다 실행 중이며 HTTP 200을 반환하는 것을 확인했습니다. 이 일정도 공유 운영 DB를 처리합니다. `supabase/cron.sql`은 프로젝트마다 한 번만 적용합니다. Supabase 관리형 `cron` 테이블 권한은 변경하지 않고 `cron.schedule()`로 등록합니다.

정상 `ready` 사진은 자동 정리 대상이 아닙니다. 사용자 삭제, 검증 실패, 24시간 지난 미완료 업로드만 정리합니다. 이미 발급된 업로드 토큰이 파일을 다시 만들지 못하도록 객체 제거에 약 2시간의 대기 시간을 둡니다. 실제 파일 제거 전에는 “삭제 중”을 표시합니다. 합성 데이터로 미완료 업로드의 Storage 제거와 사용자 삭제 후 Storage·DB·Auth 전체 제거를 검증했습니다. 운영 상태와 큐·사진·버킷 용량을 수치만으로 조회하는 읽기 전용 SQL은 [supabase/operations.sql](supabase/operations.sql)에 있습니다.

## 검증

```sh
npm run lint
npm run typecheck
npm run test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build
```

Vitest와 Playwright는 `.env.local`을 읽습니다. `SUPABASE_ENVIRONMENT=production`이면 통합/E2E fixture 생성을 거부합니다. 통합 검증은 앱 DB와 분리된 프로젝트 ID와 HTTPS URL이 정확히 일치해야 실행됩니다. 합성 이미지와 가상 메모만 사용합니다. E2E는 Chromium의 새 headless 방식을 사용하고 trace·사진·동영상 기록은 비활성화합니다.

현재 E2E는 빈 목록·요청 재시도, HEIC·10 MiB 초과 사전 거절, Storage 전송 실패 후 재시도, 사진 탐색, 보관·ZIP 흐름, 설정 동의·철회와 삭제 요청 UI를 확인합니다. 원격 통합 테스트는 두 사용자 권한 분리, 예약 중복·한도, 만료 경계, 메모 길이·동시성, 삭제 큐·Storage API 제거·완료·lease 재시도를 확인합니다. 합성 데이터로 실제 유지관리 함수를 호출해 미완료 업로드 파일 제거와 계정의 파일·프로필·메모·Auth 삭제를 확인했습니다. 실제 Storage 장애 후 재시도, 로그아웃 후 재로그인, 실제 48시간 경과, 기존 DB upgrade는 추가 확인이 필요합니다. Google OAuth는 개발 환경에서 로그인에 성공했고, 콜백이 시작한 주소를 유지하도록 수정했습니다. P1 전체 완료와 MVP 완료는 표시하지 않았습니다.

2026-10-10 모바일 Chromium E2E에서 사진 목록 API와 ZIP 원본 스트림의 연결 단절 안내·재시도 후 복구를 확인했습니다. 실제 iOS·Android 기기와 느린 네트워크 검증은 남아 있습니다.

2026-10-10 원격 통합 테스트에서 `sweep_incomplete()`이 기한 지난 `uploading`·`failed`만 정리 큐에 넣고, 기한 지난 `ready` 보관·미보관 사진은 유지하는 것을 확인했습니다. 별도의 합성 worker 검증에서 Storage 제거와 계정 전체 삭제까지 완료했습니다. 실제 24시간 벽시계 경과 검증은 남아 있습니다.
