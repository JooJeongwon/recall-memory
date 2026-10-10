# 기억할 권리

사진을 다시 보고 한 줄 메모와 함께 보관하는 모바일 웹앱입니다. 정책은 [PROJECT.md](PROJECT.md), API·DB 계약은 [ARCHITECTURE.md](ARCHITECTURE.md), 검증 상태는 [ROADMAP.md](ROADMAP.md)를 기준으로 합니다.

## 현재 상태

2026년 10월 10일 현재 lint·typecheck·단위 테스트 14개·원격 통합 테스트 6개·모바일 E2E 8개가 통과했습니다. 운영 빌드도 최근 코드 변경에서 통과했습니다. 원격 통합 테스트와 사진 E2E는 흐름별 독립 테스트로 나누고 테스트마다 합성 계정·파일을 생성·정리합니다. E2E는 목록 재시도 후 늦은 응답·오류 무시, 빈 목록 재시도, 업로드 검증·재시도, 사진 탐색, 메모 충돌·저장 실패 복구, 보관함 썸네일 실패 후 재시도, 만료 후 ZIP 원본 검증, 분석 동의·철회, 삭제 요청 UI를 확인합니다. 저장소와 사진 API는 Storage 서명 URL·업로드 token 대신 세션 기반 예약 업로드와 소유권 확인 후 같은 출처 바이너리 스트리밍을 사용합니다. API·ZIP 전송 중 네트워크 요청이 끊기면 재시도 안내를 표시하지만, 실제 모바일 오프라인 시험은 남아 있습니다. 2026-10-10 Storage 전송 방식 변경 후 원격 로그 10분 집계에서 합성 파일명·메모 문구·`token=`이 없었습니다. Supabase 관리 로그에는 계정·IP·요청 경로 같은 메타데이터가 남으므로 운영 로그 접근·보존 검토는 남아 있습니다. 원격 migration `20261010053800`, `20261010053830`, `20261010055100` 적용과 예약 업로드 정책의 `private` 함수 배치를 확인했습니다. Google OAuth 실제 로그인은 사용자 요청에 따라 이번 작업에서 확인하지 않았습니다. 실제 48시간 재접속, Cron·자동 삭제와 계정 전체 제거도 아직 검증하지 않았습니다.

2026-10-10 리팩토링으로 업로드 확정 API는 `{ photo }`만 반환합니다. 사용하지 않는 계정 조회를 제거해 사진 확정 후 부가 조회 실패로 업로드 실패가 표시되지 않도록 했습니다. 업로드 확정·계정 삭제의 내부 RPC는 같은 요청에서 검증한 인증 결과를 재사용합니다. 실험 시각은 `GET /api/me`에서 조회하며, 요청 간 인증 공유나 DB 권한 검사의 생략은 없습니다.

연결된 Supabase 조직의 현재 요금제는 Free입니다. [Supabase 로그 안내](https://supabase.com/docs/guides/troubleshooting/check-usage-for-monthly-active-users-mau-MwZaBs)는 Free 요금제에서 최근 1일 로그를 볼 수 있다고 설명합니다. [백업 안내](https://supabase.com/docs/guides/platform/backups)에 따르면 자동 일일 DB 백업은 Pro 이상이며 Free에는 정기 오프사이트 DB export가 권장되고, DB 백업은 Storage API 파일을 포함하지 않습니다. 별도 DB·사진 파일 백업과 복구 연습은 아직 구성하지 않았으므로 실제 참여자 데이터 수집 전 결정해야 합니다.

사용자의 지시에 따라 **DB는 원격 Supabase 전용 개발 프로젝트를 사용합니다.** [recall-memory 프로젝트](https://supabase.com/dashboard/project/mgedpimvznbatmipaacn)는 `JooJeongwon` 조직·서울 지역에 생성했습니다. 생성 시 조회한 비용은 월 $0입니다. 5개 테이블·서버 전용 함수·RLS·최소 GRANT·비공개 `memory-assets` 버킷을 적용하고 원격 SQL·익명 HTTP 접근 차단을 확인했습니다. 보안 advisor의 경고·오류는 0건입니다. `events`·`cleanup_jobs`의 정책 없음 INFO는 일반 사용자 접근을 전부 막는 설계에 따른 결과입니다. [RLS advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)을 참고합니다.

`.env.local`에 개발 프로젝트의 ID·URL·공개 키·서버 키를 설정했습니다. 서버 키는 브라우저 정적 번들에 포함되지 않는 것을 확인했습니다. 원격 통합 검증에서 서로 다른 두 계정의 Auth 세션·프로필 분리·직접 변경 차단·서버 전용 RPC 차단이 통과했습니다. 만료 fixture로 신규 예약과 만료 후 확정을 거절하고 기존 사진의 메모·원본 접근을 확인했습니다. E2E 테스트는 합성 계정 세션을 주입합니다. 실제 Google OAuth 로그인과 실제 48시간 경과 후 재접속은 아직 확인하지 않았습니다. 로컬 DB는 중지했습니다.

참여자 로그인을 시험하기 전에 [Google Cloud Console](https://console.cloud.google.com/auth/clients)에서 Web application OAuth client를 만듭니다. Authorized JavaScript origins에 `http://localhost:3000`을 넣고, Google의 Authorized redirect URI에는 Supabase callback `https://mgedpimvznbatmipaacn.supabase.co/auth/v1/callback`을 넣습니다. 다른 개발 주소도 쓰면 그 origin을 추가합니다. Google Cloud에 표시되는 Client ID·Secret을 [Supabase Google Provider 설정](https://supabase.com/dashboard/project/mgedpimvznbatmipaacn/auth/providers?provider=Google)에 입력하고 provider를 켭니다. Supabase [Auth URL 설정](https://supabase.com/dashboard/project/mgedpimvznbatmipaacn/auth/url-configuration)에서 Site URL을 `http://localhost:3000`으로 두고 허용 redirect URL에 `http://localhost:3000/auth/confirm`, `http://127.0.0.1:3000/auth/confirm`을 추가합니다. Client Secret은 Supabase 대시보드에만 저장하며 `.env.local`이나 저장소에 넣지 않습니다. 인증된 기존 이메일 계정과 같은 Google 이메일을 사용하면 Supabase Auth가 identity를 자동 연결하므로 기존 데이터를 이어 쓸 수 있습니다 ([Supabase Google OAuth 설정](https://supabase.com/docs/guides/auth/social-login/auth-google), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)). Google Provider 설정과 실제 로그인은 아직 확인하지 않았습니다.

Sharp 0.35.5·Vitest 4.1.11의 보안 패치를 반영했습니다. `npm audit --omit=dev`는 0건이며 개발용 lint 도구의 미패치 간접 의존성 경고 5건이 남아 있습니다. [Sharp 릴리스](https://github.com/lovell/sharp/releases/tag/v0.35.5), [Vitest 릴리스](https://github.com/vitest-dev/vitest/releases/tag/v4.1.11), [braces 보안 공지](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)를 참고합니다.

## 설치와 실행

Node.js 22 이상을 사용합니다. lockfile 기준 설치를 확인했습니다.

```sh
npm ci
```

`.env.example`을 `.env.local`로 복사하고 개발 프로젝트의 다음 값을 지정합니다. 실제 키는 버전 관리에 넣지 않습니다.

- `SUPABASE_PROJECT_ID`: 개발 프로젝트 ID.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: 프로젝트 URL과 공개용 키.
- `SUPABASE_SERVER_SECRET_KEY`: 서버 전용 secret key. `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.
- `APP_BASE_URL`: 개발 앱 주소. 개발 서버와 E2E는 `http://localhost:3000`을 사용합니다.
- `INTEGRATION_SUPABASE_PROJECT_ID`, `INTEGRATION_SUPABASE_URL`, `INTEGRATION_SUPABASE_PUBLISHABLE_KEY`, `INTEGRATION_SUPABASE_SECRET_KEY`: 통합 검증 전용 개발 프로젝트 연결. 운영 프로젝트를 지정하지 않습니다.

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

[supabase/functions/maintenance](supabase/functions/maintenance/index.ts)은 개발 프로젝트에 배포했으며 인증 없는 POST가 `401`을 반환합니다. Supabase는 함수 런타임에 `SUPABASE_URL`과 `SUPABASE_SECRET_KEYS`를 제공하므로 별도 서버 키를 함수 secret으로 복사하지 않습니다 ([환경변수 문서](https://supabase.com/docs/guides/functions/secrets)). 개발 DB의 `pg_cron`·`pg_net`은 활성화했습니다. 자동 작업을 켜려면 [Edge Function Secrets](https://supabase.com/dashboard/project/mgedpimvznbatmipaacn/functions/secrets)에 `MAINTENANCE_CALL_SECRET`을 설정하고, 같은 비밀을 Vault의 `recall_maintenance_secret`에, 프로젝트 URL을 `recall_project_url`에 저장한 다음 [supabase/cron.sql](supabase/cron.sql)을 적용해야 합니다. `MAINTENANCE_CALL_SECRET`은 Supabase API 키와 별개인 내부 Cron 인증 비밀입니다. 지금은 Edge Function secret이 없어 Cron을 등록하지 않았고 삭제 요청은 대기 상태에 머뭅니다.

정상 `ready` 사진은 자동 정리 대상이 아닙니다. 사용자 삭제, 검증 실패, 24시간 지난 미완료 업로드만 정리합니다. 이미 발급된 업로드 토큰이 파일을 다시 만들지 못하도록 객체 제거에 약 2시간의 대기 시간을 둡니다. 실제 파일 제거 전에는 “삭제 중”을 표시합니다.

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

Vitest는 `.env.local`을 읽습니다. 통합 검증은 명시한 개발 프로젝트 ID와 HTTPS URL이 정확히 일치해야 실행됩니다. 합성 이미지와 가상 메모만 사용합니다. E2E는 Chromium의 새 headless 방식을 사용하고 trace·사진·동영상 기록은 비활성화합니다.

현재 E2E는 빈 목록·요청 재시도, HEIC·10 MiB 초과 사전 거절, Storage 전송 실패 후 재시도, 두 사진 탐색, 합성 Auth 세션의 보관·ZIP 흐름을 통과했습니다. 설정 동의·철회, 보관 사진 삭제 요청 UI와 계정 삭제 상태 표시도 확인했습니다. 원격 통합 테스트에서 두 사용자 권한 분리, 예약 중복·한도, 만료 경계, 메모 길이·동시성, 삭제 큐·Storage API 제거·완료·lease 재시도를 확인했습니다. 실제 Storage 장애 후 유지관리 worker가 재시도하는 흐름은 미검증입니다. `maintenance` 함수는 배포됐고 미인증 요청은 401이지만 Cron은 등록되지 않아 자동 삭제와 계정 전체 정리는 동작하지 않습니다. 이미지 위장·손상·픽셀 초과 거절, EXIF 보정 썸네일, 메모 초안 보존·재시도, 만료 후 ZIP의 원본 바이트·메타데이터도 E2E에서 확인했습니다. Google OAuth 실제 로그인(이번 요청에서 제외), 로그아웃 후 재로그인, 실제 48시간 경과, Cron 실행, 계정 Auth 제거, 기존 DB 업그레이드는 추가 검증이 필요합니다. P1 전체 완료와 MVP 완료는 표시하지 않았습니다.

2026-10-10 모바일 Chromium E2E에서 사진 목록 API와 ZIP 원본 스트림의 연결 단절 안내·재시도 후 복구를 확인했습니다. 실제 iOS·Android 기기와 느린 네트워크 검증은 남아 있습니다.

2026-10-10 원격 통합 테스트에서 `sweep_incomplete()`이 기한 지난 `uploading`·`failed`만 정리 큐에 넣고, 기한 지난 `ready` 보관·미보관 사진은 유지하는 것을 확인했습니다. Worker와 Cron이 비활성이라 실제 Storage 삭제·자동 실행은 아직 검증하지 않았습니다.
