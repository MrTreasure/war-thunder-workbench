import hbSDK from '@heybox/hb-sdk';
import './styles.css';

const greetingButton = document.querySelector('[data-testid="greeting-button"]');
const greetingError = document.querySelector('[data-testid="greeting-error"]');
const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');

async function greet() {
  greetingButton.disabled = true;
  greetingButton.setAttribute('aria-busy', 'true');
  greetingError.textContent = '';

  try {
    await hbSDK.ui.showToast({
      message: '欢迎来到小黑盒小程序工坊',
      status: 'success',
    });
  } catch (error) {
    console.error('无法显示欢迎提示', error);
    greetingError.textContent = '欢迎提示无法显示，请重试';
  } finally {
    greetingButton.disabled = false;
    greetingButton.setAttribute('aria-busy', 'false');
  }
}

function syncNavigationBar() {
  hbSDK.viewport
    .setNavigationBarStyle({ foregroundStyle: colorScheme.matches ? 'light' : 'dark' })
    .catch((error) => console.error('无法同步导航栏样式', error));
}

greetingButton.addEventListener('click', greet);
if (typeof colorScheme.addEventListener === 'function') {
  colorScheme.addEventListener('change', syncNavigationBar);
} else if (typeof colorScheme.addListener === 'function') {
  colorScheme.addListener(syncNavigationBar);
}
syncNavigationBar();
