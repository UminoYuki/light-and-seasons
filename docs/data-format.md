# 数据格式说明

Light and Seasons 把整份作品集存成一份 JSON，放在 SQLite 单行表里；照片原图单独存放。程序不读取 Obsidian 笔记库里的原图。

## 本地存储

默认目录是项目下的 `data/`，可用环境变量 `DATA_DIR` 改到别处。

| 路径 | 说明 |
| --- | --- |
| `data/portfolio.sqlite` | 作品集数据库，首次运行时自动创建 |
| `data/uploads/<文件名>` | 上传的原图（JPEG / PNG / WebP） |
| `data/uploads/<文件名>.json` | 该文件的 `contentType` 等 HTTP 元数据 |
| `data/server.log`、`data/server-error.log` | 本地后台启动时的日志 |

数据库结构（见 `migrations/0001_initial.sql`）：

```sql
CREATE TABLE IF NOT EXISTS portfolio (
  id INTEGER PRIMARY KEY CHECK(id=1),
  version INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL
);
```

表中始终只有 `id = 1` 的一行。`body` 是下面的 JSON；`version` 用于并发保存，`PUT /api/portfolio` 必须带上当前版本，不匹配时返回 409。

云端部署时，同一份 JSON 放在 D1，原图放在 R2，字段含义不变。

## JSON 结构

```json
{
  "profile": {
    "name": "yuki",
    "tagline": "在寻常里，留住片刻。",
    "bio": "……",
    "camera": "Sony A6700",
    "lens": "Sony FE 70–200mm GM II · 1.4× 增距镜"
  },
  "series": [],
  "photos": []
}
```

读取接口还会附带整数 `version`。保存时把它原样交回，不要改。

### `profile`

全部字段必须是字符串，每个不超过 4000 个字符。

| 字段 | 说明 |
| --- | --- |
| `name` | 显示名称 |
| `tagline` | 一句短介绍 |
| `bio` | 关于页正文 |
| `camera` | 默认机身，新建系列时可作初值 |
| `lens` | 默认镜头，新建系列时可作初值 |

首次运行若数据库为空，会写入一份默认个人资料。可在管理后台修改。

### `series`

最多 500 个系列。每个系列包含：

| 字段 | 约束 | 说明 |
| --- | --- | --- |
| `id` | 1–80 个字符，仅字母、数字、下划线、连字符，且唯一 | 系列 ID |
| `title` | 非空字符串，不超过 3000 个字符 | 系列名称 |
| `description` | 字符串，不超过 3000 个字符 | 说明 |
| `location` | 字符串，不超过 3000 个字符 | 地点 |
| `camera` | 字符串，不超过 3000 个字符 | 该系列使用的机身 |
| `lens` | 字符串，不超过 3000 个字符 | 该系列使用的镜头 |
| `category` | 字符串，不超过 3000 个字符 | 主题分类，用于首页筛选 |
| `year` | 字符串，不超过 3000 个字符 | 年份展示 |
| `published` | 布尔值 | `false` 为草稿，只在管理后台可见 |
| `cover` | 空字符串，或属于本系列的照片 `id` | 封面 |

### `photos`

最多 10000 张。每张照片包含：

| 字段 | 约束 | 说明 |
| --- | --- | --- |
| `id` | 1–80 个字符，仅字母、数字、下划线、连字符，且唯一 | 照片 ID |
| `seriesId` | 必须指向已有系列 | 所属系列 |
| `url` | 必须匹配 `/media/<文件名>`，且来自上传接口 | 访问路径 |
| `title` | 字符串，不超过 1000 个字符 | 标题 |
| `date` | 字符串，不超过 1000 个字符 | 拍摄日期，建议 `YYYY-MM-DD` |
| `focal` | 字符串，不超过 1000 个字符 | 焦距，例如 `200 mm` |
| `aperture` | 字符串，不超过 1000 个字符 | 光圈，例如 `f/4` |
| `shutter` | 字符串，不超过 1000 个字符 | 快门，例如 `1/1000 s` |
| `iso` | 字符串，不超过 1000 个字符 | ISO |
| `camera` | 字符串，不超过 1000 个字符 | 机身；可留空并沿用系列器材 |
| `lens` | 字符串，不超过 1000 个字符 | 镜头；可留空并沿用系列器材 |
| `location` | 字符串，不超过 1000 个字符 | 地点说明 |
| `lat` | `null`，或不超过 ±90 的有限数字 | GPS 纬度 |
| `lng` | `null`，或不超过 ±180 的有限数字 | GPS 经度 |

`url` 不能改成外链。上传接口根据文件头识别 JPEG / PNG / WebP，单张不超过 20 MB，保存为 UUID 文件名。

未发布系列里的照片，即使知道 URL，未登录也无法访问。

## 可见性

- `GET /api/portfolio` 只返回 `published` 为 `true` 的系列及其照片
- `GET /api/portfolio?admin=1` 返回全部资料，需要管理员会话
- 本地管理员会话在访问 `/admin` 时以 HttpOnly Cookie 建立，仅本机有效
