# CWS Privacy practices — GrassEye Browser Authority

状态：填写并 **Save draft** 用；在真实 Chrome 端到端证明、公开隐私政策、CWS replacement ZIP 都完成前，禁止 `Submit for review`。

这不是公开隐私政策，也不应上传到 CWS。它是 Privacy practices 页面每一项的填写底稿。

## 1. Single purpose description

粘贴：

```text
Provide a user-initiated, exact-target browser command boundary for the locally installed GrassEye workbench. The extension acts only on one operator-selected tab and only for registered, authorized commands from the local companion runtime.
```

## 2. Permission justifications

### debugger

```text
Used only after the operator explicitly selects a browser tab with the extension action. It attaches to that one claimed tab to execute the extension's pre-registered, permit-validated exact-target commands and to verify the target/document state. It is not used to inspect all tabs, collect browsing history, or run free-form commands.
```

### nativeMessaging

```text
Used to exchange authenticated command permits and command results with the locally installed GrassEye companion host on the same device. The extension has no extension-side HTTP, WebSocket, advertising, or third-party analytics transport.
```

### remote code use

Select:

```text
No, I am not using remote code.
```

Reason: all MV3 service-worker code is packaged in the submitted ZIP. The use of `chrome.debugger` does not fetch, load, or execute remotely hosted JavaScript.

## 3. Data use disclosure

The extension can handle browser-page data on the one tab the operator claims. In the Privacy tab, disclose conservatively:

| Privacy field | Select / enter | Reason |
| --- | --- | --- |
| Website content | Select | Registered inspect/read/fill/click commands can read or change content on the user-selected page. |
| Web history / browsing activity | Select if the page presents this option | The target URL and document identity are necessary to bind the selected tab. |
| All other listed data categories | Do not select unless the final implementation actually collects them | The extension must not claim collection it does not perform. |
| Purpose | App functionality | Only to provide the disclosed exact-target command function. |
| Sale / advertising / creditworthiness | Do not select / certify as not used | The extension has no such feature. |

For any free-text disclosure, paste:

```text
The extension processes the operator-claimed tab URL and only the page information required for an authorized exact-target command. This information is used locally by the GrassEye companion runtime to provide the requested function. It is not sold, used for advertising, or sent to third-party analytics services.
```

## 4. Certification and public privacy policy

Do **not** tick the final certification until all three facts are true:

1. the CWS package is version `0.1.1` and contains only `debugger` and `nativeMessaging` permissions;
2. a public HTTPS privacy-policy page accurately states collection, local use, retention/deletion, security, and no-sale/no-advertising practice;
3. the same candidate has passed the real Chrome activation and command proof.

When those facts are true, enter the public privacy-policy URL in the dedicated Privacy-policy field and complete the CWS data-use certification. CWS requires privacy disclosures to match the listing, policy, and actual behavior.

## 5. Items outside the extension code

| CWS blocker | Owner / action |
| --- | --- |
| Contact email missing | Publisher: add a contact email on CWS **Settings**. |
| Contact email unverified | Publisher: complete Google’s verification email from CWS **Settings**. |
| Screenshot/video not recognized | Upload the real 1280×800 or 640×400 current-extension screenshot, then click **Save draft**. A form upload that has not been saved is not counted. |
| Description not recognized | Paste the listing Description and click **Save draft**. |
| `tabs` and `scripting` justifications | Removed from source manifest in version `0.1.1`; rebuild and upload the replacement ZIP before CWS can stop asking for them. |

## 6. Current candidate evidence

Source manifest now requests only:

```json
["nativeMessaging", "debugger"]
```

Source inspection found no `chrome.tabs` or `chrome.scripting` call in the extension implementation. This is a static finding only; it is not real Chrome activation proof or CWS publication approval.
