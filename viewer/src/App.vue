<script setup>
import { onMounted, ref } from 'vue';
import './App.scss';
import AccountsView from "./views/AccountsView.vue";
import MainView from "./views/MainView.vue";

const currentView = ref('loading') // 'loading' | 'accounts' | 'main'
const selectedAccount = ref(null)
const forceShowWelcome = ref(false)

// 从 localStorage 读取已保存的账号
const loadSavedAccount = () => {
  try {
    const saved = localStorage.getItem('selectedAccount')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.error('读取保存的账号失败:', e)
  }
  return null
}

onMounted(() => {
  const saved = loadSavedAccount()
  if (saved && saved.autoLogin) {
    // 启用了自动登录，直接进入主界面，不显示 AccountsView
    selectedAccount.value = saved
    currentView.value = 'main'
  } else {
    // 没有已保存账号或未启用自动登录，显示 AccountsView
    currentView.value = 'accounts'
  }
})

const onAccountSelected = (account) => {
  selectedAccount.value = account
  forceShowWelcome.value = false
  currentView.value = 'main'
}

const onMainViewDisconnect = () => {
  selectedAccount.value = null
  currentView.value = 'accounts'
  forceShowWelcome.value = true
}

</script>

<template>
  <!-- 加载中 -->
  <div v-if="currentView === 'loading'" class="loading-view">
    <div class="loading-spinner"></div>
    <p class="loading-text">正在加载...</p>
  </div>

  <AccountsView
    v-else-if="currentView === 'accounts'"
    :force-show-welcome="forceShowWelcome"
    @account-selected="onAccountSelected"
  />
  <MainView
    v-else-if="currentView === 'main' && selectedAccount"
    :account="selectedAccount"
    @disconnect="onMainViewDisconnect"
  />
</template>

<style scoped>
.loading-view {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(0, 0, 0, 0.06);
  border-top-color: #0099ff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-bottom: 14px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: #808080;
  font-size: 14px;
  margin: 0;
}
</style>