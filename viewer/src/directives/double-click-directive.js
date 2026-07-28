// double-click-directive.js

import { isFunction } from "../scripts/types-util.js";

const vDoubleClick = {
  mounted(el, binding) {
    installHandler(el, binding);
  },
  unmounted(el) {
    uninstallHandler(el);
  }
};

function installHandler(el, binding) {
  let clicks = 0;
  let timer = null;
  const opts = binding.value || {};
  const delay = opts.delay || 300;

  const handleClick = (originalEvent) => {
    clicks++;

    if (clicks === 1) {
      timer = setTimeout(() => {
        // 单击回调
        if (opts.singleClick) {
          opts.singleClick(originalEvent);
        }
        clicks = 0;
      }, delay);
    } else {
      // 双击触发
      clearTimeout(timer);
      if (isFunction(opts)) {
        // 直接传函数的兼容写法
        opts(originalEvent);
      } else if (opts.doubleClick) {
        opts.doubleClick(originalEvent);
      }
      clicks = 0;
    }
  };

  el._clickHandler = handleClick;
  el.addEventListener('click', handleClick);
}

function uninstallHandler(el) {
  if (el._clickHandler) {
    el.removeEventListener('click', el._clickHandler);
    delete el._clickHandler;
  }
}

export { vDoubleClick };