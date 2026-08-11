# iOS P Status

Updated: 2026-08-11

This file separates implementation status from checks that require macOS, Apple credentials, a deployed API, or a real device.

## P0

- [x] Local SwiftData user isolation code and multi-user tests added.
- [x] Logout scope reset and authenticated root view reset added.
- [x] Debug/Staging/Release environment model and fail-closed validation added.
- [x] XcodeGen archive and ExportOptions templates added.
- [x] Release archive metadata validation added to CI.
- [x] Question-bank filtering, typed answering, submission, result parsing, wrong-question entry, stats, and learning-event writes implemented.
- [ ] Real staging and production API URLs supplied through CI secrets.
- [ ] Apple Team, signing certificates, provisioning, TestFlight upload, and real-device acceptance.

## P1

- [x] Camera and photo-library image entry for Upload and Chat.
- [x] Shared image compression, dimension validation, and retry handling.
- [x] Profile, plan, grading history, learner profile, and rich Chat history sync.
- [x] Image analysis follow-up, result detail, retry practice, and wrong-question actions.
- [x] API mock tests, SwiftData isolation tests, ViewModel tests, and iOS UI smoke-test target added.
- [ ] macOS Xcode build, simulator execution, and deployed API smoke validation.

## P2

- [x] Plan task completion, skip, restore, and progress display.
- [x] Stats trend, mastery, and ability sections.
- [x] Wrong-question detail, search, subject filter, manual add, and favorite toggle.
- [x] Shared loading/error/empty handling plus a global offline banner.
- [x] Geometry solid, conic, and relation drawers.
- [x] Molecular contract, prompt, post-analysis attach, iOS renderer, schema tests, and dedicated eval samples/scoring.
- [ ] V3 knowledge-graph learning intelligence.

Implementation count: P0 8/12, P1 25/26, P2 9/10. The remaining P0/P1 items require deployed staging/production services, macOS/Xcode, Apple signing, a real device, or TestFlight.

## Verification

- Core TypeScript check: passed.
- Web TypeScript check: passed.
- Core Vitest: passed, 171 tests passed and 15 skipped; external-key evals are skipped when no key is configured.
- visual-ast Node tests: passed, 32 tests passed.
- visual-ast TypeScript check: passed.
- `git diff --check`: passed after the latest documentation changes.
- Native iOS build, simulator/UI execution, staging API, migrations, signing, and TestFlight: require macOS/Apple environment.
