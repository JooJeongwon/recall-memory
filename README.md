# 기억할 권리

사진을 다시 보고 기한 안에 두 메모를 남겨 보관하는 모바일 웹앱입니다. 정책은 [PROJECT.md](PROJECT.md), API·DB 계약은 [ARCHITECTURE.md](ARCHITECTURE.md), 검증 상태는 [ROADMAP.md](ROADMAP.md)를 기준으로 합니다.

## 현재 상태

2026-10-12 방문·사용자 통계 도구를 기존 Supabase와 Worker에 적용했다. [관리자 통계](https://recall-memory.jwjoo0512.workers.dev/admin/analytics)는 `jwjoo0512@gmail.com`·`elice0105412@gmail.com`의 확인된 Google 로그인만 허용한다. 설정 화면에도 관리자용 링크가 나타난다. [QR 표시 링크](https://recall-memory.jwjoo0512.workers.dev/qr)는 `/?source=qr`로 이동한다. 일반 주소를 담은 기존 QR은 직접 방문과 구분하지 못하지만 전체 방문 수집에는 포함된다. 적용 이전의 방문은 복구하지 않는다.

방문 세션(같은 탭에서 30분 이내 이어진 화면 조회), 로그인 없이 끝난 세션, 로그인 세션, 사진 사용 이력이 있는 로그인 세션, 화면 조회를 각각 표시한다. 사진 사용자 세션은 로그인 세션의 부분집합이다. 현재 가입·사진 사용 시작 계정 수는 DB의 운영 데이터 집계이고, 기간 중 로그인 고유 계정·제품 행동은 분석 동의한 계정만 포함한다. 오늘·최근 7/30/90일을 한국 시간으로 조회하고 집계 JSON을 다운로드한다. 관리자 통계 화면·개발·자동 브라우저·추적 거부·알려진 봇을 제외한다. 익명 세션을 실제 고유 사람 수로 표시하지 않으며 광고 차단·통신 실패·저장소 차단·공유 IP 속도 제한으로 수신되지 않은 방문은 빠질 수 있다.

사용자가 결정한 방문 원본 보관 기간은 90일이다. `recall-visit-retention`은 매일 18:15 UTC(한국 시간 03:15)에 90일 초과 방문 기록을 정리한다. 계정과 연결된 기록은 동의 철회·계정 삭제 때 제거돼 과거 집계도 바뀔 수 있다. 사진·메모·파일명·이메일·원문 URL·IP는 방문 테이블에 저장하지 않는다. migration `20261012122621`, `20261012123105`, `20261012123523`을 원격에 적용했고 실제 스키마에서 타입을 재생성했다. 신규 migration의 보관 정리 일정은 기존 프로젝트에서 활성화된 `pg_cron`을 사용한다. 새 DB에서는 먼저 `pg_cron`을 활성화해야 한다.

단위 테스트 31개·lint·typecheck·Worker build와 실제 서버 역할의 관리자 집계 RPC·일반/익명 접근 거절을 확인했다. 운영 `/`·`/login` 200, `/qr` 302, 비로그인 통계 API 401과 관리자 화면 로그인 이동을 확인했다. 자동 브라우저·추적 거부·잘못된 입력 검증은 실제 방문 기록을 생성하지 않고 수행했다. 로컬 CLI는 Cloudflare 인증 토큰이 없어 배포가 실패했고, 연결된 Cloudflare 도구의 직접 업로드로 기존 secret binding을 보존해 배포했다. 실제 Google 관리자 로그인 화면, 참여자 수집·전환, 실기기와 빈 DB migration 재구성·90일 경과 정리는 미검증이다. Docker가 실행 중이지 않아 로컬 DB fixture 검증은 하지 않았다.

2026년 10월 11일 Cloudflare Worker `recall-memory`를 [https://recall-memory.jwjoo0512.workers.dev](https://recall-memory.jwjoo0512.workers.dev)에 배포하고 같은 원격 Supabase 프로젝트를 MVP 운영에도 사용하도록 연결했습니다. Supabase URL·공개 키·서버 비밀 키와 `APP_BASE_URL`은 Cloudflare secret binding으로 설정했습니다. `/`·`/login`은 HTTP 200, 비로그인 `/api/me`는 예상된 `401 UNAUTHENTICATED`를 반환합니다. Supabase가 Worker callback 주소를 허용하는 것도 사전 확인했지만, Worker에서 실제 Google 로그인을 끝내지는 않았습니다. `.github/workflows/deploy-worker.yml`은 `main` push 또는 수동 실행으로 배포하며, GitHub 저장소에 `CLOUDFLARE_API_TOKEN` secret을 추가하기 전까지는 안전하게 배포를 건너뜁니다.

2026년 10월 10일 현재 lint·typecheck·단위 테스트 15개·원격 통합 테스트 6개·모바일 Chromium E2E 8개와 운영 빌드가 통과했습니다. 당시 통합/E2E는 합성 계정과 파일을 만들고 정리했습니다. 실제 모바일 기기·오프라인 시험과 48시간 경과 후 재접속은 남아 있습니다. 2026-10-10 Storage 전송 변경 후 Supabase 원격 로그 10분 집계에서 합성 파일명·메모 문구·`token=`은 없었습니다. 관리 로그에는 계정·IP·요청 경로 같은 메타데이터가 남으므로 운영 로그 접근·보존 검토가 필요합니다. 원격 migration `20261010053800`, `20261010053830`, `20261010055100`과 예약 업로드 정책의 `private` 함수 배치를 확인했습니다. Google OAuth 개발 로그인을 확인했고, 콜백이 시작한 loopback 주소를 유지하도록 수정했습니다. 같은 Supabase 프로젝트의 10분 Cron은 HTTP 200을 반환하며 현재 운영 DB에도 적용됩니다. 합성 업로드와 계정 삭제 대상으로 유지관리 worker의 실제 Storage·DB·Auth 정리까지 검증했습니다. 운영 모드에서는 이 DB를 통합/E2E fixture로 쓰지 못하도록 차단합니다.

2026-10-10 리팩토링으로 업로드 확정 API는 `{ photo }`만 반환합니다. 사용하지 않는 계정 조회를 제거해 사진 확정 후 부가 조회 실패로 업로드 실패가 표시되지 않도록 했습니다. 업로드 확정·계정 삭제의 내부 RPC는 같은 요청에서 검증한 인증 결과를 재사용합니다. 실험 시각은 `GET /api/me`에서 조회하며, 요청 간 인증 공유나 DB 권한 검사의 생략은 없습니다.

연결된 Supabase 조직의 현재 요금제는 Free입니다. [Supabase 로그 안내](https://supabase.com/docs/guides/troubleshooting/check-usage-for-monthly-active-users-mau-MwZaBs)는 Free 요금제에서 최근 1일 로그를 볼 수 있다고 설명합니다. [백업 안내](https://supabase.com/docs/guides/platform/backups)에 따르면 자동 일일 DB 백업은 Pro 이상이며 Free에는 정기 오프사이트 DB export가 권장되고, DB 백업은 Storage API 파일을 포함하지 않습니다. 별도 DB·사진 파일 백업과 복구 연습은 아직 구성하지 않았으므로 실제 참여자 데이터 수집 전 결정해야 합니다.

사용자의 후속 지시에 따라 **기존 원격 Supabase 프로젝트를 개발과 MVP 운영이 함께 쓰는 DB로 사용합니다.** [recall-memory 프로젝트](https://supabase.com/dashboard/project/mgedpimvznbatmipaacn)는 `JooJeongwon` 조직·서울 지역에 있으며 생성 시 조회한 비용은 월 $0입니다. 5개 테이블·서버 전용 함수·RLS·최소 GRANT·비공개 `memory-assets` 버킷이 적용되어 있고 원격 SQL·익명 HTTP 접근 차단을 확인했습니다. 현재 Security Advisor에는 Auth의 leaked password protection 비활성화 WARN 1건이 남아 있습니다. `events`·`cleanup_jobs`의 정책 없음 INFO 2건은 일반 사용자 접근을 전부 막는 설계에 따른 결과입니다. 현재 Google 로그인만 사용하며 이메일/비밀번호 로그인을 허용한다면 [유출 비밀번호 보호](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)를 켜야 합니다. [RLS advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)을 참고합니다.

`.env.local`의 ID·URL·키는 Worker와 같은 Supabase 프로젝트를 가리킵니다. 서버 키는 브라우저 정적 번들에 포함되지 않는 것을 확인했습니다. 기존 원격 통합 검증에서는 서로 다른 두 계정의 Auth 세션·프로필 분리·직접 변경 차단·서버 전용 RPC 차단을 통과했습니다. 현재 이 프로젝트는 운영에도 쓰므로 `SUPABASE_ENVIRONMENT=production`으로 표시하고 통합/E2E fixture 생성을 거절합니다. 해당 검증은 별도 Supabase 프로젝트에서만 실행해야 합니다. 실제 48시간 경과 후 재접속은 아직 확인하지 않았습니다. 로컬 DB는 중지했습니다.

참여자 로그인에는 [Google Cloud Console](https://console.cloud.google.com/auth/clients)의 Web application OAuth client와 [Supabase Google Provider 설정](https://supabase.com/dashboard/project/mgedpimvznbatmipaacn/auth/providers?provider=Google)이 필요합니다. Authorized JavaScript origins에 `http://localhost:3000`을 넣고, Google의 Authorized redirect URI에는 Supabase callback `https://mgedpimvznbatmipaacn.supabase.co/auth/v1/callback`을 넣습니다. Supabase [Auth URL 설정](https://supabase.com/dashboard/project/mgedpimvznbatmipaacn/auth/url-configuration)에는 `http://localhost:3000/auth/confirm`, `http://127.0.0.1:3000/auth/confirm`, `https://recall-memory.jwjoo0512.workers.dev/auth/confirm`을 허용합니다. Worker 주소는 Supabase authorize 응답에서 허용되는 것을 사전 확인했지만, 실제 Worker 로그인은 아직 확인하지 않았습니다. Client Secret은 Supabase 대시보드에만 저장하며 `.env.local`이나 저장소에 넣지 않습니다. 인증된 기존 이메일 계정과 같은 Google 이메일을 사용하면 Supabase Auth가 identity를 자동 연결하므로 기존 데이터를 이어 쓸 수 있습니다 ([Supabase Google OAuth 설정](https://supabase.com/docs/guides/auth/social-login/auth-google), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)). 개발 환경에서 Google 로그인을 완료하고 `/start` 도착을 확인했습니다. 원인은 `127.0.0.1`과 `APP_BASE_URL`의 `localhost`가 달라 세션 쿠키가 다른 host로 이동한 것이었습니다. 콜백과 개발 환경 Origin 검사를 시작한 host에 맞췄습니다.

Sharp 0.35.5·Vitest 4.1.11을 고정했습니다. `npm audit --omit=dev`는 0건입니다. 전체 개발·빌드 도구 감사에는 12건(중간 4, 높음 8)의 전이 취약점이 남으며, npm이 제안하는 강제 수정은 vinext를 호환성 없는 0.2.1로 내립니다. [braces 보안 공지](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)를 참고합니다.

웹 런타임은 Cloudflare Workers + vinext입니다. Sharp는 테스트 fixture 생성에만 남고 Worker 이미지 검증·WebP 썸네일은 Cloudflare Images binding을 사용합니다. 변환은 매월 5,000개의 고유 변환까지 무료이며 초과하면 새 변환이 실패합니다 ([가격](https://developers.cloudflare.com/images/pricing/)). 로컬 binding은 과금되지 않습니다 ([로컬 개발](https://developers.cloudflare.com/images/optimization/binding/)). 사진은 변환을 위해 Cloudflare에서 처리됩니다. `vinext check`·typecheck·Worker build는 통과했고 build artifact에 Supabase 서버 키가 포함되지 않는 것을 확인했습니다. Worker에는 `ASSETS`·`IMAGES`와 Supabase URL·공개 키·서버 비밀 키·`APP_BASE_URL` secret binding이 있습니다. GitHub Actions 배포 자동화는 `CLOUDFLARE_API_TOKEN` secret 설정 후 활성화됩니다.

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

## 개발 중 오류 확인

`npm run dev`를 실행한 터미널에 API 성공·실패를 한 줄 JSON으로 출력합니다. `operation`은 실제 사진 ID 대신 `/api/uploads/[id]/complete` 같은 고정 경로이며, `request_id`, `method`, `status`, `duration_ms`로 요청을 구분합니다. 실패 로그에는 `code`, `stage`, `error_type`과 허용된 DB/Images `provider_code`를 추가합니다. `rpc.reserve_uploads`는 DB 예약 단계, `upload.download`는 원본 다운로드, `images.info`·`images.validation`·`images.transform`은 이미지 검사·변환, `upload.thumbnail`은 썸네일 저장 단계입니다.

Cloudflare 설정에 앱 주소·Supabase URL·공개 키·서버 키를 required secret binding으로 선언해 개발 런타임에서도 기존 `.env.local`을 읽도록 했습니다. 연결 값을 변경하면 개발 서버를 재시작합니다. Node.js 22.18 이상이 필요합니다. 개발 서버 실행 중 [로컬 Debug 화면](http://127.0.0.1:3000/__debug)에서도 플랫폼의 개발 로그를 확인할 수 있습니다.

업로드 실패 화면의 `요청 ID`를 터미널에서 찾아 원인을 확인합니다. 같은 ID는 API 오류 응답의 `error.request_id`와 `X-Request-Id` 헤더에도 있습니다. 개발 환경의 브라우저 개발자 도구 Console에는 `upload_failed`와 `storage_upload_failed`가 표시되어 파일 검사·예약·Storage 전송·확정 중 어느 단계인지 확인할 수 있습니다. API 요청이 전송되지 않은 실패는 서버 요청 ID가 없으며 `client_request_id`로 브라우저 로그를 연결합니다.

사진·메모·파일명·사용자 ID·요청 본문·쿠키·URL·원문 오류·stack·오류 details는 앱 로그에 넣지 않습니다. 개발 브라우저 로그도 단계와 임의 요청 ID, Storage HTTP 상태만 기록합니다. Worker 설정에는 [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) 수집을 추가하고 URL을 자동 기록하는 invocation logs와 traces를 끄며 query string을 제거합니다. **이 설정과 새 앱 로그는 아직 운영에 배포하지 않았습니다.** 배포 후 Cloudflare 대시보드 → Workers & Pages → `recall-memory` → Observability에서 `request_id`로 조회할 수 있습니다. 제공자 로그의 접근·보존 정책 검토는 계속 남아 있습니다.

2026-10-12 이번 로그 변경은 단위 테스트 22개·lint·typecheck·Worker build를 통과했습니다. 로컬 합성 오류 요청으로 응답·헤더·터미널 로그의 요청 ID가 같음을 확인했고 Debug 화면은 HTTP 200을 반환했습니다. 실제 8장 업로드 실패 재현과 원격 로그 수집은 아직 확인하지 않았습니다.

## DB 변경과 타입

최초 migration은 [supabase/migrations/20261008045831_initial_schema.sql](supabase/migrations/20261008045831_initial_schema.sql)입니다. `supabase/schema.sql`은 최신 전체 스키마이며 후속 변경은 새 migration으로 남깁니다. `db:prepare`는 최초 파일을 생성한 작업이므로 다시 실행할 필요가 없습니다. 사진 소프트 삭제와 두 단계 메모 기한 migration은 각각 `20261012024618_photo_soft_delete.sql`, `20261012024626_note_retention_checkpoints.sql`입니다. 두 migration은 공유 원격 프로젝트에 2026-10-12 적용했습니다. 기한 migration은 기존 `preserved_at`을 해제하고 저장된 메모를 첫 메모로 취급합니다. 기존 사진에도 새 기한을 소급 적용합니다. 원격 스키마에서 타입을 생성해 `src/types/database.ts`의 필드와 RPC가 일치함을 확인했습니다.

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

2026-10-12 코드 변경 및 적용: 첫 메모는 사진 업로드 완료 뒤 24시간, 두 번째 메모는 첫 메모 저장 뒤 48시간 안에 남겨야 사진과 두 메모가 유지됩니다. 기한이 지나면 `retention_expired` 작업으로 원본·썸네일·메모를 함께 정리하고 파일 삭제 실패는 기존 재시도 큐를 사용합니다. 기존 사진도 소급 대상입니다. migration은 기존 보관 표시를 초기화하고 현재 저장 메모를 첫 메모로 간주합니다. 두 migration을 공유 원격 DB에 적용했고 Worker를 [운영 URL](https://recall-memory.jwjoo0512.workers.dev)에 배포했습니다. `GET /`은 200을 반환했습니다. 기존 10분 유지관리 Cron은 migration 뒤 성공 실행을 기록했으며, 확인 시점에 기한이 지난 사진과 삭제 처리 중인 사진은 없었습니다. 실제 파일 삭제·재시도와 두 단계 기한 경계는 아직 검증하지 않았습니다. 사진 상세 화면과 ZIP에는 두 메모를 표시·포함합니다. 정상 `ready` 사진의 사용자 삭제는 `soft_deleted`로 바꿔 사용자 화면에서 숨기며, 계정 삭제는 파일과 DB 행을 실제로 제거합니다. 24시간 지난 미완료 업로드도 정리 대상이며, 이미 발급된 업로드 권한이 끝나도록 객체 제거를 약 2시간 늦춥니다. 운영 상태와 큐·사진·버킷 용량을 수치만으로 조회하는 읽기 전용 SQL은 [supabase/operations.sql](supabase/operations.sql)에 있습니다.

## 검증

2026-10-12 `feat/frontend-seeun`과 `integration/frontend-ui`를 통합했다. 소개·로그인·사진 선택·사진 상세 디자인과 오프닝 애니메이션을 반영하고, 다시 보기·보관함·수정 화면은 기존 두 단계 메모 편집기를 사용한다. 사진 조회는 같은 출처의 인증된 바이너리 API, 업로드는 사용자 세션의 Storage 업로드를 유지한다. 설정의 일괄 ZIP은 기존 사진별 내보내기 API로 원본과 두 메모를 받아 브라우저에서 생성한다. 계정 삭제도 설정에서 계속 요청할 수 있다. 이번 검증과 남은 제한은 `ROADMAP.md`의 프런트 브랜치 통합 기록을 참고한다.

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

기존 검증 E2E와 원격 통합 테스트는 이전 한 메모 보관 정책을 기준으로 했습니다. 새 두 단계 메모·24/48시간 기한·소급 정리는 아직 검증하지 않았고, 이번 변경에서 테스트를 실행하지 않았습니다. 기존 미완료 업로드 파일 정리와 계정 전체 정리는 합성 데이터로 확인했습니다. 실제 Storage 장애 후 재시도, 로그아웃 후 재로그인, 실기기·운영 OAuth, 기존 DB upgrade는 추가 확인이 필요합니다. Google OAuth는 개발 환경에서 로그인에 성공했고, 콜백이 시작한 주소를 유지하도록 수정했습니다. P1 전체 완료와 MVP 완료는 표시하지 않았습니다.

2026-10-10 모바일 Chromium E2E에서 사진 목록 API와 ZIP 원본 스트림의 연결 단절 안내·재시도 후 복구를 확인했습니다. 실제 iOS·Android 기기와 느린 네트워크 검증은 남아 있습니다.

2026-10-10 원격 통합 테스트에서 당시 `sweep_incomplete()`이 기한 지난 `uploading`·`failed`만 정리 큐에 넣고, `ready` 사진은 유지하는 것을 확인했습니다. 2026-10-12 migration은 `ready`·`soft_deleted` 사진의 첫·두 번째 메모 기한도 정리하며 아직 검증하지 않았습니다. 별도의 합성 worker 검증에서 Storage 제거와 계정 전체 삭제까지 완료했습니다. 실제 기한 경과 및 새 규칙의 DB 경계 검증은 남아 있습니다.
