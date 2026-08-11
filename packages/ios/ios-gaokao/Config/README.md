# iOS API build settings

The app has three configurations:

- `Debug`: `development`, currently using the local development placeholder.
- `Staging`: `staging`, requires `AISTUDY_API_BASE_URL_STAGING`.
- `Release`: `production`, requires `AISTUDY_API_BASE_URL_PRODUCTION` and
  `AISTUDY_DEVELOPMENT_TEAM`.

Provide the staging and production URLs through Xcode User-Defined Settings,
CI secrets, or `xcodebuild` overrides. Do not commit these values to the
repository, and do not leave a signed build with an unresolved setting.

Before a Staging build or Release archive, run the repository check:

```bash
bash Config/validate-build-settings.sh staging --require-team
bash Config/validate-build-settings.sh production --require-team
```

The check rejects missing values, non-HTTPS URLs, unresolved build variables,
and known placeholder hosts. The CI archive also inspects the generated app
`Info.plist` to verify that it contains `production` and the injected URL.

Example:

```bash
export AISTUDY_API_BASE_URL_STAGING
export AISTUDY_DEVELOPMENT_TEAM

xcodebuild \
  -project ios-gaokao.xcodeproj \
  -scheme ios-gaokao \
  -configuration Staging \
  AISTUDY_API_BASE_URL_STAGING="$AISTUDY_API_BASE_URL_STAGING" \
  AISTUDY_DEVELOPMENT_TEAM="$AISTUDY_DEVELOPMENT_TEAM" \
  build
```

Release archive and App Store Connect export:

```bash
export AISTUDY_API_BASE_URL_PRODUCTION
export AISTUDY_DEVELOPMENT_TEAM
export APPLE_TEAM_ID
export APP_STORE_CONNECT_API_KEY_ID
export APP_STORE_CONNECT_API_ISSUER_ID

xcodebuild \
  -project ios-gaokao.xcodeproj \
  -scheme ios-gaokao \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath build/ios-gaokao.xcarchive \
  AISTUDY_API_BASE_URL_PRODUCTION="$AISTUDY_API_BASE_URL_PRODUCTION" \
  AISTUDY_DEVELOPMENT_TEAM="$AISTUDY_DEVELOPMENT_TEAM" \
  archive

xcodebuild \
  -exportArchive \
  -archivePath build/ios-gaokao.xcarchive \
  -exportOptionsPlist Config/ExportOptions-AppStoreConnect.plist \
  -exportPath build/export

xcrun iTMSTransporter \
  -m upload \
  -assetFile build/export/AI高中助手.ipa \
  -apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
  -apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID"
```

`ExportOptions-AppStoreConnect.plist.example` 只提供字段结构。正式导出前
请复制为 `ExportOptions-AppStoreConnect.plist`，并由本机或 CI 注入真实
`APPLE_TEAM_ID`；真实凭据和部署地址不进入仓库。
