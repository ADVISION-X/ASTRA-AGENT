# GrassEye AI 投喂能立组施工图 V1

版本：2026-05-21  
状态：active

## 1. 当前定位

AI Input Gateway 只负责一件事：

```txt
把有限选项问题投递给外部 provider，拿回结构化 choice 结果。
```

它不是 AI 大脑，不是流程拥有者，不是浏览器控制器。

## 2. 标准问题包

```ts
type AiChoiceQuestion = {
  questionId: string;
  taskContext: string;
  facts: Record<string, unknown>;
  options: Array<{
    id: "A" | "B" | "C" | "D";
    label: string;
    meaning: string;
  }>;
  requiredOutput: {
    selectedOptionId: "A" | "B" | "C" | "D";
    confidence: number;
    reason: string;
  };
};
```

## 3. 返回格式

只允许：

- `selectedOptionId`
- `confidence`
- `reason`

## 4. 调用链

```txt
flow script
  -> AI choice surface
      -> AI input gateway
          -> provider adapter
```

## 5. 需要记录的证明

- provider kind
- prompt identity
- parse status
- raw output ref
- schema validation result

## 6. 明确禁止

- `nextAction`
- action plan
- 浏览器命令
- DOM selector
- 坐标
- 文件路径
- 自动生成业务数据
- 付款、退款、删除、提交等敏感最终动作判断

## 7. 当前主线中的角色

在 Amazon 主线里，AI 只用于有限状态判断或人工接管判定。  
如果 DOM 与显式规则已足够，主线可以完全不调用 AI。