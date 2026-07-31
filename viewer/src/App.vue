<script setup>
import { onMounted, ref, provide } from 'vue';
import './App.css';
import AccountsView from "./views/AccountsView.vue";
import MainView from "./views/MainView.vue";
import LoadingSpinner from "./components/Common/Widgets/LoadingSpinner.vue";

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
provide("disconnect", onMainViewDisconnect)
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
  />
</template>

<style lang="scss">
@font-face {
  font-family: "Color Emoji";
  src: url("#{$base-url}QQ/fonts/AppleColorEmoji.ttf") format('truetype');
  unicode-range: U+1F300-1F5FF, U+1F600-1F64F, U+1F680-1F6FF, U+2600-26FF, U+2700-27BF;/*不包含空白符及数字*/
}

@font-face {
  font-family: "Color Emoji Fix";
  src: url("#{$base-url}QQ/fonts/AppleColorEmoji-fix.ttf") format('truetype');
}
</style>