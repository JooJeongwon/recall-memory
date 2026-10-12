# 기억할 권리

## 2026-10-13 운영 호환성 검증

`feat/frontend-seeun`의 Next.js 구성을 기존 Vercel `recall-memory` 프로젝트에서 유지한다. 이미 적용된 `note_retention_checkpoints`에 맞춰 첫 메모와 두 번째 메모를 분리하고, `first_note_at`으로 저장 단계를 선택한다. 보관 완료는 서버의 `preserved_at` 응답으로만 표시한다. 보관함·상세 수정에서 두 번째 메모를 읽고 저장하며, 개별·전체 ZIP의 `memory.json`에는 기존 `note_text`와 함께 `first_note_at`, `second_note_text`, `second_note_at`을 포함한다.

검증: `npm run lint`, `npm run typecheck`, `npm test`(10개), `npm run build` 통과. `npx playwright test --config playwright.checkpoints.config.ts`는 운영 빌드와 실제 Supabase의 격리된 합성 계정·사진으로 첫 메모 저장→새로고침→두 번째 메모→보관함 수정→개별·전체 ZIP의 원본 바이트/두 메모 확인→동시 수정 충돌과 초안 유지·재시도→빈 메모 수정 후 보관 시각 유지를 통과했다. 생성한 테스트 데이터는 정리했다. 기존 보관 사진 3장의 전체 행과 원본·썸네일 6개의 SHA-256 비교가 일치했다.

이 작업은 DB 스키마, migration, 환경변수, 기존 데이터를 변경하지 않는다. 아래 초기 문서의 첫 메모 즉시 보관 설명보다 두 단계 운영 계약이 우선한다. 기존 통합·E2E 전체 묶음은 초기 UI·보존 정책을 전제로 하므로 이번 작업의 완료 근거로 사용하지 않는다. 실제 24/48시간 대기나 이메일 OTP 로그인은 이번 테스트 범위에 포함하지 않았다. 운영 URL: https://recall-memory-smoky.vercel.app/.

테스트의 `CHECKPOINT_BASE_URL`은 배포 후 동일 흐름 검증에 사용할 수 있다. 반드시 해당 배포와 동일한 Supabase 연결을 사용하며, 테스트는 생성한 `checkpoint-*` 계정의 데이터만 수정·정리한다.

사진을 다시 보고 한 줄 메모와 함께 보관하는 모바일 웹앱입니다. 정책은 [PROJECT.md](PROJECT.md), API·DB 계약은 [ARCHITECTURE.md](ARCHITECTURE.md), 검증 상태는 [ROADMAP.md](ROADMAP.md)를 기준으로 합니다.

## 현재 상태

2026년 10월 8일 후속 작업에서 의존성 설치·`package-lock.json` 생성·`npm ci`·lint·전체 typecheck·운영 빌드·단위 테스트 8개·E2E 2개가 통과했습니다. 모바일 E2E는 빈 목록·재시도, HEIC·10 MiB 초과 사전 거절, 위장 MIME·손상·픽셀 초과 이미지의 서버 거절과 목록 제외, EXIF 방향 보정 및 메타데이터 없는 WebP 썸네일, Storage 업로드 실패 후 재시도, 두 사진 탐색, 메모 충돌 시 초안 유지·재저장, 일시 저장 실패 후 입력 보존·재시도, 보관·메모 비우기·만료 후 ZIP 원본 검증, 무효화된 서명 URL 실패 후 재시도, 분석 동의·철회와 이벤트 정리, 보관 사진·계정 삭제 요청과 진행 상태 UI를 확인했습니다. 원격 통합 테스트는 두 사용자 권한 분리, 업로드 요청 중복·20장 한도, 최초 실험 시각, 메모 500/501자 경계, 실험 내·외 최초 메모 시각과 만료 경계, 합성 사진 삭제 큐 중복 방지·Storage API 제거·DB 완료 처리·실패 후 새 lease 재시도를 통과했습니다. 원격 프로젝트의 실제 스키마에서 DB 타입을 생성하고 Supabase 클라이언트에 연결했습니다. Edge Function `maintenance`는 개발 프로젝트에 배포하고 인증 없는 호출이 401로 거절됨을 확인했지만, 호출 secret과 Cron을 구성하지 않아 자동 삭제와 계정 전체 제거는 동작하지 않습니다.

사용자의 지시에 따라 **DB는 원격 Supabase 전용 개발 프로젝트를 사용합니다.** [recall-memory 프로젝트](https://supabase.com/dashboard/project/mgedpimvznbatmipaacn)는 `JooJeongwon` 조직·서울 지역에 생성했습니다. 생성 시 조회한 비용은 월 $0입니다. 5개 테이블·서버 전용 함수·RLS·최소 GRANT·비공개 `memory-assets` 버킷을 적용하고 원격 SQL·익명 HTTP 접근 차단을 확인했습니다. 보안 advisor의 경고·오류는 0건입니다. `events`·`cleanup_jobs`의 정책 없음 INFO는 일반 사용자 접근을 전부 막는 설계에 따른 결과입니다. [RLS advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)을 참고합니다.

`.env.local`에 개발 프로젝트의 ID·URL·공개 키·서버 키를 설정했습니다. 서버 키는 브라우저 정적 번들에 포함되지 않는 것을 확인했습니다. 원격 통합 검증에서 서로 다른 두 계정의 Auth 세션·프로필 분리·직접 변경 차단·서버 전용 RPC 차단이 통과했습니다. 만료 fixture로 신규 예약과 만료 후 확정을 거절하고 기존 사진의 메모·원본 접근을 확인했습니다. E2E 테스트는 메일을 보내지 않고 합성 계정 세션을 주입합니다. 실제 이메일 로그인과 실제 48시간 경과 후 재접속은 아직 확인하지 않았습니다. 로컬 DB는 중지했습니다.

참여자 로그인을 시험하기 전에 Supabase 대시보드의 [Auth URL 설정](https://supabase.com/dashboard/project/mgedpimvznbatmipaacn/auth/url-configuration)에서 Site URL을 `http://localhost:3000`으로 설정하고 허용 redirect URL에 `http://localhost:3000/auth/confirm`, `http://127.0.0.1:3000/auth/confirm`을 추가해야 합니다. 조직은 Free 플랜입니다. 2026-06-03 이후 생성된 Free 프로젝트는 기본 SMTP를 쓰면 인증 메일 템플릿을 수정할 수 없으므로, 숫자 OTP를 메일 기본 흐름으로 쓰려면 자체 SMTP 설정이 필요합니다 ([Supabase 안내](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)). 앱은 숫자 코드 입력과 메일 로그인 링크 callback을 모두 지원하지만 실제 메일 로그인은 아직 확인하지 않았습니다. 대시보드 설정 도구도 현재 연결되어 있지 않습니다.

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

Supabase Auth의 Site URL과 허용 redirect URL을 앱 주소와 `/auth/confirm` 경로에 맞춥니다. [supabase/templates/otp.html](supabase/templates/otp.html)은 숫자 OTP 템플릿 예시입니다. 현재 조직은 Free 플랜이고 기본 SMTP를 사용하는 새 프로젝트에서는 이 템플릿을 원격에 적용할 수 없습니다. 숫자 OTP를 유지하려면 자체 SMTP를 설정해야 합니다. Auth URL 설정과 실제 로그인 메일은 별도로 확인합니다.

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

[supabase/functions/maintenance](supabase/functions/maintenance/index.ts)은 개발 프로젝트에 배포했으며 인증 없는 POST가 `401`을 반환합니다. Supabase는 함수 런타임에 `SUPABASE_URL`과 `SUPABASE_SECRET_KEYS`를 제공하므로 별도 서버 키를 함수 secret으로 복사하지 않습니다 ([환경변수 문서](https://supabase.com/docs/guides/functions/secrets)). 실제 작업을 켜려면 [Edge Function Secrets](https://supabase.com/dashboard/project/mgedpimvznbatmipaacn/functions/secrets)에 `MAINTENANCE_CALL_SECRET`을 설정하고, 같은 비밀을 Vault의 `recall_maintenance_secret`에, 프로젝트 URL을 `recall_project_url`에 저장한 다음 [supabase/cron.sql](supabase/cron.sql)을 적용해야 합니다. `MAINTENANCE_CALL_SECRET`은 Supabase API 키와 별개인 내부 Cron 인증 비밀입니다. 지금은 Cron을 등록하지 않아 삭제 요청이 대기 상태에 머뭅니다.

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

현재 E2E는 빈 목록·요청 재시도, HEIC·10 MiB 초과 사전 거절, Storage 전송 실패 후 같은 파일 재시도와 두 사진 탐색, 합성 Auth 세션의 보관·ZIP 흐름을 통과했습니다. 설정에서 분석 동의를 켜면 행동 이벤트가 기록되고, 철회하면 기존 이벤트를 지우며 이후 이벤트를 저장하지 않는 것도 확인했습니다. 보관 사진 삭제는 요청 접수 후 사진을 숨기고 “삭제 진행 중”으로 표시하며, 계정 삭제는 진행 토큰으로 대기 상태를 확인합니다. 원격 통합 테스트에서 별도의 합성 보관 사진 삭제 요청 중복 방지, 작업 claim, Supabase Storage API 파일 제거, 완료 RPC와 개인정보 정리를 확인했습니다. 실패 코드의 재시도 대기·기존 lease 거절·새 lease 재claim도 DB fixture에서 통과했지만, 실제 Storage 장애부터 worker가 재시도하는 흐름은 검증하지 않았습니다. 개발 프로젝트의 `maintenance` 함수는 배포했고 인증 없는 POST가 401로 거절되는 것을 확인했지만 Cron은 등록하지 않아 자동 삭제와 계정 전체 정리는 아직 동작하지 않습니다. 서버가 MIME 위장 JPEG·손상 PNG·픽셀 초과 PNG를 거절하고 다시 보기 목록에서 숨기는 것, EXIF 방향 6 원본에서 방향을 바로잡고 EXIF가 없는 WebP 썸네일을 생성하는 것도 원격 E2E에서 확인했습니다. 메모 동시 수정에서는 서버의 최신 내용을 표시하면서 사용자 초안을 유지하고 재저장하며, 일시 저장 실패에서는 입력과 기존 DB 내용을 유지한 뒤 재시도하는 흐름을 확인했습니다. 내보내기에서는 무효화한 서명 URL의 실패 안내와 재시도 후 새 URL로 ZIP을 받는 동작을 확인했습니다. 원격 통합 테스트는 실험 중·종료 후 첫 메모의 서버 시각 구분과 기존 최초 시각 유지도 확인했습니다. 단위 검증은 실제 40,008,000픽셀 이미지와 10 MiB 초과 바이트를 이미지 검증 함수에서 거절했습니다. 메모는 원격 DB에서 최초 공백 저장 거절, 500자 저장과 501자 거절을 확인했습니다. 실제 이메일 로그인, 로그아웃 후 재로그인, 실제 48시간 경과, 자동 삭제 처리, 계정 전체 정리/Auth 계정 제거, 기존 DB 업그레이드는 추가 검증이 필요합니다. P1 전체 완료와 MVP 완료는 표시하지 않았습니다.
