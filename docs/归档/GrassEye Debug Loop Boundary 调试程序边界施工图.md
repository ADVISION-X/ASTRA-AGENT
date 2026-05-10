# GrassEye Debug Loop Boundary 调试程序边界施工图

## 文件身份

- owner: debug-loop-boundary
- 原则：调试程序 = 代替人工使用 Agent；调试程序 != 第二套 Agent

## 允许

```txt
通过 Commander public contract 发任务
观察 runtime events / Forensics read model
分类失败
生成 repair packet
显式 preflight 下做 auth / environment 检查
```

## 禁止

```txt
直接执行 click / scroll / input / screenshot / AI business inference
直接解释 retired deterministic flow planning
直接写 production proof
直接写 legacy activation truth
伪造 legacy activation truth
直接 mutate mission state
```

## 正确链路

```txt
publish command through Commander
AND THEN observe governed terminal status
```

observer timeout 只能防死锁，不能在 accepted 后写成 mission failed。

## 漂移信号

```txt
debug-loop 手工生成 legacy activation truth
debug-loop 写 production proof
debug-loop 直接 dispatch action envelope
```
