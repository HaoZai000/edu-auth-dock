/**
 * 正方教务 · 经典版（default2.aspx）
 *
 * 已在福建农林大学 jwgl.fafu.edu.cn 实测跑通（2026-11-21，AI 现场登录成功）。
 * 同一套登录页在国内极多学校出现，差别通常只在域名与文案。
 *
 * 特征：
 *  - 登录页 /default2.aspx，表单 POST 回自己
 *  - 会话 ID 编在 URL 路径里：/(a1b2c3d4)/default2.aspx，**每次访问都会变**
 *  - 账号 #txtUserName / 密码 #TextBox2 / 验证码 #txtSecretCode / 按钮 #Button1
 *  - 验证码图片 #icode，点它调 reloadcode() 换一张
 *  - 身份是单选组 RadioButtonList1：部门 / 教师 / 学生 / 访客，学生是 #RadioButtonList1_2
 *  - 登录成功跳 /(sid)/xs_main.aspx?xh=学号，正文出现「欢迎您：xxx同学」
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

  /**
   * 填值并触发事件。
   *
   * 正方本身是纯 DOM 表单，光赋值就够；但同一套页面被很多学校套了 Vue/jQuery 皮肤，
   * 不触发 input/change 的话页面上看着填了、提交时是空的。宁可多触发两个事件。
   */
  function setValue(el, value) {
    if (!el) return false;
    el.value = value;
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      /* 老 WebView 没有 Event 构造器，退化成直接赋值也算成功 */
    }
    return el.value === value;
  }

  function isLoginPage() {
    // 判定只认密码框：登出后正方一定会把 default2.aspx 的登录表单重新渲染出来
    return !!document.querySelector('input[type=password]');
  }

  function loggedInHint() {
    return !!document.querySelector(
      'a[href*="xs_main.aspx"], frame[src*="xs_main"], a[href*="logout"]'
    );
  }

  window.NexioAuth = {
    id: 'zf-classic',
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

      // 身份默认就是「学生」，但别的入口进来可能是教师，显式纠正一次
      var role = document.querySelector(SEL.roleStudent);
      if (role && !role.checked) {
        role.checked = true;
        try {
          role.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
      }

      return {
        ok: okAccount && okPassword,
        account: acc.value,
        passwordLength: pwd.value.length,
        roleStudent: !!(role && role.checked)
      };
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
        // 个别学校把提交按钮做成了 <div onclick>，退化成直接提交表单
        form.submit();
        return { ok: true, via: 'form.submit' };
      }
      return { ok: false, error: '找不到登录按钮，也找不到表单' };
    },

    async verify(ctx) {
      if (isLoginPage()) {
        // 正方失败时是 alert 脚本 + 停在原页，DOM 里一般没有可见错误文案，
        // 只能给出「还停在登录页」这个事实，别编原因
        var tip = document.querySelector('.error, #messagediv, .red, font[color=red]');
        return {
          ok: false,
          message: tip ? String(tip.textContent || '').trim() : '仍停留在登录页，多半是验证码或密码不正确'
        };
      }
      return { ok: true, url: location.href };
    }
  };
})();
