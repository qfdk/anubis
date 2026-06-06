const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { resolveInside } = require('../utils');

const BASE = '/etc/fail2ban/jail.d';

test('允许目录内的普通文件名', () => {
    assert.strictEqual(resolveInside(BASE, 'sshd.conf'), path.join(BASE, 'sshd.conf'));
});

test('允许目录内的合法子路径', () => {
    assert.strictEqual(resolveInside(BASE, 'sub/x.conf'), path.join(BASE, 'sub/x.conf'));
});

test('拒绝 ../ 相对路径穿越', () => {
    assert.throws(() => resolveInside(BASE, '../../../.env'), /非法路径/);
});

test('拒绝深层 ../ 穿越到 /etc/passwd', () => {
    assert.throws(() => resolveInside(BASE, '../../../../../../etc/passwd'), /非法路径/);
});

test('拒绝绝对路径', () => {
    assert.throws(() => resolveInside(BASE, '/etc/passwd'), /非法路径/);
});

test('拒绝带后缀拼接的穿越（filter 场景 name.conf）', () => {
    assert.throws(() => resolveInside(BASE, '../../../tmp/evil.conf'), /非法路径/);
});
