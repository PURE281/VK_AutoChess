# 自定义皮肤制作指南

在这里给角色做皮肤（纯外观，不影响数值）。皮肤本质就是**换贴图**——模型的网格、骨骼、动画全部复用，你只需要改画贴图。

## 快速开始（5 分钟）

```bash
# 1. 提取角色贴图模板（以洛基 101003 为例，皮肤文件夹命名为 my-skin）
python tools/extract_skin_template.py 101003 my-skin

# 2. 用任意画图软件编辑生成的 PNG：
#    public/assets/skins/101003/my-skin/body.png   身体/衣服/头发/武器贴图集
#    public/assets/skins/101003/my-skin/face.png   脸部贴图（眼睛眉毛嘴）

# 3. 重新生成皮肤清单
python tools/build_custom_skins.py

# 4. 重启 dev server 或部署后，在图鉴/详情面板的"外观"里就能看到你的皮肤（带"自"标记）
```

## 规则与技巧

- **不要移动贴图里任何区域的位置**——UV 布局是固定的，只能在原位置改画颜色/图案。移动区域会导致贴图错乱。
- `body.png` 是一张"拼版"：头发、每件衣服、武器各占一块区域。想改哪部分就在哪块上画。比如洛基：左上黑发区、右侧金色铠甲区、左下绿色装饰区。
- `face.png` 是可选的——不想改脸就只留 body.png（删掉 face.png 即不覆盖）。
- 可选 `icon.png`：换装选择器里的缩略图，不放就用角色原图标。
- `skin.json` 里可以改显示名和作者：`{"name": "我的皮肤名", "author": "你的名字"}`

## 参考示例

`101003/demo-gold/` 是一个现成的演示皮肤（赤红洛基）：把原贴图的黄色系改成红色系的效果。不想要可以直接删除该文件夹再跑 build_custom_skins.py。

## 部署注意

皮肤文件在 `public/assets/` 里，和其他美术资源一样需要上传 R2 才能在线上生效：

```bash
python tools/upload_r2.py   # 全量上传；或手动把 skins 目录传上去
```

本地开发（npm run dev）直接生效，不需要上传。
