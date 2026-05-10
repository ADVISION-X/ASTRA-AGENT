---
name: "GrassEye Forensics Persistence Capability"
description: "Use when governing the Forensics Persistence Ability Group, append-only evidence ledger, record-envelope write authority, chain-proof persistence, artifact refs, runtime snapshot updates, and storage-port boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-forensics-persistence-capability.FINAL.instructions.md, src/capabilities/forensics-persistence/**, scripts/audit/domains/forensics-persistence-capability/**, docs/法案辅助文件/GrassEye Forensics Persistence 取证记账能力组施工图_FINAL.md"
---

# GrassEye Forensics Persistence Capability FINAL

Scope: governs append-only persistence truth, record-envelope write authority, chain-proof persistence, artifact refs, and record linkage.
Boundary: this module governs persistence only. It does not own AI reasoning, page meaning, retired chain truth, or mission branching.
Authority: this file is authoritative only for the forensics-persistence-capability domain.

Core doctrine:
- Forensics is the memory, ledger, and archive room.
- Forensics writes facts that have already been governed elsewhere.
- Forensics must preserve chain context without reviving retired map truth.
- Forensics must record AI output refs, action refs, and observation refs in a form that can be replayed and audited.

## Law GRASSEYE-FORENSICS-PERSISTENCE-CAPABILITY-001-V3

status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: every persisted record must preserve short-chain mission truth only.

### 主题

记录短链真相唯一

### 法条

Every persisted record must carry traceable chain context.

Required chain fields:
- missionId
- runId
- sessionId when applicable
- roundId when applicable
- stepId when applicable
- capabilityCallId when applicable
- promptContractId when AI record exists
- actionPlanRef or actionCodes when action record exists
- decisionRef when AI decision record exists
- artifactRefs when evidence exists
- parentRefs when linking records

Required:
- AI records must preserve promptContractId plus AI output refs.
- product lead records must preserve screenshotEvidenceRef, aiResultRef, decision, actionCodes, confidence, reason, and createdAt.
- failure records must preserve failureReason and parent refs.
- Forensics must remain append-only unless a specific record type is explicitly governed as replace-by-round/session.

Forbidden:
- retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, retired branch-token field, or retired deterministic flow planning fields as active record truth.
- Forensics reconstructing business truth from scratch.
- Forensics acting as mission flow owner.

## Law GRASSEYE-FORENSICS-PERSISTENCE-CAPABILITY-002-V3

status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: storage health and record proof must preserve durability truth without retired map fields.

### 主题

存储证明短链化

### 法条

Storage proof and record proof must preserve durability truth plus short-chain mission refs only.

Required proof fields:
- missionId when applicable
- runId when applicable
- capabilityCallId when applicable
- storageRef
- recordRef
- integrityHash
- status
- failureReason when applicable

Forbidden:
- retired binding field in record proof.
- retired selection field or retired selection version field in record proof.
- retired package field or retired package version field in record proof.
- retired branch-token field or retired deterministic flow planning as persisted proof truth.

## Final Readiness Gate

The Forensics law is ready only when records and proofs preserve mission/action/AI truth without any retired map fields.
