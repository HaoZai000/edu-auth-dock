# 登录脚本契约

客户端把「登录脚本」和「抽取脚本」拼成一个可执行文件，注入 WebView 同源执行。
这里定义两边都不能改的部分。

## 一、运行时

- 环境：教务系统页面**同源**的 WebView，`document` / `fetch` / `location` 可用
- 注入时机：页面 `onPageFinished` 之后（DOM 已就绪），或路由切换后
- 脚本形态：单个 IIFE，无 `import` / `export`，**不许有模块语法**（没有打包器）

## 二、登录脚本必须导出 `window.NexioAuth`

```js
window.NexioAuth = {
  id: 'zf-classic',          // 与 auth/{authId} 一致
  captcha: 'image',          // none | image | slider | sms | unknown
  selectors: { ... },        // 可选，调试与「用户在页面上手输」时要用
  probe(ctx),                // 只读探测登录态
  prepare(ctx, credential),  // 填账号密码，**不提交**
  submit(ctx, opts),         // 提交（opts.captcha 可能为 null）
  verify(ctx),               // 判定是否真的进去了
}
```

### probe(ctx) → Promise<'alive' | 'expired' | 'unknown'>

**只读，不许发登录请求，不许改页面。**
判定看 DOM 特征，不看状态码 —— 教务系统登出通常是 200 + 登录表单，状态码永远「成功」。

```js
if (document.querySelector('input[type=password]')) return 'expired';
if (document.querySelector('a[href*="xs_main.aspx"]')) return 'alive';
return 'unknown';
```

### prepare(ctx, credential) → Promise<{ ok, ... }>

把 `credential.account` / `credential.password` 填进输入框。

- **必须**触发 `input` 与 `change` 事件，否则 Vue/React 系的登录页收不到值
- **不许**在这里点提交（验证码还没填）
- 有身份单选（学生/教师/部门）时在这里选中

### submit(ctx, opts) → Promise<{ ok, error? }>

`opts.captcha` 由用户提供，可能为 `null`（无验证码系统）。
只做「填验证码 + 点提交」，**不要轮询等待跳转** —— 跳转由 `verify` 判定。

### verify(ctx) → Promise<{ ok, message?, url? }>

提交后调用。成功必须满足「真的进了系统」，不能只看「没有报错」：

- 登录页特征消失（没有 `input[type=password]`）
- 且出现已登录特征（主框架 / 用户名问候）

失败时把页面上的报错原文放进 `message`，别自己编。

## 三、抽取脚本导出 `window.NexioFetch`

```js
window.NexioFetch = window.NexioFetch || {};
window.NexioFetch.timetable = async function (ctx) { ... };
window.NexioFetch.exam      = async function (ctx) { ... };
window.NexioFetch.score     = async function (ctx) { ... };
```

任务名固定三个：`timetable` / `exam` / `score`。缺哪个就少导出一个，客户端按存在性决定能不能跑。

## 四、ctx 由客户端注入

字段名与 `edu-ai-dock` 现有的 `shiguangBridge` 保持一致，避免两份上下文：

| 字段 | 说明 |
|---|---|
| `ctx.task` | 本次要做的事：`login` / `timetable` / `exam` / `score` |
| `ctx.credential` | `{ account, password }`，**只在登录时给**，其它任务为 null |
| `ctx.captcha` | 用户输入的验证码字符串，可能为 null |
| `ctx.saveCourses(list)` | 课程落库（现有桥，字段名不要改） |
| `ctx.sleep(ms)` | 等待 |
| `ctx.log(msg)` | 写进调试日志 |

## 五、拼接规则（客户端实现）

客户端按 `school_index` 找到「登录器 id + 抽取脚本列表」，拼成：

```js
(function () {
  "use strict";
  /* ===== auth/{authId}/login.js 全文 ===== */

  /* ===== resources/{schoolId}/{task}.js 全文（可能多份） ===== */

  window.__nexioEntry = async function (ctx) {
    var task = ctx.task;

    // 1. 只做登录：prepare → 用户填验证码 → submit → verify
    if (task === "login") {
      var st = await NexioAuth.probe(ctx);
      if (st === "alive") return { ok: true, already: true };
      await NexioAuth.prepare(ctx, ctx.credential);
      if (NexioAuth.captcha !== "none" && !ctx.captcha) {
        return { ok: false, needCaptcha: true, selectors: NexioAuth.selectors };
      }
      var sub = await NexioAuth.submit(ctx, { captcha: ctx.captcha });
      if (!sub.ok) return { ok: false, error: sub.error };
      return await NexioAuth.verify(ctx);
    }

    // 2. 其它任务：先确保登录态，再抽数据
    var state = await NexioAuth.probe(ctx);
    if (state !== "alive") {
      if (!ctx.credential) {
        return { ok: false, needLogin: true };
      }
      await NexioAuth.prepare(ctx, ctx.credential);
      if (NexioAuth.captcha !== "none" && !ctx.captcha) {
        return { ok: false, needCaptcha: true, selectors: NexioAuth.selectors };
      }
      var s2 = await NexioAuth.submit(ctx, { captcha: ctx.captcha });
      if (!s2.ok) return { ok: false, error: s2.error };
      var v = await NexioAuth.verify(ctx);
      if (!v.ok) return { ok: false, error: v.message || "登录失败" };
    }

    var fn = NexioFetch[task];
    if (!fn) return { ok: false, error: "这个学校没有 " + task + " 脚本" };
    return await fn(ctx);
  };
})();
```

关键的三个返回值约定，客户端必须处理：

| 返回值 | 含义 | 客户端动作 |
|---|---|---|
| `{ needCaptcha: true, selectors }` | 只差验证码 | 显示验证码图片 + 输入框，用户填完重新执行 |
| `{ needLogin: true }` | 没有可用凭据 | 提示用户去登录一次 |
| `{ ok: true }` | 完成 | 收数据 |

## 六、写脚本时最容易踩的坑

1. **会话 ID 不要写死**。不少正方部署把 sessionId 编进 URL（`/(a1b2c3)/default2.aspx`），每次访问都会换。
   一律从 `location.pathname` 动态取前缀，不要硬编码。
2. **表单要真的触发事件**。光 `el.value = x` 在 Vue/React 页面上等于没填。
3. **验证码一律交给用户**。不许 OCR、不许打码平台、不许猜。
4. **不要用 `alert` 的文案判断成功失败**，各校文案不统一；用页面结构判断。
5. **frame / iframe**：老正方是 `<frame>` 套页，新版本是 iframe。先确认元素在当前 document 里，
   不在就用 `contentDocument` 进去找一层。
