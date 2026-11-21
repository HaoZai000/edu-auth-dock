/**
 * 福建农林大学 · 正方教务经典版（default2.aspx）
 *
 * 2026-11-21 实测登录成功。
 *
 * 特征：
 *  - 登录页 /default2.aspx，表单 POST 回自己
 *  - 会话 ID 编在 URL 路径里：/(a1b2c3d4)/default2.aspx，每次访问都会变
 *  - 账号 #txtUserName / 密码 #TextBox2 / 验证码 #txtSecretCode / 按钮 #Button1
 *  - 验证码图片 #icode，src 指向 CheckCode.aspx
 *  - 身份单选 RadioButtonList1：学生是 #RadioButtonList1_2
 *  - 登录成功跳 /(sid)/xs_main.aspx?xh=学号
 */
(function () {
  'use strict';

  var SEL = {
    account: '#txtUserName',
    password: '#TextBox2',
    captcha: '#txtSecretCode',
    submit: '#Button1',
    captchaImg: '#icode',
    roleStudent: '#RadioButtonList1_2'
  };

  /** 填值并派发事件：同一套页面常被学校套了 Vue / jQuery 皮肤。 */
  function setValue(el, value) {
    if (!el) return false;
    el.value = value;
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      /* 老 WebView 没有 Event 构造器，退化成直接赋值 */
    }
    return el.value === value;
  }

  function isLoginPage() {
    return !!document.querySelector('input[type=password]');
  }

  function loggedInHint() {
    return !!document.querySelector(
      'a[href*="xs_main.aspx"], frame[src*="xs_main"], a[href*="logout"]'
    );
  }

  window.NexioAuth = {
    id: 'FAFU',
    captcha: 'image',
    selectors: SEL,

    async probe(ctx) {
      if (isLoginPage()) return 'expired';
      if (loggedInHint()) return 'alive';
      return 'unknown';
    },

    async prepare(ctx, credential) {
      var acc = document.querySelector(SEL.account);
      var pwd = document.querySelector(SEL.password);
      if (!acc || !pwd) {
        return { ok: false, error: '当前页面不是正方登录页，找不到账号或密码输入框' };
      }
      var okAccount = setValue(acc, (credential && credential.account) || '');
      var okPassword = setValue(pwd, (credential && credential.password) || '');

      var role = document.querySelector(SEL.roleStudent);
      if (role && !role.checked) {
        role.checked = true;
        try {
          role.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
      }

      return { ok: okAccount && okPassword };
    },

    async submit(ctx, opts) {
      var code = (opts && opts.captcha) || '';
      var codeEl = document.querySelector(SEL.captcha);
      if (codeEl && code) setValue(codeEl, code);

      var btn = document.querySelector(SEL.submit);
      if (btn) {
        btn.click();
        return { ok: true };
      }
      var form = document.querySelector('form');
      if (form) {
        form.submit();
        return { ok: true, via: 'form.submit' };
      }
      return { ok: false, error: '找不到登录按钮，也找不到表单' };
    },

    async verify(ctx) {
      if (isLoginPage()) {
        var tip = document.querySelector('.error, #messagediv, .red, font[color=red]');
        return {
          ok: false,
          message: tip
            ? String(tip.textContent || '').trim()
            : '仍停留在登录页，多半是验证码或密码不正确'
        };
      }
      return { ok: true, url: location.href };
    }
  };
})();
