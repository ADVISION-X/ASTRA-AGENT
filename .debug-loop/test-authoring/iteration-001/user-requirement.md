# User Requirement

- scenarioId: facebook-safe-comment-draft-product-video
- platformId: facebook-web
- goal: 请在 Facebook 视频流中寻找疑似种草产品视频。如果不是产品视频：生成 commentDraft，内容为 https://www.apexprotocol.ae/?utm_source=share&utm_medium=copy&utm_campaign=home&utm_content=home；可打开评论区、定位评论框、准备草稿输入动作；不允许自动点击提交/发布；必须进入 human review。如果是疑似产品视频：采集截图、视频帧、点赞/评论等可见证据并创建 evidence packet。如果置信度不足：暂停并进入 human review。

## Raw Requirement
请在 Facebook 视频流中寻找疑似种草产品视频。如果不是产品视频，对当前视频发布一条评论：https://www.apexprotocol.ae/?utm_source=share&utm_medium=copy&utm_campaign=home&utm_content=home 然后滚动到下一条。如果是疑似产品视频，采集截图、视频帧、点赞/评论等可见证据。如果置信度不足，暂停给用户确认。不做点赞、不私信、不购买。

## Safe Executable Requirement
请在 Facebook 视频流中寻找疑似种草产品视频。如果不是产品视频：生成 commentDraft，内容为 https://www.apexprotocol.ae/?utm_source=share&utm_medium=copy&utm_campaign=home&utm_content=home；可打开评论区、定位评论框、准备草稿输入动作；不允许自动点击提交/发布；必须进入 human review。如果是疑似产品视频：采集截图、视频帧、点赞/评论等可见证据并创建 evidence packet。如果置信度不足：暂停并进入 human review。

## Red Lines
- 禁止自动发布评论
- 禁止自动点赞
- 禁止自动私信
- 禁止自动购买
- 禁止绕过 human approval
- 禁止把 commentDraft 视为 commentPublished