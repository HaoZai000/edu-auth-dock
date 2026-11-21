#!/usr/bin/env node
/**
 * 校验 index/auth_index.json 与 auth/ 目录是否一致。
 *
 * 这个仓库有两份「真相」：meta.yaml 给人看，auth_index.json 给客户端读。
 * 两份一旦漂移，客户端会按索引去拉一个不存在的脚本，或者漏掉新加的登录器 —— 都是静默故障。
 * 所以每次提交前跑一遍。
 *
 * 零依赖：meta.yaml 只取几个顶层标量，用正则足够；不需要引入 YAML 解析器。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index', 'auth_index.json');
const AUTH_DIR = path.join(ROOT, 'auth');

function readScalar(yaml, key) {
  const re = new RegExp('^' + key + '\\s*:\\s*"?([^"\\n]+)"?\\s*$', 'm');
  const m = yaml.match(re);
  return m ? m[1].trim() : '';
}

function main() {
  const errors = [];
  const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  const indexed = new Map((index.auths || []).map((a) => [a.auth_id, a]));

  const dirs = fs
    .readdirSync(AUTH_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const name of dirs) {
    const metaPath = path.join(AUTH_DIR, name, 'meta.yaml');
    if (!fs.existsSync(metaPath)) {
      errors.push(`auth/${name}: 缺少 meta.yaml`);
      continue;
    }
    const meta = fs.readFileSync(metaPath, 'utf8');
    const authId = readScalar(meta, 'auth_id');
    const assetJs = readScalar(meta, 'asset_js_path');

    if (authId !== name) {
      errors.push(`auth/${name}: meta.yaml 里 auth_id 是 "${authId}"，与目录名不一致`);
    }
    if (!indexed.has(name)) {
      errors.push(`auth/${name}: 没有出现在 index/auth_index.json 里`);
    }
    if (assetJs && !fs.existsSync(path.join(AUTH_DIR, name, assetJs))) {
      errors.push(`auth/${name}: meta.yaml 指向的 ${assetJs} 不存在`);
    }
  }

  for (const [authId, entry] of indexed) {
    if (!dirs.includes(authId)) {
      errors.push(`index 里的 "${authId}" 在 auth/ 下没有对应目录`);
      continue;
    }
    const jsPath = path.join(ROOT, entry.asset_js_path || '');
    if (!entry.asset_js_path || !fs.existsSync(jsPath)) {
      errors.push(`index 里的 "${authId}" 指向的脚本不存在：${entry.asset_js_path}`);
    }
    if (entry.verified === true) {
      const meta = fs.readFileSync(path.join(AUTH_DIR, authId, 'meta.yaml'), 'utf8');
      if (readScalar(meta, 'verified') !== 'true') {
        errors.push(`auth/${authId}: index 标了 verified 但 meta.yaml 没标`);
      }
    }
  }

  if (errors.length) {
    console.error('索引与目录不一致：');
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log(`OK：${dirs.length} 个登录器（其中 ${(index.auths || []).filter((a) => a.verified).length} 个已实测）`);
}

main();
