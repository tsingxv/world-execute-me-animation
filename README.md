# world.execute(me); — 网页动画（runtime / 单画布 · 纯函数时间）

一个用 Canvas 2D 画的完整音乐可视化作品：以 **audio.currentTime 为唯一时间基准**、`requestAnimationFrame` 驱动、**每一帧都是时间 t 的纯函数**，双击本地 HTML 即可运行，不装依赖、不构建、不起服务器、不联网。

本仓库**只包含代码与文档**。歌曲音频、MIDI、LRC 歌词均为第三方作品，一律不入库（见 `.gitignore`）；需要你自备这三份文件，按下面的[复现](#复现)流程本地生成数据后运行。

---

## 目录

- [效果概览](#效果概览)
- [快速开始](#快速开始)
- [文件契约](#文件契约)
- [目录结构](#目录结构)
- [三个数据源，分工严格不混](#三个数据源分工严格不混)
- [确定性：帧是时间的纯函数](#确定性帧是时间的纯函数)
- [逐句编排与 EXECUTION 的 18 态工厂](#逐句编排与-execution-的-18-态工厂)
- [验证套件](#验证套件)
- [一个必须如实说明的事实：MIDI 与录音配不上](#一个必须如实说明的事实midi-与录音配不上)
- [版权](#版权)
- [原始提示词（逐字）](#原始提示词逐字)

---

## 效果概览

| | |
|---|---|
| 舞台 | 单张全屏 canvas，10 个"画板"（board）叠加：背景场 / 透视网格 / 代码雨 / MIDI 钢琴卷帘 / 卡点层 / 常驻实体 / 逐句场景 / 歌词条 / HUD / 覆盖层 |
| 内容 | 96 句人声逐句独立编排，32 个参数化场景族，12 种情绪调色板 |
| 高潮 | 歌词里出现 18 次的 `EXECUTION` = **同一个进程的 18 个状态**（pid、cpu、色相、腐蚀度、18 格血缘条随 k 单调演进），18 种不同机制 |
| 时间 | 卡点用 MIDI 音符事件；文字用 LRC 实测时间；能量/闪光用从录音实测出的包络与 onset |
| 操作 | 空格 播放/暂停 · `←/→` ±1 s · `Shift+←/→` ±10 s · `Home/End` 首尾 · 点击画面任意处播放暂停 · 拖底部轨道擦洗 |
| 帧成本 | 约 2 ms/帧（1280×720，实测 p95 2.0–2.2 ms） |

---

## 快速开始

需要两样东西：**任意现代浏览器**（运行）和 **Node ≥ 18**（仅用于一次性解析你自己的三份文件）。

```bash
# 0) 把你自己的三份文件放到仓库根目录（文件名见下面"文件契约"）

# 1) 让音频以 ASCII 文件名就位（页面用相对路径引用它）
mkdir -p assets && cp "Mili - world.execute (me) ;.mp3" assets/world-execute-me.mp3

# 2) 先检查三份文件是否齐备、行数是否与编排表匹配
node tools/preflight.mjs

# 3) 从录音里实测能量包络与 onset（无头浏览器解码，唯一可用的 mp3 解码器）
#    ->  tools/audio-analysis.json
node tools/run-analysis.mjs extract.html audio-analysis.json

# 4) 解析 MIDI + LRC，生成三个数据模块  ->  data/notes.js, data/lyrics.js, data/audio.js
node tools/build-data.mjs

# 5) 双击 index.html
```

注意顺序：`build-data.mjs` 会读 `tools/audio-analysis.json`，所以第 3 步必须在第 4 步之前。

可选：合成**单文件版**（CSS + 11 个脚本 + 音频全部内联，11 MB 上下，可单独拷走双击运行）：

```bash
node tools/build-single.mjs     # -> world-execute-me.html（含音频与歌词，不要提交、不要分享）
```

验证：

```bash
node tools/verify.mjs                                   # 文件夹版，32 项
WE_TARGET=world-execute-me.html node tools/verify.mjs   # 单文件版，32 项
node tools/verify-standalone.mjs                        # 把单文件复制进空目录再测，8 项
node tools/audit-ip.mjs                                 # 发布前的版权/隐私门禁，见"版权"一节
```

---

## 文件契约

脚本目前按下列**确切文件名**读取（改名的话在 `tools/build-data.mjs` 顶部与 `tools/extract-audio.js` 的 `fetch()` 里各有一处字面量）：

| 路径 | 用途 | 被谁读取 |
|---|---|---|
| `Mili - world.execute (me) ;.mp3` | 录音；用来量精确时长 + 提取能量包络/onset | `tools/build-data.mjs`、`tools/extract-audio.js` |
| `world.execute(me);.mid` | MIDI；音符 t/pitch/velocity | `tools/build-data.mjs` |
| `歌词.lrc` | 歌词与实测时间戳 | `tools/build-data.mjs` |
| `assets/world-execute-me.mp3` | 上面那份录音的 ASCII 名副本 | 页面 `<audio>` |

LRC 侧的两个约定：

1. 时间戳格式为 `[mm:ss:cc]`（百分秒），解析式 `Number(m[1])*60 + Number(m[2]) + Number(m[3])/100`。
2. **前两行按"文件头"处理**（一份下载站自带的说明行 + 标题行），其余才是要唱的词。如果你的 LRC 结构不同，请删掉/调整 `build-data.mjs` 里的 `lrcLines.slice(2)`。
3. 场景编排表 `STAGE` 是**按行序**写的（一行一句，重复词也各占一行），并有逐行首词校验：行数或首词对不上就直接报错退出，不会静默错位。所以换一份 LRC 需要重新编排 `STAGE`。

---

## 目录结构

```
index.html              页面骨架：canvas + <audio> + 启动面板，按顺序加载 11 个 classic script
style.css
data/                   【生成物，不入库】notes.js / lyrics.js / audio.js
engine/
  kit.js                确定性基元：hash/rnd/noise/wander、缓动、调色板、text/line/path/rrect/ring/disc/bloom
  furniture.js          共用舞台件：panel / caret / label / meter / typed / scramble / figure
  data.js               只读访问器：音符窗口、和弦、密度、实测包络采样、onset 最近邻、歌词槽位、区段表
  scenes-0.js           ACT 0 启动 + "If I'm a X" 定义段 + 切换/眩晕/旅行/合并
  scenes-1.js           副歌 promise + 礼物清单 + 神/证明 + 身份切换 + 隔离减法 + 崩溃 + 四段间奏
  scenes-2.js           温柔段 + 多语种数数 + EXECUTION 工厂（18 机制）
  layers.js             10 个常驻画板
  main.js               帧合成器、时钟、异常隔离、控件、验证钩子
tools/
  preflight.mjs         检查自备的三份文件是否齐备/可用，并提示下一步
  smf.js mp3.js         零依赖 Standard MIDI File 解析器 / MPEG 帧头时长测量
  build-data.mjs        解析 .mid + .lrc -> data/，并持有逐句编排表 STAGE
  extract-audio.js      在浏览器里解码录音，算 spectral flux / 5 频段 / rms / onset 挑选
  run-analysis.mjs      用零依赖 CDP 客户端驱动无头 Chrome 跑分析页
  build-single.mjs      合成单文件版
  cdp.mjs               零依赖 Chrome DevTools Protocol 驱动（启动、evaluate、截图）
  verify.mjs            31 项验证
  verify-standalone.mjs 把单文件放进空目录后的独立性验证
  shoot.mjs             批量截图（肉眼复核用）
  audit-ip.mjs          发布前侵权/隐私审计（歌词 n-gram、音符表、素材、外链、密钥、路径）
  align.mjs salience-analysis.js pitch-align-analysis.js synth-align-analysis.js
                        配准实验（结论见下文），及其 *-result.json 输出
```

---

## 三个数据源，分工严格不混

| 来源 | 进页面的形态 | 只负责 | 绝不负责 |
|---|---|---|---|
| `.mid` | `WE_NOTES`：1416 个 `{t, p, v, d, track}`，聚成 614 个和弦级卡点 | **所有卡点**：低音打地板条、和弦开环、高音点 tick、钢琴卷帘、实体轨道数 | 决定歌词何时出现 |
| `.lrc` | `WE_LYRICS`：96 句 `[start, end, text, family, mood]` + 每句参数 | **文字上屏的时机与内容**、场景族路由、情绪配色 | 参与任何节拍计算 |
| 录音本体 | `WE_AUDIO`：25 Hz 的 flux/rms/5 频段包络（hex 字节）+ 835 个实测 onset | 背景呼吸、雨密度、网格扭曲、**闪光与心跳**（最近一次实测 onset 后 60 ms 内） | 改写 MIDI 时间或歌词时间 |

LRC 的时间戳**从不**量化到网格：验证里有一条专门检查它"不是套出来的网格"——6 种不同间距、5 对同时刻行原样保留、最长空白 18 s、最大间距只占 41%。

---

## 确定性：帧是时间的纯函数

- 唯一时间源：`audio.currentTime`（每帧采样一次）。引擎自己**不维护**任何动画状态。
- 无 `Math.random()`：所有随机取自 `hash(index, ⌊t·fps⌋)`；需要平滑就用同一哈希做插值，仍是 t 的纯函数。
- 无跨帧可变状态：粒子/残影/拖尾一律写成解析式（`age = t - spawnTime`），不存在累加器。
- 每帧结束断言 ctx 回到默认值（`globalAlpha / globalCompositeOperation / shadowBlur / lineWidth / filter / transform`）——这是"无跨帧状态"最直接的守卫。
- 因此：往回拖不花屏；任意顺序跳转后，同一 t 的像素与首次渲染**逐字节相同**。

一个实现细节值得记录：**逐帧比对必须用每次新建的离屏 canvas**。复用同一个活体 canvas 反复 `getImageData`，Chrome 会切换光栅化路径，同一个 t 会出现 ±3～54 的像素抖动——那会把正确的代码误判成不确定。（`engine/main.js` 的 `WE.test.frameHash()` 就是这么做的，注释里写了原因。）

---

## 逐句编排与 EXECUTION 的 18 态工厂

32 个场景族都是参数化工厂：同一族读自己的参数行，所以重复的句式（`If I can…`、`Then I can…`、`You have left`×6、`switch my…`）每次都不一样，且能看出是同一台机器在变。

`EXECUTION` 出现 18 次 = 一个 `identity(k)`（pid = 4096+37k、cpu、色相从青→品红→白热、腐蚀度 = k/17、倾角）加上 18 种机制，卡片下方始终画一条 **18 格血缘条**，已用过的格子留色——一眼看出是同一个进程在推进：

```
k=0  print      终端逐字打出，光标闪                (68 s  第一次承诺)
k=1  spawn      进程卡滑入 + 冲击环                  (147 s 起 12 连击)
k=2  fork       左右镜像分裂
k=3  echo       拖出 6 层残影
k=4  stack      溢出：文字竖向堆叠并被裁切 + RangeError
k=5  shear      横条错位（像素排序感）
k=6  aberrate   RGB 三通道分离（lighter 合成）
k=7  rotor       旋到竖向 + 条形码刻度
k=8  decrypt     乱码逐字收敛成词
k=9  shatter     炸成 9 个字符碎片
k=10 invert      极性反转：白块挖空出字
k=11 modulate    字沿实测中频包络起伏
k=12 table       ps 风格进程表，把前面每一次 EXECUTION 列成仍在跑的历史行
k=13 recurse     嵌套调用帧缩进
k=14 broadcast   一份主体 + 14 个分发目标（"give them all"）
k=15 singularity 全部塌缩成一个白热点（"your only"）
k=16 step        调试器逐行走 `return EXECUTION;`
k=17 return      安静打出 `return EXECUTION;`，光标熄灭
```

常驻实体（`self`）贯穿全曲：位置随时间漂移、色相随情绪插值、卫星数由 MIDI 密度决定、心跳环由实测 onset 驱动；当某句自己的文字要占画面正中时，它会**让位**（15 个族配了 `entity` 偏移），但从不消失。

四段没有歌词的空白也各有归属：`simrun`（12.6–29 s 世界自走）、`errorstorm`（132–147 s 异常增殖撕裂）、`afterglow`（191.5–205.6 s 只剩公式与冷却）、`poweroff`（208.6 s–结尾 CRT 塌成一条线）。

---

## 验证套件

`node tools/verify.mjs` → 31 项，全部在真实无头 Chrome 里对真实 `file://` 页面做真实像素判定。

```
1   1e    引用的资源都存在 · 脚本都能在 file:// 加载 · 无任何远程请求 · 样式生效 · 音频来源正确
2   2e    嵌入音符数 == 解析 .mid · 首尾音符逐字段相等 · 卡点确实来自 MIDI
            · 歌词时间戳 == LRC 原值 · 歌词不是拟合网格
3   3d    100 个编排时刻**全部画出像素**（相对"只画背景"基线的改动比例 + 指令数 + 颜色数）
            · 每句路由到它自己的场景族 · 卡点层活着 · 无静默调色板/场景回退
4         0..duration 每 0.25 s 采样（848 帧）都有墨、无画板错误
5   5b    动画终点 == 实测音频时长；结尾仍在作画
6         30 个随机时刻 × 正序/逆序/乱序/重复 渲染**字节一致**；大跨度跳回原帧一致
7   7b    源码无 Math.random/Date.now/墙钟；帧末 ctx 状态回到默认
8   8c    18 次 EXECUTION 全部落位、18 种机制、18 张不同画面（帧哈希唯一）
9   9b    96 句歌词逐句在其槽位上屏；不凭空加词；18 次 execution 词数 == 编排数
3e        整条时间轴上被画出的每一段文字都不含 undefined / NaN / [object]
10  10b   注入一个必抛的画板：只有它被标记，其余画板继续画，rAF 存活，关掉后恢复干净帧
12  12b   引擎时间恒等于 audio.currentTime（手动改 element.currentTime 引擎立即跟随）；帧率与帧成本
13  13b   把音频文件移走（单文件版则指向不存在的路径）：不黑屏，横幅说明降级，内部时钟接管，画面照常
```

覆盖率为什么不用 `alpha > 0`：背景层铺满整个画布且不透明，那样永远为真。这里用**基线差分**（只画背景的渲染 vs 加上被测画板的渲染）+ 指令计数 + 不同颜色数三件事一起判。

`tools/verify-standalone.mjs` 会把单文件复制进一个**只装有它自己**的临时目录，再验一次：音频来自 `blob:`、时长对得上、8 个时刻有像素、跳转后逐帧一致、无错误。

每条检查都做过**反向测试**（确认它真的会失败）：故意抽掉一个场景参数，3e 就捕获到被画出的 `"undefined"`；把音频文件移走，13 就报降级；注入必抛画板，10 才报隔离。写不出反例的检查等于没有检查。

---

## 一个必须如实说明的事实：MIDI 与录音配不上

这份 MIDI 是 format 1 / 480 ticks / **恒定 120 BPM** / 全音符落在 0.125 s 量化网格上 / 力度恒为 80 / 只有两轨钢琴，**只覆盖 0–159.75 s**，而录音实测 211.907 s。

我试过把它配准到录音上，三种独立方法都失败：

| 方法 | 结果 |
|---|---|
| MIDI onset 序列 vs 录音 spectral flux 做 ±6 s 互相关 | r ≈ 0.03–0.075，**任何滞后都没有峰** |
| 音符落在实测 onset 上的"显著度" 2D 搜索 (scale, offset) | 恒等映射 0.19 vs 全局最优 0.22，仅噪声级提升 |
| 把 MIDI 合成成音频，再做分带能量互相关（10 个对数频带） | 最优只比已饱和的基线高 2.7σ，且 top 候选散布在 scale 0.94–1.10，无一致性 |

还有一个**陷阱值得警告**：录音的 onset 密度约每 0.25 s 一个，所以"每个 MIDI 音符附近都有 onset"这种判据毫无区分力——随手一测就是"79% 在 100 ms 内"，连 scale=1.154 或整体 +7.1 s 这种荒谬假设也能拿同样分数。别用这类指标下结论。

**所以这个项目没有伪造校准值**：卡点严格走 MIDI 自己的时钟（`WE_NOTES.align.tolerance` 默认 0，即不做任何校正），与录音的同步感由实测包络/onset 驱动的闪光、呼吸、心跳来承担。如果你拿到与录音对齐的 MIDI，把 `tolerance` 设成一个秒数即可一行启用逐事件吸附（实现见 `engine/data.js` 的 `D.snap` / `events` 构建处）。

---

## 版权

- 本仓库代码：MIT（见 `LICENSE`）。
- **不包含**也不重新分发：歌曲音频、MIDI 曲谱、歌词文本，以及由它们生成的 `data/*.js`、`world-execute-me.html`、`tools/audio-analysis.json`、`tools/midi-notes.json`。这些都在 `.gitignore` 里。
- 源码与注释里不含任何整句歌词。原本有几处引用（崩溃 stack trace 里的两行、书页标题、世界搭建标签、数数段的多语种数字、以及若干文件头注释里的示例），已全部改成等价的中性文案；本 README 也不复述那些句子，理由就写在下一段。剩下的只有 `Execution`、`simulations`、`AM/PM` 这类单词级舞台标签。
- `node tools/audit-ip.mjs` 是这件事的**机器门禁**，不是承诺：它按 `.gitignore` 算出"这次提交会包含哪些文件"，再用歌词 n-gram（4–6 词，容忍跨行与标点）比对每一个待入库文件，并检查音符时间戳序列、录音特征表、第三方素材/字体、外链与 CDN、npm 依赖、密钥形状字符串、暴露用户名的绝对路径、上游版权头，最后断言磁盘上每一份风险文件确实被忽略。当前结果：**0 FAIL / 0 WARN / 25 PASS**。报告写到 `tools/ip-audit-report.json`（该文件本身也被忽略，因为它会回显命中的片段）。
- 请只在你**有权使用**的音频/曲谱/歌词上运行这套流程，仅作个人学习用途。

---

## 原始提示词（逐字）

需求最初是这样给的（第一条为初始需求，后两条为追加）：

> 请使用我提供的《world.execute(me);》音频、MIDI 与 LRC 文件创作一部完整的网页动画。
>
> 先解析 MIDI，把每个音符的起始时刻、音高、力度提取成数据嵌进代码，用于所有卡点；歌词时间轴以 LRC 实测时间为准，不要用固定 BPM 网格去套。这两件事分工不要混。
>
> 逐句理解歌词的情绪，为每一句设计独立的视觉表达；重复出现的歌词必须根据上下文变化 ——如果 EXECUTION 出现 18 次，就要有 18 种不同的处理，而且最好用一个参数化工厂 生成，让它读起来是一个实体在变化，而不是 18 张无关的幻灯片。
>
> 以 audio.currentTime 作为唯一时间基准，用 requestAnimationFrame 驱动。 区间内的渲染必须是时间的纯函数：不要有任何跨帧可变状态，不要用 Math.random()，所有随机取自 (序号, t) 的哈希。这样往回拖进度条才不会花屏，跳转后才能精确复原。
>
> 最终必须能直接双击 index.html 运行，不装依赖、不构建、不起服务器、不联网；歌词与时间轴保存在本地代码中。
>
> 完成后请自己写脚本验证，并且注意：覆盖率要验证"画出来了"，不能只验证"注册了"。至少还要验证：动画终点与实测音频时长一致、任意乱序跳转后逐帧复原、无资源缺失、音频缺失时能降级而不是黑屏、单块画板抛异常不会毒死整个渲染循环。

> 打包成单文件可执行版本

> 帮我上传到我的 github 仓库注意写一个 readme，整理完先不要上传，先让我审核一遍，注意在其中应包括所有需要的部分不包括歌曲和 midi 文件以免造成侵权行为，其中应包含完整复现过程及提示词

---

## 实现约束备忘（给改代码的人）

1. 全部是 **classic script**，不用 ES module：`file://` 下 `<script type="module">` 会被 CORS 拦掉。
2. 不要用 Web Audio 的 `AnalyserNode`：`file://` 的媒体会污染音频图（拿不到实时数据），而且实时分析本身就是跨帧状态，会破坏纯函数与可复原性。需要"和录音同步"就用预提取的实测数据。
3. 任何新画板都必须：只读 `E`（env）、不写外部变量、不依赖帧序、被 `WE.frame` 的 try/catch 包住。
4. 新场景参数一律写进 `tools/build-data.mjs` 的 `STAGE`（带首词校验），别在引擎里硬编码行号。
5. `String.replace` 注入代码时**必须用函数式替换**（`() => text`）：字符串替换会把 `$&`、`$'` 当模式展开——`engine/kit.js` 的字形表里就有 `$&`，这个坑真实地炸过一次。
6. 想扫描"画到画面上的文字"时，必须在 `WE.text` 入口记录逻辑字符串：为了手写字距，真正落到 canvas 的是**逐字符** `fillText`，直接 hook canvas 只会拿到一堆单字符，检查会空转通过（这条也真实地骗过一次）。
