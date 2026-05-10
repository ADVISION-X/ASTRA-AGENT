# GrassEye 结构化日志与运行证明施工图

## 定位

本图只描述 Forensics Persistence 之下的结构化日志字段纪律、owner evidence 和写账关系。

## 最低字段

- level: DEBUG / INFO / WARN / ERROR
- traceId
- spanId
- eventId
- eventType
- owner
- ownerResponsible
- abilityGroupId
- childAbilityId
- missionId
- sessionId
- roundId
- videoVisitId when applicable
- stepId
- promptContractId when applicable
- status
- reason
- createdAt
- durationMs
- inputRefs
- outputRefs
- evidenceRefs
- artifactRefs
- debugBundleRefs
- dataQualityFlags

## runtimeProof 最低字段

- proofId
- emittedAt
- sourceAbilityGroupId
- sourceChildCapabilityId
- capabilityCallId
- actionExecutionRef when applicable
- primitiveExecutionRef or primitiveExecutionRefs when applicable
- inputRecordRefs
- inputRefs
- outputRecordRefs
- outputRefs
- actionRef when applicable
- postActionVerificationRef when applicable
- decisionRef when applicable
- artifactRefs
- promptDebugRef when applicable
- rawResponseRef when applicable
- integrityStatus
- debugLogRef

禁止字段：

```txt
legacy activation binding
retired package-chain ids
retired branch-token fields
legacy route-plan identifiers
template-as-runtime truth
```
