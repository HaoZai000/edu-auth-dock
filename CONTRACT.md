# 登录脚本契约

客户端把登录脚本注入到**登录页同源**的 WebView 里执行。脚本只做四件事：
探测登录态、填账号密码、提交、判定是否真的进去了。

## 一、运行时

- 环境：教务系统登录页同源的 WebView，`document` / `fetch` / `location` 可用。
- 形态：单个 IIFE，没有 `import` / `export` / 顶层 `await`。
- 注入时机：页面加载完成（DOM 就绪）后；发生跳转后需要重新注入。

## 二、必须导出 `window.NexioAuth`

```js
window.NexioAuth = {
  id: 'FAFU',                 // 与 school_id 一致
  captcha: 'image',           // none | image | slider | sms | unknown
  selectors: { ... },         // 调试与页面手输时用
  probe(ctx),                 // 只读探测登录态
  prepare(ctx, credential),   // 填账号密码，不提交
  submit(ctx, opts),          // 填验证码 + 提交
  verify(ctx),                // 判定是否真的进去了
}
```

### probe(ctx) → `'alive' | 'expired' | 'unknown'`

只读，不发登录请求、不改页面。判定看 DOM 特征：

```js
if (document.querySelector('input[type=password]')) return 'expired';
if (document.querySelector('a[href*="xs_main.aspx"]')) return 'alive';
return 'unknown';
```

### prepare(ctx, credential) → `{ ok, error? }`

把 `credential.account` / `credential.password` 填进输入框。

- 必须触发 `input` 与 `change` 事件（Vue / React 页面不触发等于没填）。
- **不要**在这里点提交，验证码还没填。
- 有身份单选（学生 / 教师）时在这里选中。

### submit(ctx, opts) → `{ ok, error? }`

`opts.captcha` 由用户提供，无验证码系统为 `null`。
只做「填验证码 + 点提交」，**不要轮询等待跳转**，也不要在提交后 `await verify()`：
表单 POST 会销毁当前 JS 上下文，同一个函数里等不到结果。

### verify(ctx) → `{ ok, message?, url? }`

提交后、页面跳转完成、脚本重新注入之后再调用。成功必须同时满足：

- 登录页特征消失（没有 `input[type=password]`）；
- 出现已登录特征（主框架、用户名问候、`xs_main.aspx` 等）。

失败时把页面上的报错原文放进 `message`，不要自己编。

## 三、客户端执行顺序

```
打开登录页
  → 注入 login.js
  → probe：alive 直接进入取课表
  → prepare（填账号密码）
  → captcha !== none 且用户还没填：暂停，显示验证码输入框
  → submit（提交）
  → 等待页面跳转完成，重新注入 login.js
  → verify（判定）
  → 注入该校取课表适配器
```

关键点：

| 返回 | 含义 | 客户端动作 |
|---|---|---|
| `needCaptcha` | 只差验证码 | 显示页面 + 验证码输入框，用户填完重新执行 |
| `{ ok: true }` | 登录完成 | 开始取课表 |
| `{ ok: false, error }` | 失败 | 显示原文错误，允许重试或换脚本 |

## 四、写脚本时最容易踩的坑

1. **会话 ID 不要写死**。不少正方把 sessionId 编进 URL（`/(a1b2c3)/default2.aspx`），
   每次访问都会变，一律从 `location.pathname` 动态取。
2. **表单要真的触发事件**。只赋值不派发 `input` / `change`，提交时页面拿到的仍是空值。
3. **验证码交给用户**。不许 OCR、不许打码平台、不许猜。
4. **不要用 alert 文案判断成败**，各校文案不统一；用页面结构判断。
5. **frame / iframe**：老正方是 `<frame>` 套页，新版本是 iframe。先确认元素在当前
   document 里，不在就用 `contentDocument` 进入一层（同源才可行）。
6. **提交会跳转**：`submit` 只负责把表单交出去，判定留给 `verify`。
