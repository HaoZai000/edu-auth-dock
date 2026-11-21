#!/usr/bin/env node
/**
 * 演示「登录脚本 + 抽取脚本」怎么拼成一个可执行文件。
 *
 * 客户端（Kotlin）要实现的正是这里做的事：取一份 auth/*.js，加上 N 份抽取脚本，
 * 包进同一个 IIFE，末尾挂上任务分发入口 __nexioEntry。
 * 放在仓库里是为了让这段逻辑有唯一出处 —— 客户端照抄，别各自发明。
 *
 * 用法：
 *   node scripts/assemble.js zf-classic ../../edu-ai-dock/resources/FAFU/fafu.js > bundle.js
 *   node scripts/assemble.js zf-classic   # 只要登录能力
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const ENTRY = `
  // ── 任务分发（契约见 CONTRACT.md 第五节）──
  window.__nexioEntry = async function (ctx) {
    var task = ctx.task;

    if (task === "login") {
      var st = await NexioAuth.probe(ctx);
      if (st === "alive") return { ok: true, already: true };
      var prep = await NexioAuth.prepare(ctx, ctx.credential);
      if (!prep.ok) return { ok: false, error: prep.error || "填写账号密码失败" };
      if (NexioAuth.captcha !== "none" && !ctx.captcha) {
        return { ok: false, needCaptcha: true, selectors: NexioAuth.selectors };
      }
      var sub = await NexioAuth.submit(ctx, { captcha: ctx.captcha });
      if (!sub.ok) return { ok: false, error: sub.error };
      return await NexioAuth.verify(ctx);
    }

    var state = await NexioAuth.probe(ctx);
    if (state !== "alive") {
      if (!ctx.credential) return { ok: false, needLogin: true };
      var p2 = await NexioAuth.prepare(ctx, ctx.credential);
      if (!p2.ok) return { ok: false, error: p2.error || "填写账号密码失败" };
      if (NexioAuth.captcha !== "none" && !ctx.captcha) {
        return { ok: false, needCaptcha: true, selectors: NexioAuth.selectors };
      }
      var s2 = await NexioAuth.submit(ctx, { captcha: ctx.captcha });
      if (!s2.ok) return { ok: false, error: s2.error };
      var v = await NexioAuth.verify(ctx);
      if (!v.ok) return { ok: false, error: v.message || "登录失败" };
    }

    var fn = window.NexioFetch && window.NexioFetch[task];
    if (!fn) return { ok: false, error: "这个学校没有 " + task + " 脚本" };
    return await fn(ctx);
  };
`;

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('用法: node scripts/assemble.js <authId> [adapter.js ...]');
    process.exit(1);
  }

  const [authId, ...adapterPaths] = args;
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'index', 'auth_index.json'), 'utf8'));
  const entry = (index.auths || []).find((a) => a.auth_id === authId);
  if (!entry) {
    console.error(`索引里没有 authId=${authId}`);
    process.exit(1);
  }

  const authPath = path.join(ROOT, entry.asset_js_path);
  const parts = [];

  if (!fs.existsSync(authPath)) {
    console.error(`登录脚本不存在：${authPath}`);
    process.exit(1);
  }
  parts.push('  /* ===== ' + entry.asset_js_path + ' ===== */\n' + indent(fs.readFileSync(authPath, 'utf8')));

  for (const p of adapterPaths) {
    const abs = path.resolve(process.cwd(), p);
    if (!fs.existsSync(abs)) {
      console.error(`抽取脚本不存在：${abs}`);
      process.exit(1);
    }
    parts.push('  /* ===== ' + p + ' ===== */\n' + indent(fs.readFileSync(abs, 'utf8')));
  }

  const out =
    '(function () {\n' +
    '  "use strict";\n\n' +
    parts.join('\n\n') + '\n' +
    ENTRY +
    '})();\n';

  process.stdout.write(out);
}

function indent(text) {
  return text
    .split('\n')
    .map((line) => (line.trim() ? '  ' + line : line))
    .join('\n');
}

main();
