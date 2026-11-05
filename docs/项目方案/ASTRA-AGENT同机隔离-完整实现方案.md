# ASTRA-AGENT 同机隔离完整实现方案

状态：设计中。本文是本事项唯一方案，替换此前边施工边改变的设计；此前“可施工”结论撤销。本轮只进行方案建设与只读取证，不继续代码、法案、配置、数据库或浏览器操作。主AI三轮自审与独立只读审计完成后冻结；冻结不等于施工、注册、运行或发布授权。

## 1. 需求与唯一来源

需求Owner、方案所在仓为 `/Users/nexgen/Documents/ASTRA-AGENT`（A）；网站为 `/Users/nexgen/Documents/AI Paper Factory`（W）。成熟参照为 `/Users/nexgen/Documents/AGENT`（G）与 `/Users/nexgen/Documents/xuanxue-web`（X）。四仓realpath、main、origin/main、当前HEAD与dirty/untracked已在任务上下文只读绑定，HEAD不写入任务文件，不另建候选回执。

四份唯一业务来源均在W的 `docs/governance/`，本轮已逐份全文回读：`ASTRA-01-用户与前端价值蓝图.md`、`ASTRA-02-研究生产与资产交付蓝图.md`、`ASTRA-03-Skill与AGENT运行拓扑蓝图.md`、`顶级论文蓝图_AI-Paper-Factory_v1.0.md`。它们决定业务目标及最终解释；前三份业务内容v0.4、顶级论文v1.0不由工程方案改写。蓝图、工程实现与质量证据分别判断；法案不吻合时先列GAP、取得对应规范授权，不能静默改法。

四项终点：W、A分别沿X、G对应启动职责运行；端口隔离；A数据库及全部执行状态独立；W—A几乎1:1沿成熟V6链完成任务接收、完整结果接收与网站业务消费读回。端口通、session成功、本地completed不等于业务接纳。

本任务负责A隔离与两仓接缝方案。W的数据库连接、角色、schema、迁移、备份及操作全部由网站现有Codex负责，本任务不代建、不代改、不连接；网站服务配置及运行也只列精确交接。G/X只读，不修改、启停、注册设备或清任务。沿用当前Chrome及现有GPT登录，不使用干净浏览器、新profile、新实例，不复制登录资料。

`ASTRA-AGENT迭代-完整实现方案.md`继续拥有S00/C01/S01—S10、Product、Flow、Prompt、Work与结果实现；本文只消费其合格交接，不并发写这些代码，不改该方案。其CI-FULL要求不自动扩成本任务CI-FULL。本轮没有提交、推送、READY、RELEASE、部署或开放收费授权。

## 2. 源头与法案的符合性

已回读两仓同身份冻结母本的§0、4、7—9、12、19—25、35—47、48—63、65—68、78—85。A两份法案39条、13个domain，W11条、2个domain，当前lawId与Manifest、registry集合相等；这只是只读集合比较，不是原生质量或内容执法通过。W基础法案为空不自行认定缺陷：母本§66没有固定根law数量要求。

| 来源义务 | 现役对应、符合与缺口 |
| --- | --- |
| PR-004/005、RT-027—033：网页Work、独立Agent、原运行链 | A Runtime001—008、Architecture001、GPT001/002、Browser001—006、W V6-TRANSPORT001承接；保留唯一Runtime、lease/fence、WAL、Outbox，不增模型API/执行器 |
| RT-049：继承成熟机制，不继承旧业务/数据/数据库 | 新根为空，旧复制根有1184条任务；多入口数据根及credential override尚未封闭，见D1/D3。旧命理route不恢复 |
| PR-057—059、RT-050：provider/consumer/Catalog先一致 | W task/result v3有9 routes，A v2有8；W要Agent Manifest v2，A provider仍v1。Runtime003-V55写明v2，与目标接缝不符，见N2/P/D2 |
| RT-051、PR-054：无第二链、unknown不等zero | 原三表/Browser WAL/原结果与来源seal保留；隔离不改effect身份、风险授权或恢复主权 |
| ASTRA-01/02：DOCX+ZIP、Work直传R2、网站独立接纳 | W FOUNDATION006—010、A Runtime003/004承接；通讯验收到业务consumer，不下载/中转成品，不以运输证明交付 |
| 顶级论文蓝图：证据、独立核验、诚实边界 | 不缩工序、不降档、不加确定性评分门；启动/联通验收不证明论文质量或销售能力 |

明确的规范修订需求只有两项，先获用户分别明确law-amendment，不能借旧批准扩大：

- N1：A Startup002当前工作树V5→V6，supersedes V5。将本轮临时`astra:start`改回G的同名`grasseye:start`，固定4174、新根、新设备、新扩展与当前Chrome；保留Startup001、全部forbidden及证据模式。此前批准V4→V5不自动覆盖本项。
- N2：A Runtime003 V55→V56，supersedes V55。将task/result引用由v2对齐W现役v3及唯一投影；保留V6初版1、容量上限6、原运输、领域/恢复主权、全部安全禁止面，不解冻effect/Target/Outbox tombstone。

A pairing Blueprint仍写G的扩展ID，与新身份不符，须同合同局部同步。N1/N2仅同步各自现役Blueprint、spec/law引用、Manifest、原检查器与唯一生成registry；不改母本、基础法案或相邻冻结语义。

## 3. 当前实现、第一断裂和连续性

调查深度为深度，依据是跨仓handoff、存储选择与本轮反复修改。发现范围交叉取自package/配置/route注册、符号/import反查、writer/reader与SQLite只读盘点、此前同任务真实Chrome及进程观察。入口包含launcher、直接server/dist、factory默认值、enrollment、dry-run inventory、credential覆盖、extension build/pairing/WS。只在输入语义、身份、状态、副作用不变的原Owner合同处停止，不能只以“不修改”为由停止调查。

| 已证事实、首断 | Owner/后果与处理 |
| --- | --- |
| G为`npm run grasseye:start`；X为`pnpm start`→本仓start.sh，两者独立管进程 | A startup/W网站Owner；保留对应职责，不照搬X奇门、Next、Postgres等W无消费者启动项 |
| G4173、X Web4322/API4310/奇门4312；W server默认4340；A上轮改4174 | 全链固定4174/4340，禁止随机端口、端口号杀进程或跨仓signal |
| launcher限制4174和新根，直接server仍接受任意env；factory还有平台全局ASTRA默认根 | app-shell-ui/local-app-shell；绕过launcher仍可能读另一库或另建根，D1删除这些选择旁路 |
| credential文件override任意；enroll/inventory可选任意根；server URL比较允许缺配置 | Runtime；D1/D3在原库读取和外连前精确拒绝 |
| A旧`.grasseye-local`为独立inode，但含1184 tasks/3737 outbox/1013 handoff/14084 mutations；A新根Runtime三表、Browser WAL均0行且无设备文件 | 目录不同不等于业务数据隔离；旧事实不迁移、不删除，新链零生产读取 |
| 当前Chrome曾实证安装ASTRA `dmkfldicnhofmlgkoajpjbmeicgijgnl`与GrassEye `emkmbecadncngofidjgocmifhbonifgm`；A曾配对、空闲Target absent | 此前局部动态证据，不是新方案验收；A4174当前已正常停止。保留稳定key/ID，不再生成新身份 |
| W v3新增`astra_paper_research/user_dialogue`及五个parameter类型；A Catalog/投影无此route | W provider/A工厂Owner先交接P；不得只改版本号或空函数接单 |
| A配置有五个旧external/image-token/旧站URL变量，生产代码无consumer；有效cloud变量指4340 | D5只删除本仓无消费者配置，不启旧HMAC/LNA入口，不输出秘密，不升级依赖 |

有限历史与现役相交方案已核：原停止接单方案的真实Node stop/join、迟到初始化关闭、诊断Shell保留；原扩展连接自愈沿现有pairing触发恢复，不加第二timer。当前代码已承接，直接保留；旧方案里的旧端口、主权推断不能覆盖现役法。上轮干净Chrome、简化开页、边施工边改方案与将局部改动当完整隔离均废止，现有overlay不当作通过。

已知原生CHANGE曾因既有删除文件报`UNAUTHORIZED_PRODUCTION_DELETE`，另有恢复fixture/Browser inspector失败；不是本任务扩修工厂/Browser内核或宽开授权标志的理由。与本方案相交的已有修改按批准保留；无法区分归属的对象不删除、不覆盖。最终原生检查若仍失败如实停止，不能拼接历史局部成功。

## 4. 唯一目标身份与误启动边界

| 对象 | ASTRA目标 |
| --- | --- |
| 网站入口 | W `pnpm start`，现有prestart/build→唯一server；只管网站，不启动A、不建联合启动器 |
| Agent入口 | A `npm run grasseye:start`，与G同名同生命周期、不同cwd；删除`astra:start`，不留alias |
| 地址 | W `http://127.0.0.1:4340`；A `http://127.0.0.1:4174`，不消费G4173/X4322或附属端口 |
| 运行根 | A真实仓根下唯一`.astra-local`；无平台全局fallback、根外override、复制库、symlink/hardlink共享 |
| 持久化 | 原Runtime三表、Browser原WAL、Forensics/task文件/log/owner.lock各自原Owner，同一个新运行根；不合库、不增表 |
| 扩展 | 保留现有ASTRA key/ID；pairing4174、WS4174、build/release新根。原MV3/debugger/alarms、wire/protocol不变 |
| 设备 | W给origin4174独立签发device/credential/epoch；cloud4340必填且精确绑定；不复制G身份 |
| Shell界面 | 保留独立ASTRA标题及`astra-app-locale`，因cookie不按端口隔离；不借机改网站登录 |

非秘密GrassEye类型名、header、wire schema并非串数据根因，直接保留。Chrome沿G的当前浏览器Shell Tab精确复用、无窗口才恢复；不操作既存GPT Tab。生产仍由原合法job懒建自己的system Target，exact Target/Document/active generation/permit/WAL全部保留。

同一Chrome不设计两套同时生产。采用Chrome既有扩展开关，使同一时刻只有选中系统的生产控制扩展启用。切换先原Runtime drain、native真实退出及终态补交，再禁用原控制扩展、启用目标扩展；普通启动不安装/启停扩展。未选系统误开时只有其自己的Shell/session及必要原结果运输；Browser Authority absent，原`runtime-loops.ts::claimAdmissionEligible`阻新生产claim，不建/抢Tab。原staged-result/source运输例外保留，不能把“无新生产”写成“没有任何恢复请求”。

不能宣称“两扩展都启用仍有跨进程原子互斥”：两套owner.lock/lane/1.5秒门均局部，检测端口/PID存在有竞态；共享G锁会破坏独立性与只读边界。两控制扩展同时启用不满足本方案生产准入，不报告并行生产通过。未来若要求软件强制任意双启用互斥，须另行批准两端共同遵守的资源合同；本文不修改G、不加共享库或第二调度器。

## 5. 删除前裁决与1+1

先审检查必要性，再审生产结构。表中保留均须删除前成立；重建不等于删除成熟内核。

| 对象、真实consumer | 裁决与删除反事实 |
| --- | --- |
| 原startup/API boundary/release/credential/SQLite验收及各域唯一inspector | 保留入口，增强原用例；删旧应用字面值/全局默认根/新profile断言。缺它会放过错进程signal/旧扩展/错库/错设备，typecheck不能替代。无新框架、checker、PASS文件 |
| `process-control/port-listener-ops/service-process/service-readiness/startup-main-support/dependency-*` | 直接保留，launcher真实调用；删除会丢归属、PID复用保护、实际收尾、内容/native依赖探针。隔离不重写这些机制 |
| `browser-application-identity.ts`和现有manifest key | 保留，Node与browser多方实际消费；删掉恢复地址/ID多源。纯静态数据，不建配置框架/registry/账号锁 |
| `default-data-dir.ts`全局目录分支，生产入口独立选择根/host/port表达式 | D1物理退休→即时AST/引用缺席→原模块重建唯一生产根校验；现有Store直接消费结果，无新path manager |
| `credential.ts`路径/地址选择片区 | D3删除任意override与可选server绑定→缺席→重建精确绑定。schema、权限分类、NOFOLLOW、原子写保留，不整文件删其它职责 |
| 上轮`open-workbench-page.mjs`简化handoff | D4删除对应函数→缺席→从当前Chrome精确Shell复用合同建设；runSpawn/resolveChrome/escape/无窗口restore提前保留，不复制历史整文件 |
| Runtime/Browser/Forensics/Outbox/worker/GPT/Child/Product | 直接保留各自唯一Owner；删掉会丢任务权威、防重、恢复/交付或专业能力。只改变入口装配，不重构内核 |
| 旧复制数据、上轮干净profile目录 | 不消费、不迁移、不删除，保留现场不授读取资格；清理无当前必要性，不为整洁删库 |
| package/popup/Blueprint/Manifest/spec | 精确相交局部修改或唯一生成；只删除旧正式入口与旧实例绑定，不统称重建，不加CLI/服务/权限 |

1+1必须证明：成熟startup/drain/自动pairing/Target/WAL/原结果交付均不下降，同时所有生产入口拒跨库/设备/地址、保留当前Chrome登录、误开另一Shell不跨系统新生产。仅改字符串、复制旧骨架或增加平行路径均不算。已独立且有真实consumer的成熟模块按表保留，不为重构二字删除重写。

## 6. 四维映射、身份与handoff

| 需求 | 法案/施工图 | 实现/工单 | 验收终点 |
| --- | --- | --- | --- |
| 对应成熟启动 | Startup001/002、LocalShell001/003、startup Blueprint | 原launcher/helpers、D4/D5、N1 | 本仓进程/当前Chrome Shell/真实停止，不混执行ready |
| 端口与扩展 | Browser001/002/005、API boundary001及pairing Blueprint | D1消费者接入、D4原build/pairing/socket | 4174新ID鉴权；旧ID/来源拒绝；4340归网站 |
| Agent数据库隔离 | Runtime002/005/006、LocalShell及V6 Blueprint | D1/D3，原Store/Forensics/Browser WAL | 实际根/inode/表与旁路反例，旧库零读取 |
| 双仓通讯 | Runtime001—004、W V6及FOUNDATION006—010 | N2/P/D2/D3原链 | 原完整结果receiving→同身份网站领域接纳 |

identity spine：A根→Shell4174→扩展/release/profile/session→W独立device/origin/control-v1→原job/request hash→accepted attempt/revision/fence→原effect/WAL→完整result hash/Outbox/terminal receipt→W领域结果。order/project/input/confirmation/authorization/Work资产引用仍由原Owner给出；Target/URL/进程不可替代这些身份。

| handoff与Owner | 合同/成功readback | 拒绝、失败、unknown/回接 |
| --- | --- | --- |
| startup→App/Chrome | 单.env.local、固定根/4174、原source fingerprint health、真实close；只开Shell | 错根/port在logger/DB/signal/外连前拒绝；foreign listener零signal；执行依赖缺失仍诊断Shell。无业务事务/lease，依据startup合同 |
| 扩展→API pairing/WS | 原GET`/api/browser-authority/pairing`、内存一次性secret/no-store、exact ASTRA ID/Origin、原认证WS | 网页/旧ID/null/file/无身份拒绝；stale先自reload；断线原链重认证，不增timer/transport；空闲Target absent |
| Runtime→W enroll | 原POST`/internal/ai-production/v6/devices/enroll`，production/request_id/token及原response；独立设备/origin4174、原子0600文件 | 缺/旧/冲突配置零请求；一次调用一个request_id，unknown不重跑随机注册。原请求ID随本次脱敏诊断可关联，由W读原请求/设备；不建注册表 |
| Runtime→W session/claim | `astra.production-control-v6` v1，原open/heartbeat/close/claim/renew/release；device/epoch/origin/version逐项一致 | 错版本/权限typed拒绝，零Provider；lease预算/fence/read-first原合同。非选扩展absent阻新生产，不阻原结果运输 |
| W task→Runtime→Catalog | `astra.website-agent-task-result` v3全部9 routes，provider唯一generator，Catalog双向相等；Agent Manifest目标v2 | 未齐阻断，不空route/手写表/alias；逐项承接required/optional/null/default、枚举/基数、材料repeatable/min_count/ordinal/关系/信任、unknown-field、canonical编码/hash，不造第二schema |
| A完整结果→W接收→领域 | stage与terminal意图同事务、原Outbox；receiving绑定原job/attempt/session/epoch/result hash，A completed；W沿原结果领域接纳 | 200/staged/SENT不等receiving；unknown读原receipt，零重做Provider。W领域拒收不撤A completed/另建job；对应W原Owner同身份读回 |
| Work→R2→网站资产 | 原Product直传/全字节读回、网站独立同版DOCX+ZIP核收 | 本方案不重跑S链、搬成品或造假文件；完整业务证明依原任务交付，不以通讯通过开放销售 |

有限分母还包括：端口空闲/本仓旧listener/foreign/PID变化；server/dist/enroll/inventory旁路；根不存在/合法空库/合法现有库/旧schema/损坏/权限/软硬链接/根外override；credential缺失/JSON/schema/旧4173/旧4322/缺cloud/新设备；artifact current/stale/缺失/重建失败；扩展禁用/合法/错ID/build/断线；正常/重复/初始化中停止；同结果重投；provider/Catalog漂移。Owner及落点为本表和D1—D5，typed失败保留原件，只由原Owner合法配置/事实恢复回原入口；无自动修库、清WAL、换身份或第二恢复状态。源结构错误无恢复动作，只停止。

## 7. 原子工单与施工纪律

共享门：先规范授权与P交接，再实施；每单写前重新核Git、目标字节及overlay归属。真正重建只限D1/D3/D4指定片区；其余保留、局部修改、删除退役和生成分别汇报。每个消费者接入由表列原Owner独立动作，不跨Owner合成大工单。

### N1/N2：两项规范决定

N1唯一Owner startup-entrypoint，位置为A功能法案Startup002 block；N2唯一Owner agent-production-runtime，位置为Runtime003 block。各自只实施第2节精确语义，保留全部其余义务；先对应明确授权，删除旧active block并原子替换下一major，同步自己的现役引用/Manifest/原检查器，唯一builder生成registry。不修改母本或别的法条，不复制历史。验收parser/active引用/投影及原禁止面；失败停对应实现，不先代码后补法。此处无生产重建或数据操作。

### D1：唯一生产根

Owner local-app-shell，A `src/lib/local-runtime/default-data-dir.ts`默认目录选择片区。删除原`getDefaultLocalDataDir/getDefaultPhase04LocalDataDir`平台全局选择实现→即时AST/引用核缺席→从“本仓唯一根”合同在现有模块重建生产根解析校验。静态identity模块与所有Store直接保留，不复制Node逻辑到browser bundle，不新增path manager。

输入为已核A工作根/请求目录，输出为该真实根下唯一`.astra-local`。先核工作根身份和realpath、现存祖先无symlink；旧根/根外/非同一路径override拒绝。缺目录只建合法新根；既有DB/凭据/关键artifact拒绝symlink及共享hardlink，不能用不同合法字面路径指同一inode。校验早于生产首次logger/Store读取写入。内部capability的既有显式临时目录测试注入保留，不创造test-mode生产身份。

消费者各自的不可分割局部接入如下；只删原选择表达式，不删独立职责，各自验收同一root合同和原职责：

| 唯一Owner | 精确消费者与动作/readback |
| --- | --- |
| startup-entrypoint | `launch-grasseye.mjs`创建startup logger前调用根校验；保留完整stages/shutdown/helpers；错根零log写/DB/signal |
| app-shell-ui | `src/app/server.ts`创建handle/监听前核根及固定host/port；保留唯一HTTP及真实close；直接/dist旁路同样拒越界 |
| agent-production-runtime | enrollment、credential路径及`production-runtime-storage-reconcile.ts`打开文件前接入；保留原协议/只读inventory；错根零文件读取/外连 |
| local-app-shell | `workbench-assembly.ts`默认装配接入；保留显式内部options、原logger/Browser/Forensics装配；无第二默认根 |

验收增强原startup/local-shell/credential/storage用例，覆盖全部入口和有限分母；真实resolver/Store读回root/inode、三表及WAL。新库只当前schema首次建表；已有库只读schema验证，旧schema/损坏不迁移不修复。删除时取即时AST证据，功能再取consumer读回。失败保留原件，无fallback/清库/源码自动回退；合法配置恢复后沿原入口重启。

### D2：唯一通讯投影

Owner agent-production-runtime，A task/result dependency、原`sync-website-agent-route-policy-projection.ts`和原`website-agent-route-policies.v1.json`。N2/P之后承接W v3，保留control dependency v1及原transport/Store；退休v2固定假设和旧投影，再由唯一generator产新投影，不手写schema/生成物，不降provider。

前置交接P分属原任务，不由本方案代写：A工厂architecture-boundary Owner按其唯一方案交付真实`user_dialogue`/C01/结果接收及9-route Catalog、原Product验收；Runtime Owner公布新Catalog实际语义对应Manifest provider v2；W Owner消费现有dependency v2并保持其task/result v3、control v1冻结，交付4340服务/origin4174/独立设备鉴权。网站DB归网站Codex，不进入本单。

验收比较实际authorityArtifact全部语义、生成投影与Catalog双向集合；新增五个parameter类型、材料/结果结构/unknown-field均沿原反例。全部9条有真实生产consumer才cutover，不空函数、旧业务alias。provider继续变版、工厂缺失或未列语义变化，停止本单，不能执行中改方案追版。删除仅旧固化投影/假设；不重建成熟链。生成失败停新生产，保留现场，不双读回v2。

### D3：独立凭据与注册

Owner agent-production-runtime，A `credential.ts::productionCredentialPath/assertCredentialOrigins/enrollProductionDevice`的路径/地址绑定片区。D1之后删除不受限override、可选server绑定及enroll任意根/origin分支→即时AST缺席→同Owner按原schema重建精确绑定。JSON/schema/权限错误分类、0700/0600、NOFOLLOW、原子fsync/rename和原HTTP协议直接保留，不整文件删独立职责。

若保留`AGENT_PRODUCTION_CREDENTIAL_FILE`读取，只准规范化后等于新根唯一credential文件；数据env仅等于新根。cloud必须是已交接W4340，origin固定4174；缺/旧/冲突在外连前typed失败。长期credential不存合同正文/hash，升级合同不重新注册。缺设备保留诊断，不读G设备。

显式注册是独立运行操作：P/D2一致及具体注册授权齐备，才原`production-runtime:cloud:enroll`一次；本次request_id固定并可随脱敏诊断关联，不新增持久请求表。合法回复验device/origin后原子落唯一文件，有凭据不覆盖。响应/写入unknown停，由W读原请求/设备，未经核实不重跑CLI另造设备。验收旧凭据/地址/路径/权限/版本反例零新生产，真实新设备session被W接纳，G文件/设备不变。无自动回退/重签。

### D4：当前Chrome及扩展绑定

startup Owner在 `open-workbench-page.mjs::openMainPage/openWorkbenchPage`片区，先删除上轮简化handoff→即时AST缺席→从“当前Chrome精确Shell复用”合同建设；提前保留runSpawn/resolveChrome/escape/无窗口restore函数，直接调用。不搬历史整文件，不保留新profile参数。4174 Shell存在精确复用，不存在才新Shell Tab，零窗口原restore；不触GPT既存Tab。声明和startup验收局部同步。

Browser Owner局部同步原manifest/build/release/profile/pairing/socket/popup身份和命令，保留稳定key/ID、原权限、自动reload/alarms及全部Target/WAL。API boundary Owner只同步旧pairing Blueprint实例ID并原正反验收，不加API或fallback。profileRef只标记扩展绑定，不虚构物理profile隔离；无consumer的profileDir/disallowDefaultProfile不恢复。

安装在当前Chrome，目录固定A`.astra-local/browser-build/extension`；已有安装不重复添加。按第4节原drain后切换启用控制扩展，普通启动不做安装/开关。验收key→ID/实际path/build/release、旧ID/来源拒绝、stale自reload、首次及A重启自动认证、空闲Target absent；合法任务只建自己的system Target。单控制扩展下另一Shell误开不新建Tab/Provider；两扩展启用不报告并行生产通过。失败保留登录、任务/WAL，沿原连接恢复，不移除G扩展或重建profile。

### D5：对应启动入口与配置

code-purity Owner只改A package正式script为G同名`grasseye:start`，删除`astra:start`，保留ASTRA package身份/版本/lock/依赖与新根gitignore；不新增CLI、别名、联合launcher或升级安装。startup/Browser各自Owner同步现役提示、Blueprint/原检查器，不改历史方案。

本机配置只删除第3节已证明无人消费的五个旧变量：`GRASSEYE_EXTERNAL_API_ENABLED/GRASSEYE_EXTERNAL_ALLOWED_ORIGINS/GRASSEYE_EXTERNAL_API_KEY/AMZMGR_AGENT_PRODUCT_IMAGE_UPLOAD_TOKEN/XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL`。保留实际ASTRA端口/cloud绑定，不输出秘密。W `.env.example`错误Agent origin4340由W Owner修成4174，本任务不落笔。

验收A/G同名命令各自cwd→本仓、env loader唯一、dependency检查仍按内容/native而非mtime、现役提示无双入口；普通启动无enrollment/安装/任务/quality副作用。删除时核旧script不存在，无生产重建对象。失败停本单，不加别名或回改G。

## 8. 切换、质量、终点和失败

固定顺序：N1/N2授权与落地→P工厂/网站交接→各自原生CHANGE可接纳→D1及各consumer→D3→D4/D5→D2完整一致→单独授权的注册及真实联通。停机时可准备D2投影，但cutover晚于全部真实合同/Catalog交接。无桥、双读或导入旧身份。

drain：A旧producer已停止、原Promise/native真实退出。切换前重读新根零task/Outbox/mutation；若出现真实任务，停止空库切换，由原Owner原身份交付、drain，不清库。G/X不动，W由其Owner按原任务drain/启动；同一Mac不等同一部署单元。合同/consumer漂移停止受影响施工，保持本文冻结，不执行中追版改设计。

| 验收对象 | 既有命令/真实动作与权威readback |
| --- | --- |
| A结构/相交行为 | typecheck、原browser build/release、startup、API boundary、app-shell/local-shell、Runtime/Browser相交acceptance；只证明实际覆盖 |
| A根/设备反例 | 原隔离fixture调用真实resolver/credential/Store，覆盖正常及所有旁路、旧env/根、软硬链接/旧device/地址；不触G现役数据。仅改port而保留override的错误实现必须被拒 |
| 进程隔离 | 原process-control反例证明foreign/UID/cwd/PID变化零signal；运行授权后读A4174/W4340真实PID/cwd，重启停止只本仓；G没运行不冒充并行证据 |
| Chrome/误启动 | 当前Chrome实际ID/path/build及health；单控制扩展下另一Shell Browser absent/新生产claim零/system Tab零；既有结果运输另核原身份。G只用等价原fixture/其Owner证据，本任务不启动G |
| W—A业务终点 | W原运营validation_only本人隔离项目的合法真实任务；追同job/request/attempt/fence/result→receiving→对应领域接纳/客户获准状态。9 routes机械双向一致不等9业务均实测，一项任务不等整厂通过 |
| W数据库readback | 只消费W Owner同身份原接收/领域读回引用，不建DB连接、不跑SQL/PG测试，不以口头“已配”替代证据 |
| 原生quality | A `npm run quality:check -- CHANGE`；W由其Owner `pnpm quality:check CHANGE`（现有脚本归一大小写）；各仓分别判，不建跨仓总PASS。设计阶段不执行 |

通讯任务不是启动器synthetic job，而是启动后另获授权的真实隔离业务；不得伪造付款、哈希、成品或业务成功，涉及资金/不可逆外部动作仍需具体授权。工厂/网站尚不能签发合法任务或业务readback缺失，联通终点未完成，不降格session成功。运行观察不自动成为RELEASE Dynamic Proof，READY/RELEASE另回clean commit和全部法定分母。

重构纪律与功能质量分别验：D1/D3/D4删除→即时缺席→新建当时的工具记录可核；禁止保存旧片区到内存/临时副本机械加工、复制历史骨架、改名壳或兼容桥。保留模块提前裁决后直接用。最终diff不补造过程；缺证据报告“无法核实重构纪律”，违规报告“未满足重构要求”，不得用功能通过替代。

无自动源码回退、reset/stash/搬overlay或回到G身份。失败停受影响单/新生产，保留新根原件及unknown，由原Owner原链回接，不删库重来。网站未交付等待原Owner，不接管其DB/Product。已获授权的独立部分也不能越过冻结方案继续扩大。

## 9. 冻结与施工准入

冻结前只迭代本文，不施工、不建第二版本文件。主AI三轮依次审源头/法案、闭环Skill/删除反事实、误启动/旁路/cutover；找不到剩余设计finding后，按subagent-review启动独立只读审计。审计者必须读原文，仅审计，不写代码/方案、运行服务或生产；未放行不能结束方案建设，结论不替代quality。

独立审计逐项核：四源头边界、法案冲突是否明确阻断、闭环Skill完整要求、四需求至全部consumer/工单/有限分母/readback、真删除后建设及不恢复旧骨架、单Chrome开关前提不冒充自动互斥、网站DB/用户overlay保护、局部联通不冒充业务/READY/RELEASE。冻结后本文hash只存任务上下文，不自写回正文。

冻结后的执行只能按本文。发现来源/合同/consumer漂移或漏列责任，先停受影响施工，本文继续冻结；独立重开设计、同样审查并取得用户重新批准后才能替换，不能边执行边改方案。一般测试失败不授权改设计或放宽门。

当前施工门关闭：N1/N2新法条修订尚需明确批准；P中的真实user_dialogue/Catalog/Manifest v2及网站4340/origin4174/独立鉴权服务尚无交接验收；本轮未恢复代码、配置、注册、业务运行施工指令。审计不得用假值消除此门，未闭合不得标“可施工”。

最终按精确对象分别报告：真正重建、经论证保留、局部修改、删除退役、失败回退、尚未完成；单机隔离、Chrome配对、设备session、完整结果接收、网站接纳、原生质量与重构纪律各自如实说明。
