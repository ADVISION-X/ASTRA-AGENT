# GrassEye Nerve Bus 神经网络传输能力组施工图

## 1. 定位

Nerve Bus 是命令和结果的传输层。
它像神经网络，连接总指挥、能力组、AI。

## 2. 四条传输链

- Orchestration -> Ability Group
- Ability Group -> Orchestration
- Orchestration -> AI Ability Group
- AI Ability Group -> Orchestration

Page State 结果属于 Ability Group -> Orchestration 受治理结果的一种。

## 3. Nerve Bus 职责

- 包装 CommandEnvelope
- 验证 target ability group
- 验证 input contract
- 发送命令
- 接收结果
- 写 transfer proof
- 返回给总指挥

## 4. Nerve Bus 禁止职责

- 不选择作战地图
- 不判断下一步
- 不调用子能力
- 不做 AI 判断
- 不做平台动作
- 不吞错

## 5. Envelope 定义

- CommandEnvelope
- ResultEnvelope
- AiRequestEnvelope
- AiResponseEnvelope

## 6. 传输证明字段

- envelopeId
- missionId
- mapId
- stepId
- from
- to
- payloadRef
- startedAt
- endedAt
- durationMs
- status
- failureReason

## 7. 当前 canonical root

- src/capabilities/nerve-bus/
- src/capabilities/nerve-bus/channels/orchestration-to-ability/
- src/capabilities/nerve-bus/channels/ability-to-orchestration/
- src/capabilities/nerve-bus/channels/orchestration-to-ai/
- src/capabilities/nerve-bus/channels/ai-to-orchestration/