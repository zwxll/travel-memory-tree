# 旅行年轮树 · 心动回忆

可离线使用的 Three.js 三维相册。照片悬挂在树冠下，支持旋转木马、立体爱心、城市浏览，以及可编辑的信封和年度情书。

公开仓库只提供代码、空白数据模板和使用说明。真实照片、旅行路线、纪念日期、信件、截图及浏览器导出资料均不随仓库上传。

## 使用

首次下载仓库后，在项目目录执行：

```sh
npm run setup
```

也可以手动将 `data/photos.example.js` 和 `data/user-records.example.js` 分别复制为 `photos.js` 和 `user-records.js`。已有本地资料不会被初始化命令覆盖。

双击 `index.html`，使用 Edge 或 Chrome 打开。展示无需服务器、登录或联网。通过左下角“添加城市”导入自己的照片，再保存到本项目文件夹。首次使用没有预置照片或私人故事。

- 拖动旋转，滚轮缩放；右上角可切换木马、爱心、旋转速度及日夜氛围。
- 点击城市高亮对应照片；点击场景空白、树干或地面清除城市筛选，保持当前视角和缩放。
- 点击照片查看完整图片，支持上一张、下一张、缩略图、方向键和 Esc。
- 点击年份查看年度情书与城市路线；可修改城市故事。
- 点击“添加信封”写信。打开已有信件后，点击正文下方的“编辑这封信”修改保存；关闭编辑窗口则保留原内容。
- 尊重系统减少动态效果设置；没有 WebGL 时仍可通过城市列表浏览。

## 本地资料与备份

编辑先保存在当前浏览器。需要备份或换设备时，使用“保存到项目文件夹”或下载资料包，再复制完整的本地项目目录。浏览器缓存不会自动随文件夹一起移动。

照片原文件位于 `photos/`，离线图像与旅行资料位于 `data/photos.js`、`data/user-records.js`；`data/catalog.json` 是可选的本地清单。这些文件均被 Git 忽略。详细约定见 [data/README.md](data/README.md)。

## 开发

需要 Node.js 18 或更高版本：

```sh
npm ci
npm run build
npm test
```

构建直接更新 `assets/tree-runtime.js`，无需再手动复制重复产物。浏览器运行时不需要 Node.js。

`npm test` 使用合成测试资料，检查相册文件、信封和故事存储、两种照片布局及年份路线，不读取私人照片。

提交或上传前执行 `npm run check:public`，检查 Git 暂存清单中没有私人数据、图片、压缩备份或凭据。

浏览器回归需要自行安装 Playwright 和 Edge；可向测试脚本传入已有 Playwright 模块路径。例如：

```sh
node tools/city-focus-browser-test.cjs "Playwright 模块路径"
node tools/envelope-browser-test.cjs "Playwright 模块路径"
node tools/mode-browser-test.cjs "Playwright 模块路径"
node tools/album-browser-test.cjs "Playwright 模块路径"
node tools/public-checkout-test.cjs "Playwright 模块路径"
```

场景类浏览器测试需要本地已有照片；`album-browser-test.cjs` 使用临时合成资料；`public-checkout-test.cjs` 只从 Git 文件创建临时副本，验证空白初始化、可重复构建与照片导入入口。测试生成的图片、报告和临时文件不会提交。

## 目录

| 目录或文件 | 用途 |
| --- | --- |
| `index.html` | 离线入口 |
| `assets/` | 启动脚本与打包后的相册 |
| `data/*.example.js` | 可公开的空白资料模板 |
| `src/assets/travel-ring-tree/` | 相册源码、样式、模板及构建脚本 |
| `src/assets/umbrella-canopy/` | 基础场景、花园与本地第三方依赖 |
| `tools/` | 初始化与验收工具 |
| `docs/` | 第三方许可说明；本地截图与历史报告不提交 |

第三方来源与许可证见 [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md)。
