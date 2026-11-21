# edu-auth-dock

教务系统**登录脚本**仓库。与 `edu-ai-dock`（课表 / 考试 / 成绩抽取脚本）配对使用：
登录脚本负责「把人送进系统」，抽取脚本负责「把数据拿出来」，两者在同一个页面上下文里拼接执行。

## 为什么不放进 edu-ai-dock

因为复用粒度完全不同：

| | 登录脚本 | 抽取脚本 |
|---|---|---|
| 按什么分 | **系统类型**（正方经典版 / 正方 V9 / 强智 / URP / CAS） | **学校** |
| 一份覆盖 | 几千所学校 | 一所学校 |
| 变更频率 | 低（页面结构几年不变） | 高（学校每学期都在调接口） |

一个学校 = `auth/{authId}` + `edu-ai-dock` 里的 `resources/{schoolId}`。
登录脚本写一次，全国所有跑同一套教务代码的学校共用 —— 这是这件事的全部意义。

## 目录

```
auth/{authId}/
  meta.yaml      声明：叫什么、怎么匹配、验证码类型、注意事项
  login.js       运行时脚本（契约见 CONTRACT.md）
index/
  auth_index.json   CI 从 auth/*/meta.yaml 编出来的清单，客户端只读这一份
scripts/
  build_index.js    生成上面那份索引
```

## 加一个登录器

1. 建 `auth/{authId}/`
2. 写 `meta.yaml`：`match` 里的条件要能把它和别的系统区分开
3. 写 `login.js`，导出 `window.NexioAuth`（四个方法，见 `CONTRACT.md`）
4. 想验证就打开目标学校的登录页，按 README 末尾的「自测」跑一遍
5. 执行 `node scripts/build_index.js`，提交

## 已知登录器

| authId | 系统 | 特征 | 验证码 |
|---|---|---|---|
| `zf-classic` | 正方教务 经典版 | 登录页 `default2.aspx`，会话 ID 在 URL 路径 `/(sid)/` | 图片 |
| `zf-v9` | 正方教务 V9 | 登录页 `jwglxt/xtgl/login_slogin.html` | 图片 / 无 |
| `qz-default` | 强智科技 | 登录页 `loginToXk`，`#yhm` / `#mm` | 图片 |

## 自测

在浏览器打开目标登录页（F12），把 `auth/{authId}/login.js` 全文粘进 Console，然后：

```js
await NexioAuth.probe({})                                   // 'expired' 才对
await NexioAuth.prepare({}, { account: '学号', password: '密码' })
// 手动输验证码
await NexioAuth.submit({}, { captcha: 'abcd' })
await NexioAuth.verify({})                                  // { ok: true }
```

四步全过，这个登录器就能用。
