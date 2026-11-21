/**
 * 正方教务 V9 —— 待实现骨架。
 *
 * 只声明 id 与 captcha，四个方法全部明确抛错/返回失败，避免客户端误以为能用。
 * 补全步骤见同目录 meta.yaml 的 notes。
 */
(function () {
  'use strict';

  var NOT_READY = 'zf-v9 登录器尚未实现：请先在一所 V9 学校实测 selector 与成功判定';

  window.NexioAuth = {
    id: 'zf-v9',
    captcha: 'unknown',
    selectors: {},

    async probe(ctx) {
      return 'unknown';
    },

    async prepare(ctx, credential) {
      return { ok: false, error: NOT_READY };
    },

    async submit(ctx, opts) {
      return { ok: false, error: NOT_READY };
    },

    async verify(ctx) {
      return { ok: false, message: NOT_READY };
    }
  };
})();
