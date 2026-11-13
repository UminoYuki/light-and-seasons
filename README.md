# Light and Seasons · 光与季

**Light and Seasons · 光与季 —— 本地摄影作品集**：把精选照片按系列陈列出来，在本机管理发布、EXIF 与地图点位。零外部依赖（Node 原生 + 原生前端，不需要 `npm install`）。

## 功能

- **首页网格**：缩略图按主题筛选；系列以地点或主题命名，显示年份及真实照片张数
- **系列页**：大幅照片，以及机身、镜头和每张照片的焦距 / 光圈 / 快门 / ISO
- **最近作品**：按拍摄日期排列；大图浏览支持左右方向键、Esc 和焦点恢复
- **GPS 地图**：根据照片坐标定位，并提供 OpenStreetMap 位置链接；缺少坐标不生成点位
- **关于页**、明暗模式、手机菜单和单列展示
- **管理后台**：新建、修改、排序、删除系列，草稿 / 发布，上传多张照片，封面与排序，EXIF / GPS 编辑，个人资料编辑
- **EXIF**：JPEG 自动提取焦距、光圈、快门、ISO、拍摄日期和 GPS。PNG / WebP 可上传，元数据可手填。没有 EXIF 的图片不伪造参数
- 数据持久化、写入鉴权、来源验证、版本冲突检测、上传大小及文件头检查，草稿文件访问保护

## 运行

需要 [Node.js](https://nodejs.org/) 22.13 或更高版本。

```
git clone https://github.com/UminoYuki/light-and-seasons.git
cd light-and-seasons
npm start
```

然后打开：

- 展示页：<http://127.0.0.1:4173>
- 管理后台：<http://127.0.0.1:4173/admin>

Windows 下也可以双击 `start.bat`。服务在后台运行，关闭启动窗口不会停止它；重复启动会复用已运行的服务。电脑重启后需要再次启动。

本地服务仅监听 `127.0.0.1`，不对局域网开放。打开 `/admin` 会建立仅本机可用的 HttpOnly 管理会话。不适合作为开放公网的 Node 服务直接部署。

其他命令：

- 测试：`npm test`
- 开发（文件变更自动重启）：`npm run dev`
- 构建云端 Worker：`npm run build`

## 第一次使用

1. 打开管理后台，创建“鸟”“日常”等系列。
2. 填写名字、年份、一句话说明，以及机身和镜头。
3. 多选上传照片（JPEG / PNG / WebP，单张不超过 20 MB）。建议每组先放 6 张左右。
4. 点击“编辑”检查 EXIF、拍摄日期及 GPS，再设置封面、调整顺序。
5. 勾选“发布这个系列”并保存。草稿只在后台可见。

首页空白时显示明确标注的 Unsplash 版式示例，不会把示例存进你的资料。首次发布自己的系列后示例自动消失。

## 配置

用环境变量覆盖默认值，不必另建配置文件：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `4173` | 监听端口 |
| `DATA_DIR` | 项目目录下的 `data/` | 数据库和上传照片的目录 |

例如：

```powershell
$env:PORT=4178
$env:DATA_DIR="$HOME\light-and-seasons-data"
npm start
```

## 数据与备份

作品集以一份 JSON 存放在 SQLite 的单行表中，照片文件单独放在上传目录。字段与约束见 [数据格式说明](docs/data-format.md)。

`data/`（本地数据库和上传原图）不入库。备份时先停止服务，再复制整个 `data` 文件夹；恢复时将其放回项目目录（或你设置的 `DATA_DIR`）。照片从系列移除后，原图仍保留在存储中，避免误删；目前没有自动清理孤立文件的功能。

原图会保留 EXIF，包括可能存在的 GPS。界面上删除坐标只影响地图点位，不改写原图。若要去除原图位置信息，应在上传前用照片工具删除 GPS。

## API

| 请求 | 用途 |
| --- | --- |
| `GET /api/session` | 管理会话状态 |
| `GET /api/portfolio` | 已发布的系列及照片 |
| `GET /api/portfolio?admin=1` | 完整资料，需管理员会话 |
| `PUT /api/portfolio` | 保存资料，需携带当前 `version`；冲突返回 409 |
| `POST /api/upload` | 上传原始图片字节，返回文件 URL，需管理员会话 |
| `GET /media/:key` | 图片；未发布照片仅管理员可见 |

## 在线部署

云端使用 Sites 的登录保护、Cloudflare Worker、D1 与 R2；本地使用 SQLite 和文件系统。在线版本应保持 owner-private：云端管理权限依赖该站点的所有者访问边界。若以后公开展示，需要另加管理员身份白名单，不能直接把当前站点改成多人可访问。

`npm run build` 会把前端和 API 打包为 Worker，并读取 `.openai/hosting.json`。该文件含站点标识，已加入 `.gitignore`，不要提交。可先复制 `.openai/hosting.example.json` 为 `.openai/hosting.json`，填入自己的 Sites project id。云端与本地的数据库和原图不会自动同步。

示例图来自 Unsplash，地图位置可跳转 OpenStreetMap。Google Fonts 仅用于可选中文衬线字体，无法连接时使用系统字体。上传的摄影作品通过自己的服务器提供。

## 项目结构

```
light-and-seasons/
├── public/                 # 前端 HTML、CSS、JS 和 EXIF 读取器
├── server/api.js           # 前后端共用的 JSON API / 上传 / 图片访问接口
├── server/local.mjs        # Node HTTP 服务、SQLite 和本地文件适配器
├── migrations/             # SQLite / D1 数据库结构
├── scripts/start-local.mjs # 后台启动本地服务
├── scripts/build.mjs       # 将前端资源和 API 打包为一个 Worker ES Module
├── test/                   # API 集成测试及 EXIF 测试
├── docs/data-format.md     # 作品集数据格式说明
├── .openai/hosting.example.json  # 云端托管配置模板（hosting.json 不入库）
└── start.bat               # Windows 双击启动
```

## 范围说明

这是一套作品展示与精选管理程序。没有实现 RAW 显影、照片修图、AfterFrame 集成、Obsidian 双向同步、自动备份或照片压缩。天气、光线时段等拍摄记录可先写在系列说明里。
