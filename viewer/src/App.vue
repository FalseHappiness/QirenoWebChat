<script setup>
import { onMounted, ref } from 'vue';
import './App.scss';
import AccountsView from "./views/AccountsView.vue";
import MainView from "./views/MainView.vue";
import LoadingSpinner from "./components/Common/LoadingSpinner.vue";

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
  <LoadingSpinner v-if="currentView === 'loading'"/>

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
</style>