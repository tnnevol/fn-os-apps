#!/usr/bin/env node
/**
 * 批量取各应用镜像的默认 USER（运行身份）
 *
 * 用途：
 *   1. 为「属主不匹配」类问题提供权威数据——容器以哪个 uid 写数据，决定卸载时包用户能否删掉；
 *   2. 区分「镜像默认 root，可降权到包用户」与「镜像固定 uid，需用 ACL 授权」两类。
 *
 * 做法：docker manifest inspect --verbose → 取 linux/amd64 的 manifest → config blob → .config.User
 *
 * 用法：node scripts/image-user-audit.mjs [--list <apps.txt>] [--out <csv>]
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const exec = promisify(execFile);
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

const LIST = arg('--list', '');
const OUT = arg('--out', '');
const apps = LIST
  ? fs.readFileSync(LIST, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
  : fs.readdirSync('apps').filter((d) => d.startsWith('fn-')).map((d) => 'apps/' + d);

/** 从 compose 里取镜像名（跳过变量插值的镜像） */
function imageOf(appDir) {
  const f = path.join(appDir, 'app/docker/docker-compose.yaml');
  if (!fs.existsSync(f)) return null;
  const m = fs.readFileSync(f, 'utf8').match(/^\s*image:\s*(\S+)/m);
  return m ? m[1].replace(/^["']|["']$/g, '') : null;
}

/** 取镜像默认 USER */
async function userOf(image) {
  let raw;
  try {
    ({ stdout: raw } = await exec('docker', ['manifest', 'inspect', '--verbose', image], { timeout: 60000, maxBuffer: 64 * 1024 * 1024 }));
  } catch {
    return { user: null, err: 'manifest-failed' };
  }
  let items;
  try { const d = JSON.parse(raw); items = Array.isArray(d) ? d : [d]; }
  catch { return { user: null, err: 'manifest-parse' }; }

  let manifest = null;
  for (const it of items) {
    const p = (it.Descriptor || {}).platform || {};
    if (p.os === 'linux' && p.architecture === 'amd64') { manifest = it; break; }
  }
  if (!manifest) manifest = items[0];
  if (!manifest) return { user: null, err: 'no-manifest' };

  let mj = null;
  if (manifest.OCIManifest) mj = manifest.OCIManifest;
  else if (manifest.Raw) { try { mj = JSON.parse(Buffer.from(manifest.Raw, 'base64').toString('utf8')); } catch { /* ignore */ } }
  const cfgDigest = mj && mj.config && mj.config.digest;
  if (!cfgDigest) return { user: null, err: 'no-config-digest' };

  // 拆出 registry / repo（去掉 tag 与 digest）
  const nameOnly = image.split('@')[0];
  const parts = nameOnly.split('/');
  const last = parts[parts.length - 1].split(':')[0];
  const registry = parts.length > 1 && parts[0].includes('.') ? parts[0] : 'docker.io';
  const repo = registry === 'docker.io'
    ? (parts.length > 1 ? parts.slice(1).join('/').replace(/:[^/]*$/, '') : 'library/' + last)
    : parts.slice(1).join('/').replace(/:[^/]*$/, '');

  const auth = {
    'docker.io': { token: `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull`, host: 'https://registry-1.docker.io' },
    'ghcr.io': { token: `https://ghcr.io/token?scope=repository:${repo}:pull`, host: 'https://ghcr.io' },
    'quay.io': { token: `https://quay.io/v2/auth?service=quay.io&scope=repository:${repo}:pull`, host: 'https://quay.io' },
  }[registry] || { token: `https://${registry}/token?scope=repository:${repo}:pull`, host: `https://${registry}` };

  try {
    const { stdout: tok } = await exec('curl', ['-s', '-m', '20', auth.token]);
    const token = JSON.parse(tok).token || JSON.parse(tok).access_token;
    const { stdout: blob } = await exec('curl', ['-sL', '-m', '30', '-H', 'Authorization: Bearer ' + token,
      `${auth.host}/v2/${repo}/blobs/${cfgDigest}`]);
    const cfg = JSON.parse(blob);
    if (!cfg || !cfg.config) return { user: null, err: 'blob-shape' };
    return { user: cfg.config.User || '' };
  } catch {
    return { user: null, err: 'blob-failed' };
  }
}

const rows = [];
for (const app of apps) {
  const name = path.basename(app);
  const image = imageOf(app);
  if (!image) { rows.push({ app: name, image: '', user: '', note: 'no-compose' }); continue; }
  const r = await userOf(image);
  rows.push({ app: name, image, user: r.user === null ? '' : r.user, note: r.err || '' });
  const u = r.user === null ? `ERR(${r.err})` : (r.user === '' ? 'root(空=默认root)' : r.user);
  console.log(`${name.padEnd(24)} ${String(image).padEnd(38)} ${u}`);
}

if (OUT) {
  fs.writeFileSync(OUT, 'app,image,user,note\n' + rows.map((r) => [r.app, r.image, r.user, r.note].join(',')).join('\n') + '\n');
  console.log('\n已写出 ' + OUT);
}
const bad = rows.filter((r) => r.user && r.user !== 'root');
console.log(`\n镜像默认非 root 的应用：${bad.length} 个 → ${bad.map((r) => r.app + '(' + r.user + ')').join(', ')}`);
