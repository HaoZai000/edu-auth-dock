# edu-auth-dock

教务系统**登录脚本**仓库。按学校存放，一所学校一份 `login.js`：

```
{base}/index/auth_index.json          # 客户端唯一读取的索引
{base}/auth/{schoolId}/login.js       # 登录脚本
```

登录脚本负责「用学号密码把会话登进去」，不负责取数据。取课表仍然由 `edu-ai-dock`
（或拾光仓库）里的适配器脚本完成，两者在同一个 WebView 会话里先后执行。

## 为什么按学校分，而不是按系统类型

登录脚本由 AI 在目标登录页现场分析生成，selector、验证码位置、成功判定都贴合这一所学校。
把「正方经典版」抽成一份通用脚本看似省事，但各校皮肤、统一身份认证、iframe 结构差别很大，
一份脚本覆盖几千所学校的结果通常是每所学校都要再改一次。按学校存放后：

- AI 写出来是什么，仓库里就是什么，不需要人工归类；
- 一所学校失效只影响它自己；
- 新增学校 = 新增一个目录 + 一条索引，和 `edu-ai-dock` 的维护方式一致。

## 索引格式

```json
{
  "version": 1,
  "updated_at": "2026-11-21",
  "schools": [
    {
      "school_id": "FAFU",
      "school_name": "福建农林大学",
      "login_url": "http://jwgl.fafu.edu.cn",
      "captcha": "image",
      "asset_js_path": "auth/FAFU/login.js",
      "verified": true,
      "updated_at": "2026-11-21",
      "note": "正方经典版，直接落在 default2.aspx"
    }
  ]
}
```

- `school_id` 必须与课表适配器仓库里的学校 id 一致（`edu-ai-dock` / 拾光索引的 `id`）。
- `captcha`：`none` / `image` / `slider` / `sms` / `unknown`。
- `verified`：是否在真机上成功登录过。
- `asset_js_path`：仓库内相对路径，必须以 `auth/` 开头、以 `.js` 结尾。

客户端只读这份索引；找不到 `school_id` 时，由用户在 App 里让 AI 现场写一份本机脚本。

## 新增一所学校

1. 建 `auth/{schoolId}/login.js`，按 [CONTRACT.md](CONTRACT.md) 导出 `window.NexioAuth`。
2. 在 `index/auth_index.json` 的 `schools` 里加一条。
3. 跑 `node scripts/check_index.js` 校验索引与文件一致。
4. 真机登录成功后把 `verified` 改成 `true`。

## 镜像

GitHub 是主仓，Gitee 是同构镜像：

- `https://raw.githubusercontent.com/HaoZai000/edu-auth-dock/main`
- `https://gitee.com/com_haooz_account/edu-auth-dock/raw/main`

客户端优先上次成功的远端，失败自动回退另一个。
