#!/usr/bin/env node
/**
 * 校验 index/auth_index.json 与 auth/ 目录是否一致。
 *
 * 零依赖。检查项：
 *  - 必填字段齐全，school_id 不重复；
 *  - asset_js_path 以 auth/ 开头、以 .js 结尾，文件存在；
 *  - 脚本里确实导出 window.NexioAuth，且包含 probe / prepare / submit / verify；
 *  - auth/ 下每个目录都在索引里，索引里每条都有对应目录。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index', 'auth_index.json');
const AUTH_DIR = path.join(ROOT, 'auth');

function main() {
  const errors = [];
  const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  const schools = index.schools || [];
  const ids = new Set();

  for (const entry of schools) {
    const id = String(entry.school_id || '').trim();
    const script = String(entry.asset_js_path || '').trim();
    if (!id) errors.push('有一条记录缺少 school_id');
    if (ids.has(id)) errors.push(`school_id 重复：${id}`);
    ids.add(id);
    if (!entry.login_url) errors.push(`${id}: 缺少 login_url`);
    if (!['none', 'image', 'slider', 'sms', 'unknown'].includes(entry.captcha)) {
      errors.push(`${id}: captcha 非法（${entry.captcha}）`);
    }
    if (!script.startsWith('auth/') || !script.endsWith('.js') || script.includes('..')) {
      errors.push(`${id}: asset_js_path 必须是 auth/**.js（收到 ${script}）`);
      continue;
    }
    if (!script.startsWith(`auth/${id}/`)) {
      errors.push(`${id}: asset_js_path 必须放在 auth/${id}/ 下`);
    }
    const file = path.join(ROOT, script);
    if (!fs.existsSync(file)) {
      errors.push(`${id}: 脚本不存在 ${script}`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes('window.NexioAuth')) {
      errors.push(`${id}: 脚本没有导出 window.NexioAuth`);
    }
    for (const fn of ['probe', 'prepare', 'submit', 'verify']) {
      if (!new RegExp(`\\b${fn}\\s*\\(`).test(text)) {
        errors.push(`${id}: 脚本缺少 ${fn}()`);
      }
    }
  }

  const dirs = fs
    .readdirSync(AUTH_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  for (const name of dirs) {
    if (!ids.has(name)) errors.push(`auth/${name} 没有出现在索引里`);
  }

  if (errors.length) {
    console.error('索引校验失败：');
    errors.forEach((e) => console.error('  - ' + e));
    process.exit(1);
  }
  console.log(`索引校验通过：${schools.length} 所学校`);
}

main();
