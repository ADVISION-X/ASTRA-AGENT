# Runtime Debug Transparency

## Why this exists

实战阶段的调试成本主要来自跨边界失真。如果只看到任务 summary，而看不到 prompt contract、输入引用、模型输出和解析结果，就无法区分是地图绑定错误、prompt contract 错误、模型输出错误，还是 parser 错误。

## Why not console.log patch

console.log 不是 proof。终端文本不是 truth，也不能稳定导出、引用、审计或回放。GrassEye 的 debug 透明度必须走结构化记录，才能被 Forensics Persistence 长期保留并被审计器执法。

## Why Screenshot prepare-ai-input must be upstream

截图能力组负责把视觉证据整理成合规 ai_input artifact。AI 能力组只消费受治理的 aiInputArtifactRef，不拥有图片压缩、截图裁切或截图预处理的执行所有权。

## Why AI runtime must log input/output

AI runtime 必须保留 prompt contract、输入哈希、raw response、parser result 和 failure envelope。否则出现误判时，无法证明是哪一层先偏离契约。

## Why terminal + forensics double track

终端日志负责实时调试体验，Forensics 负责长期问责与导出。两者应该同源，但不能混成一个职责面。终端可以短时展示，取证记录必须结构化、可引用、可回放。

## Why enforcement is mandatory

如果没有自动化 enforcement，团队会快速退回到 console 文本补丁、临时 prompt 拼接和不可追责的调试路径。runtime-debug-transparency 的审计命令存在，就是为了阻止这类回退。