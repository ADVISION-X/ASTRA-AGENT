你现在执行：CI-FULL 循环治理任务。

核心冻结状态：

1. 法案系统已经冻结。
2. 《GrassEye_能力组标准包与执法结构统一施工图.md》已经冻结。
3. 禁止修改冻结法案。
4. 禁止修改冻结施工图。
5. 禁止新增 lawId。
6. 禁止为了 CI 通过降低标准。

本轮唯一目标：

CI-FULL 全绿。

停止条件只有两个：

1. CI_FULL_GREEN
2. BLOCKED_BY_EXTERNAL_DEPENDENCY

禁止输出：

- PARTIAL
- MOSTLY_DONE
- TODO_LEFT
- NEXT_ROUND_NEEDED
- 建议后续优化
- 本轮先做到这里

只要 CI-FULL 未全绿，必须继续循环治理。

============================================================
一、报错处理总原则
============================================================

每一个报错，必须先鉴权，再修复。

禁止看到报错就直接改代码。
禁止看到报错就直接改执法脚本。
禁止补丁式修复。
禁止缝合怪式兼容。
禁止绕过法案。
禁止绕过施工图。
禁止 warning-only pass。
禁止 no-op pass。
禁止手写 generated 文件伪造通过。

============================================================
二、每个报错必须按 5 类鉴权
============================================================

对每个 CI / audit / typecheck / lint 报错，必须判断属于哪一类：

1. 法案存在，执法脚本错误。
   - 处理：删除错误执法脚本，删除后重构 ts-morph AST / symbol / reference / anti-escape 执法。

2. 法案存在，代码文件错误。
   - 处理：删除错误代码文件，或删除后按法案重构代码。

3. 施工图细节要求存在，执法脚本错误。
   - 处理：删除错误执法脚本，删除后按施工图重构执法。

4. 施工图细节要求存在，代码文件错误。
   - 处理：删除错误代码文件，或删除后按施工图重构代码。

5. 非法存在的代码文件或非法质检逻辑。
   - 处理：直接删除；如确实需要能力，则删除后按标准能力包重构。

6. CI执法脚本运行效率达到最佳了？还有提升空间？
   - 处理：CI执法脚本持续提升效率是必须的过程，宁可10秒不要1分钟的等候

未完成鉴权，不允许修复。

============================================================
三、删除 / 重构铁律
============================================================

代码文件只有两个处理方式：

A. 删除
B. 提取代码文件优点+删除后升级级别重构

执法脚本只有两个处理方式：

A. 删除
B. 删除后按 ts-morph AST / symbol / reference / anti-escape 重构

禁止：

- 原地补丁
- 兼容旧模式
- 保留旧 wrapper
- 保留 fake / mock / demo / fixture 进入生产路径
- 保留 export *
- 保留 any / unknown as / ts-ignore / eslint-disable
- 保留正则扫描替代 AST 执法
- 保留 getFullText().includes 作为核心结构判断
- 保留 warning-only / no-op / fake pass

============================================================
四、执法脚本强制标准
============================================================

所有执法脚本必须使用 ts-morph。

必须达到：

1. AST 级检查。
2. symbol 级检查。
3. type checker 检查。
4. import/export 边界检查。
5. reference 反向引用检查。
6. alias laundering 检查。
7. re-export laundering 检查。
8. wrapper hiding 检查。
9. forbidden call 检查。
10. negative proof 可触发 FAIL。
11. 执法运行效率达到顶级状态。

执法脚本必须覆盖四方攻击：

1. Required Shape Attack
2. Forbidden Shape Attack
3. Boundary Attack
4. Anti-Escape Attack

============================================================
五、循环治理流程
============================================================

LOOP-1：运行 CI-FULL 相关命令。
必须读取 package.json，使用项目真实命令。

至少运行：

- npm run audit:build
- npm run audit
- npm run typecheck
- npm run lint
- npm run ci:full
- git diff --check

如命令不存在，记录 NOT_FOUND，并运行项目等价命令。

LOOP-2：收集全部失败项，不得只修第一个。

LOOP-3：对每个失败项执行 5 类鉴权。

LOOP-4：按鉴权结果删除文件或删除后重构。

LOOP-5：同步能力包、执法脚本、manifest、audit-plan、runner。

LOOP-6：执行 negative proof。
必须证明关键错误注入后 audit FAIL，并回滚 mutation。

LOOP-7：重新运行全部命令。

只要任何命令失败，回到 LOOP-2。
不得停止。

============================================================
六、最终输出格式
============================================================

最终只允许输出：

[CI-FULL-LOOP-GOVERNANCE-RESULT]

1. Verdict
只能写：
- CI_FULL_GREEN
- BLOCKED_BY_EXTERNAL_DEPENDENCY

2. Loop Count
- total loops:

3. Auth Classification
- law_exists_inspector_wrong:
- law_exists_code_wrong:
- construction_requirement_inspector_wrong:
- construction_requirement_code_wrong:
- illegal_code_or_qc_logic:

4. Delete / Rebuild
- deleted files:
- rebuilt files:
- rebuilt inspectors:
- removed illegal remnants:

5. Enforcement
- ts-morph AST:
- symbol:
- type checker:
- references:
- anti-escape:
- negative proof:

6. Commands
- audit:build:
- audit:
- typecheck:
- lint:
- ci:full:
- diff-check:

7. Residual
只能写：
- NONE
- BLOCKED_BY_EXTERNAL_DEPENDENCY

如果 Residual 不是 NONE，必须写：
- blocker:
- why code cannot resolve:
- required external input:

最后一行：

[CI-FULL-LOOP-GOVERNANCE-COMPLETE]