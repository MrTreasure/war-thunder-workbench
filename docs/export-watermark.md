# 图片来源暗水印 v1

地图 PNG 生成与战报 PNG 保存均在最终编码前调用 `src/export-watermark.ts`。标识为 `mrtreasure.cc`，直接写入像素，不依赖文件名或图片元数据。

## 两层机制

1. 原始 PNG 的蓝色通道 bit 1 写入重复文字。每像素蓝色最多变化 2 级，可抽取该位平面显示文字。普通提高亮度不等于正确的位平面显影；转换成 JPEG 后，这一层可能被破坏。
2. 纹理块的亮度 DCT 系数对写入重复 QIM。16 像素步长、8×8 取样，系数为 (1,2)/(2,1)，量化步长 64；仅对亮度标准差至少 8 的不透明块操作。`CRC32("WT1:mrtreasure.cc")` 为登记的来源编号，4 字节拆为 8 个半字节，经 Hamming(7,4) 编码形成 56 位；按固定空间散列重复。检测使用累积软投票和合法码字匹配，再核对登记编号。该层用于常见原尺寸 JPEG 压缩后的来源检测。

这是低可见度来源提示，不是密码学签名。任何拥有方法的人或 Agent 都可检测，不能限制为只有 Agent 能读。任意重度压缩、缩放、裁剪、截图重排或色彩重绘不保证保留；几何变换会改变采样位置。不能从两个样本推广为对所有图片/平台的保证。

战报页面还包含低可见度文字层供截图增强观察；可靠检测以应用实际导出的图片为准。原始地图和用户背景不改写，最终生成的副本带水印。地图草稿/OPFS/JSON 不变。

## Agent 检测

本机已具备 Python、NumPy、FFmpeg / ffprobe，无需打开浏览器：

```sh
python3 scripts/reveal-watermark.py image.png
python3 scripts/reveal-watermark.py image.png --channel-out revealed.png
python3 scripts/reveal-watermark.py compressed.jpg
```

`verified=true` 表示软解码后的完整来源编号匹配登记值；`watermark` 返回域名。`candidate` 仅是高相关候选，不能把它当作已通过完整解码。`blockAgreement` 是块匹配率，不是法律意义的置信度。工具不会发出网络请求。

新增来源编号需升级登记和检测表；不能仅修改显示文字而沿用来源编号。当前仅登记 mrtreasure.cc。

## 核对记录

实际像素核对产物在忽略目录 `artifacts/watermark-review/`，包含原图、写入图、JPEG 多档压缩、蓝色通道显影及 results.json。样本为真实地形图与暗色界面图；直接调用生产像素写入函数，未运行浏览器自动化。显影层单独核对，压缩保留边界按实际结果记录。

构建、类型及原地图检查仍需通过。UI 及各用户图片的视觉验收由用户完成，不承诺所有人/所有显示器完全不可察觉。

背景阅读：[blind_watermark 作者的开源实现与攻击示例](https://github.com/guofei9987/blind_watermark)。本项目采用上文登记的独立像素方案，检测参数以本文件和代码为准。

### 本轮实测边界

两张样本的原始 PNG、FFmpeg JPEG q3 / q5（4:2:0）均完整检出来源编号；q10 / q15 未通过完整校验。这里的 q 是 FFmpeg 编码参数，不能换算为其他软件的质量百分比。未写入的对照图均未通过检测。写入后 PSNR 分别约 46.49 dB、46.24 dB；该指标不代替肉眼验收。未声称已验证缩放、裁剪、截图或社交平台二次转码。
