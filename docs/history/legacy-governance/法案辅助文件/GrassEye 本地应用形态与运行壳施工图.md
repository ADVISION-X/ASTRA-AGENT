# GrassEye 本地应用形态与运行壳终态施工图

status: active
version: 2026-08-21.terminal

## 本地形态

GrassEye 是本地 HTTP workbench：health/mode -> known job list -> structured input -> durable task/result/evidence refs -> redacted activity display。不是 SaaS、营销站、通用 planner 或浏览器控制台。

页面只能显示 Browser Authority ABSENT/PRESENT、release identity readback、failure reason 和 evidence ref；不得保存/生成 target、command、permit、selector、raw frame 或业务步骤。

## Browser 连接边界

root Workbench 页面不建立 extension Port、CWS channel、page relay、polling 或 SSE。唯一 Browser 通信是既有 App Server 在 /browser-authority/v1 接受 WebSocket upgrade，之后由 Browser Authority owner 管理；页面不直接接触 socket actor、Chrome 或 command。

## 对口质检

local-app-shell inspector 必须证明唯一 listener/upgrade、known job input、durable result display、无 universal planner/no second dashboard，以及旧 extension-channel client/routes/CWS Port/polling/SSE 归零。真实 Chrome 只证明页面 readback，不冒充 Browser 或业务 proof。
