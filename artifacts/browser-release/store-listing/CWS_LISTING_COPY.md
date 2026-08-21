# Chrome Web Store 草稿填写包 — GrassEye Browser Authority

状态：仅用于保存 **Draft**；不是“已投产”或“可提交审核”的结论。

商店项目 ID：`emkmbecadncngofidjgocmifhbonifgm`

## Store listing

### Title from package

无需改动，保持包内标题：

```text
GrassEye Browser Authority
```

### Summary from package

无需改动，保持包内摘要：

```text
Authenticated exact-target command endpoint for GrassEye.
```

### Description

将下面英文原样粘贴到 Description：

```text
GrassEye Browser Authority is the browser-side companion for the GrassEye local workbench. It provides a narrow command boundary for an operator-approved, exact browser target.

The extension does not accept free-form browser instructions and does not decide what to do next. A command can run only when the local GrassEye runtime has a matching active release, managed browser profile, operator authorization, and target identity. If any required proof is missing or does not match, the command is refused rather than using an alternative path.

The extension is not a general browser automation tool. It does not bypass sign-in, CAPTCHA, account security, or site controls. It does not perform payments, refunds, deletion, publication, or other sensitive final actions unless the owning GrassEye workflow has explicitly required human review.

Use requires the locally installed GrassEye workbench and its companion runtime.
```

### Category and language

| Form field | Select / enter |
| --- | --- |
| Category | `Tools` |
| Language | `English (United States)` |
| Mature content | `Off` |
| Global promo video | Leave blank |
| Official URL | `None` until an owned site has been verified in Search Console |
| Homepage URL | Leave blank until a real public product page exists |
| Support URL | Leave blank until a real public support page exists |

## Images

| CWS field | Upload file | Exact size | Status |
| --- | --- | --- | --- |
| Store icon (required) | `grasseye-store-icon-128.png` | 128 × 128 PNG | Ready |
| Screenshots (at least one required) | **Do not use a synthetic marketing image as a functional screenshot for final submission.** Capture a real activated extension journey first. | 1280 × 800 PNG/JPEG | Blocked on real Chrome proof |
| Small promo tile (optional) | `grasseye-small-promo-tile-440x280.png` | 440 × 280 PNG | Ready |
| Marketing reference only | `grasseye-listing-visual-1280x800.png` | 1280 × 800 PNG | Not a functional screenshot |

`grasseye-listing-visual-1280x800.png` is an original abstract product visual. It deliberately contains no external site, no fake browser UI, and no claim that a website task has completed. It may be used as a design reference or optional marketing material, but must not replace a real extension screenshot when submitting the listing for review.

## Privacy tab: source-grounded draft answers

The replacement extension package (`0.1.1`) declares only `nativeMessaging` and `debugger`. Its extension-side transport uses `chrome.runtime.connectNative()` to a **local** companion host and contains no extension-side HTTP, WebSocket, cookie, or cloud-upload code. Upload the replacement package before using these answers; the old uploaded package can still trigger `tabs` and `scripting` questions.

For the Privacy tab, disclose the actual use of browser-page information conservatively:

```text
The extension may process the current, operator-claimed tab URL and browser-page content needed to carry out an allowed GrassEye command. This information is passed only to the locally installed GrassEye companion runtime on the same device for the requested function. The extension does not include advertising, sale of user data, or an extension-side remote analytics transport.
```

Because the extension can handle selected-tab URLs and website content, a public, accurate privacy-policy URL is a required final-submission item. Do not claim a no-retention period or server-side practice until the public policy and the actual local-host retention behavior have both been verified.

## Submission blockers — resolve before clicking “Submit for review”

1. **Actual CWS public key:** in the CWS **Package** page, copy the Public key after the first draft upload. We must put that exact key into `src/lib/browser/chrome-extension/manifest.json`, rebuild, and upload a replacement ZIP. The CWS item ID above is the only production ID; do not use a calculated development ID.
2. **Real screenshot:** install the CWS draft in the approved managed profile, activate it, claim a real operator target, and capture the resulting extension/workbench journey. This needs to be a real Chrome proof, not a mockup.
3. **Functional proof:** prove the native companion host handshake and an allowed command against the same installed CWS extension. Until then, the extension is a draft package, not production-ready.
4. **Privacy disclosure:** complete it against the final retention and data-flow behavior; publish and enter a working public privacy-policy URL before final submission.

## Exact manual sequence now

1. On **Store listing**, paste the Description, keep category `Tools`, keep language `English (United States)`, upload the 128×128 store icon, then click **Save draft**.
2. Upload the replacement package `grasseye-browser-extension-cws-upload-v0.1.1.zip` on **Package**, then click **Save draft** and reopen the CWS error list. Only then can CWS re-read the two-permission manifest.
3. Do not submit yet. Use the Privacy-practices draft in this folder to complete the remaining truthful draft fields.
4. After the replacement upload and real Chrome proof, use the real screenshot and finish Privacy / Distribution / Test instructions.

## Asset provenance

The three upload-ready artwork files and the source-size icon original in this folder were generated as original, no-text product artwork on 2026-08-21, then resized without changing their visual meaning. They contain no third-party logo or external-site screenshot.
