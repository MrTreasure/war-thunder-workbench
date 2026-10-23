# 增量国际化维护

正式文案按语言独立保存在 `data/i18n/{zh-CN,en,ru,ja}.json`。键沿用中文源句，不重新编号；值为对应语言字符串。载具正式译名继续来自有来源记录的游戏本地化数据，不放入界面词典。

## 每次修改界面

```sh
pnpm run i18n:scan
pnpm run i18n:translate -- --locale ja --limit 50 --dry-run
pnpm run i18n:translate -- --locale ja --limit 50
pnpm run i18n:check
pnpm run check:i18n
```

`i18n:scan` 使用已安装的 TypeScript AST 扫描 `src/` 的 `t()` / `localize()` 文案。新文案只补充中文文件，不清空或覆盖已有外语译文。模板表达式转换为 `{0}`、`{1}` 等占位符。用户昵称、变量引用、存储内容、代码标识不解析成文案；裸 JSX 中文和 `title` / `placeholder` / `aria-label` / `alt` 中文只列入待人工确认清单，需先在源码调用 `t()` / `localize()`。`LanguageSwitch` 的语言自称不作为待翻译项。通过变量间接引用或业务 JSON 中新增的界面文案，应显式补入中文词典；扫描器不执行代码来猜测动态来源。

`--` 是 pnpm 参数分隔符；直接执行也可使用 `node scripts/i18n-workflow.mjs translate --locale ja --limit 50 --write`。

扫描清单、源文指纹、子 agent 任务、提示词和结果保存在被忽略的 `artifacts/i18n/tasks/`。首次扫描将已有人工译文登记为基线；之后中文值变更会进入 `source-changed` 清单。换电脑或删除该目录会丢失此基线；需要保留该目录，或在修改中文值前先扫描一次。中文键自身变更视为新文案，旧键不会被自动删除。

## 独立翻译子 agent

`i18n:translate` 自动扫描，默认选择最多 50 条缺失文案，通过本机真实 `codex exec` 启动专用只读翻译子 agent。每批最多 100 条；后续重复执行只处理余下缺失条目。可使用 `--locale en`、`--locale ru`、`--locale ja`。没有缺失项就立即退出，不调用模型。

子 agent 收到本批源文、位置、已有其他语言译文、战雷术语和短标签长度限制。它只返回本批键值结果，不能修改仓库。实际调用使用 `--sandbox read-only --ephemeral --output-schema ... --output-last-message ...`，默认不指定模型，沿用现有本机 Codex 配置和认证，不复制密钥。需已安装 Codex CLI 并完成登录；`codex exec --help` 可核对当前 CLI 参数。每批有 10 分钟上限，失败保留任务文件，译文不会合并。

父脚本在写入前验证：目标 locale、键集合与重复键、完整批次、中文源文哈希、现有译文哈希、数字、重复占位符、控制字符、非日文中的残留汉字、重要短标签长度。并发人工修改会使该批合并失败，避免覆盖人工成果。只有全部验证通过后才原子写入目标语言文件。普通批次不处理已翻译的源文变更项。

`i18n:check` 检查完整性和格式，列出与首选战雷术语不同的核心独立词条供人工复核。术语警告保留正确语境变体，不擅自覆盖已审校译文。日语允许汉字；不要把“含汉字”当成日文未翻译。数字校验比较数值，允许中文万/亿、千位分隔符、俄语小数逗号、10k / million、百万像素以及折/割与百分比等价表达；也识别“北京时间→UTC+8”“每页→1ページ”等明确隐含数量。新增未知数字或改变数值仍使检查失败。文字数字和计数表达用于匹配对应数字，不替代翻译语义审校。金额本身仍由应用格式化和计算，不由翻译改写。检查会一次列出所有数值/格式错误并返回失败；术语变体仅提示人工复核。

## 审校已有文案变更

```sh
node scripts/i18n-workflow.mjs prepare --locale ja --review-source-changes --limit 50
```

任务与 `.prompt.txt` 可交给当前协作环境中的专用翻译子 agent，也可运行同参数的 `translate --review-source-changes` 取得结果。已译源变更的结果默认仅保留供审校，不自动覆盖。审校后应用：

```sh
node scripts/i18n-workflow.mjs apply \
  --task artifacts/i18n/tasks/ja-TIMESTAMP.json \
  --result artifacts/i18n/tasks/ja-TIMESTAMP.result.json \
  --reviewed
```

所有命令只维护文案与本地任务文件，不自动提交、不发布。完成审校后再运行仓库检查、构建，并按用户授权部署。
