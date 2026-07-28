<script setup>
import { onMounted, onUnmounted, ref, computed } from "vue";
import { fetchBackendHealth, fetchBackendBots, getUserLogo } from "../scripts/backend-api.js";
import { renderPolar } from "../QQ/app/scripts/polar.modify.ai-anti-obf.js";
import CustomScrollBar from "../components/Utils/CustomScrollBar.vue";
import { Checkbox as ACheckbox } from 'ant-design-vue'
import { strToBool } from "../scripts/types-util.js";

const props = defineProps({
  forceShowWelcome: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(["account-selected"]);

const enabledBackendDetector = ref(strToBool(import.meta.env.VITE_BACKEND_DETECTOR))
const currentView = ref("loading"); // 'loading' | 'backend' | 'no-backend' | 'welcome'
const backendAlive = ref(false);
const bots = ref([]);

const directConnections = ref([]);
let connIdCounter = 0;
const isSecureContext = ref(false);
const connectingIndex = ref(-1);

const showAddForm = ref(false);
const newConnForm = ref({ wsUri: "", wsToken: "" });

const savedAccount = ref(null);
const autoLoginEnabled = ref(false);

const polar = ref(null);
const STORAGE_KEY = "directConnections";

// 计算属性：是否显示欢迎面板
// 当 forceShowWelcome 为 true 时，强制显示欢迎面板（来自断开连接场景）
const showWelcome = computed(() =>
  savedAccount.value && (!savedAccount.value.autoLogin || props.forceShowWelcome)
);

// 加载已保存的连接
const loadSavedConnections = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        directConnections.value = parsed;
        connIdCounter = Math.max(...parsed.map((c) => c.id || 0), 0);
      }
    }
  } catch (e) {
    console.error("读取保存的连接失败:", e);
  }
};

// 保存连接到 localStorage
const saveConnectionsToStorage = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(directConnections.value));
  } catch (e) {
    console.error("保存连接失败:", e);
  }
};

const saveAccountToStorage = account => {
  try {
    localStorage.setItem("selectedAccount", JSON.stringify(account));
  } catch (e) {
    console.error("保存账户失败:", e);
  }
}

onMounted(() => {
  isSecureContext.value = location.protocol === "https:";
  loadSavedConnections();

  // 检查是否有已保存的账号
  try {
    const saved = localStorage.getItem("selectedAccount");
    if (saved) {
      savedAccount.value = JSON.parse(saved);
      // autoLoginEnabled 默认跟随已保存的 autoLogin 值
      autoLoginEnabled.value = savedAccount.value.autoLogin;
      // 如果 forceShowWelcome 为 true（来自断开连接），跳过自动登录，直接显示欢迎面板
      if (savedAccount.value.autoLogin && !props.forceShowWelcome) {
        emit("account-selected", savedAccount.value);
        return;
      }
    }
  } catch (e) {
    console.error("读取保存的账号失败:", e);
  }

  renderPolar(polar.value);
  checkBackend();
});

onUnmounted(() => {
});

// 添加直连连接
const addDirectConnection = () => {
  showAddForm.value = true;
  newConnForm.value = { wsUri: "", wsToken: "" };
};

const cancelAddConnection = () => {
  showAddForm.value = false;
  newConnForm.value = { wsUri: "", wsToken: "" };
};

const saveNewConnection = () => {
  if (!newConnForm.value.wsUri) {
    alert("请输入 WebSocket 连接地址");
    return;
  }
  directConnections.value.push({
    id: ++connIdCounter,
    wsUri: newConnForm.value.wsUri,
    wsToken: newConnForm.value.wsToken || "",
  });
  saveConnectionsToStorage();
  showAddForm.value = false;
  newConnForm.value = { wsUri: "", wsToken: "" };
};

const removeDirectConnection = (id) => {
  directConnections.value = directConnections.value.filter((c) => c.id !== id);
  saveConnectionsToStorage();
};

// 检测后端
const checkBackend = async () => {
  if (!enabledBackendDetector.value) {
    currentView.value = 'no-backend'
    return
  }
  currentView.value = "loading";
  const alive = await fetchBackendHealth();
  backendAlive.value = alive;

  if (alive) {
    try {
      bots.value = await fetchBackendBots();
      currentView.value = "backend";
    } catch (e) {
      console.error("获取BOT列表失败:", e);
      currentView.value = "no-backend";
    }
  } else {
    currentView.value = "no-backend";
  }
};

// 选择后端BOT
const selectBot = (bot) => {
  const account = {
    mode: "backend",
    self_id: String(bot.self_id || bot.user_id),
    user_id: bot.user_id,
    nickname: bot.nickname,
    autoLogin: autoLoginEnabled.value,
  };
  saveAccountToStorage(account)
  emit("account-selected", account);
};

// 直连连接
const connectDirect = async (index) => {
  const conn = directConnections.value[index];
  if (!conn || !conn.wsUri) {
    alert("连接信息不完整");
    return;
  }

  connectingIndex.value = index;
  try {
    const account = {
      mode: "direct",
      self_id: null,
      user_id: null,
      nickname: conn.nickname || conn.wsUri,
      wsUri: conn.wsUri,
      wsToken: conn.wsToken || "",
      autoLogin: autoLoginEnabled.value,
    };
    saveAccountToStorage(account)
    emit("account-selected", account);
  } catch (e) {
    console.error("直连模式错误:", e);
    alert("连接失败: " + e.message);
  } finally {
    connectingIndex.value = -1;
  }
};

// 使用已保存账号（未自动登录时）
const useSavedAccount = () => {
  if (savedAccount.value) {
    savedAccount.value.autoLogin = autoLoginEnabled.value;
    saveAccountToStorage(savedAccount.value)
    emit("account-selected", savedAccount.value);
  }
};

// 启用自动登录并使用
const enableAutoLoginAndUse = () => {
  if (savedAccount.value) {
    savedAccount.value.autoLogin = true;
    saveAccountToStorage(savedAccount.value)
    emit("account-selected", savedAccount.value);
  }
};

// 清除账号重新选择
const clearAndReselect = () => {
  localStorage.removeItem("selectedAccount");
  savedAccount.value = null;
  autoLoginEnabled.value = false;
  checkBackend();
};
</script>

<template>
  <div class="accounts-view">
    <canvas ref="polar" class="polar"></canvas>
    <div class="accounts-overlay">
      <!-- 加载中 -->
      <div v-if="currentView === 'loading' && !showWelcome" class="account-panel loading-panel">
        <div class="loading-spinner"></div>
        <p class="loading-text">正在检测后端服务...</p>
      </div>

      <!-- 欢迎面板（已保存账号未自动登录） -->
      <div v-else-if="showWelcome" class="account-panel">
        <h2 class="panel-title">欢迎回来</h2>
        <div class="saved-account-card" @click="useSavedAccount">
          <div class="saved-account-avatar">
            <img
              v-if="savedAccount.user_id"
              :src="getUserLogo(savedAccount.user_id)"
              :alt="savedAccount.nickname"
            />
            <div v-else class="avatar-placeholder">🤖</div>
          </div>
          <div class="saved-account-info">
            <div class="saved-account-name">{{ savedAccount.nickname || "未知账号" }}</div>
            <div class="saved-account-mode">
              {{ savedAccount.mode === "backend" ? "后端模式" : "直连模式" }}
            </div>
          </div>
          <div class="saved-account-enter">点击进入</div>
        </div>
        <div class="auto-login-section">
          <a-checkbox v-model:checked="autoLoginEnabled">
            记住此次选择，下次自动登录
          </a-checkbox>
        </div>
        <button class="btn btn--secondary" @click="clearAndReselect">切换账号</button>
      </div>

      <!-- 后端/直连选择面板 -->
      <CustomScrollBar v-else-if="['backend', 'no-backend'].includes(currentView)" class="account-panel">
        <template v-if="currentView === 'backend'">
          <h3 class="panel-title">选择账号</h3>
          <p class="panel-subtitle">已检测到后端服务，请选择要使用的BOT</p>
          <div class="bot-list">
            <div
              v-for="bot in bots"
              :key="bot.self_id"
              class="bot-card"
              @click="selectBot(bot)"
            >
              <div class="bot-avatar">
                <img
                  v-if="bot.user_id"
                  :src="getUserLogo(bot.user_id)"
                  :alt="bot.nickname"
                />
                <div v-else class="avatar-placeholder">🤖</div>
              </div>
              <div class="bot-info">
                <div class="bot-name">{{ bot.nickname || "未知" }}</div>
                <div class="bot-qq">{{ bot.user_id || bot.self_id }}</div>
              </div>
            </div>
            <div v-if="bots.length === 0" class="no-bots">
              <p>暂无已连接的BOT</p>
              <p class="hint">请确保OneBot客户端已连接到此后端</p>
            </div>
          </div>
          <div class="retry-section">
            <button class="btn btn--secondary" @click="checkBackend">刷新后端</button>
          </div>
          <div class="divider" v-if="false"><span>或</span></div>
        </template>

        <template v-else>
          <h3 class="panel-title">连接 OneBot</h3>
          <p class="panel-subtitle" v-if="enabledBackendDetector">未检测到后端服务，可直接连接 OneBot 实例</p>
        </template>

        <!-- 自动登录复选框（统一位置） -->
        <div class="auto-login-wrapper">
          <a-checkbox v-model:checked="autoLoginEnabled">
            记住此次选择，下次自动登录
          </a-checkbox>
        </div>

        <!-- 直连区域 -->
        <div class="direct-connect-section">
          <div class="direct-connect-header">
            <h3>前端直连 OneBot</h3>
            <button class="btn btn--icon" @click="addDirectConnection" title="添加连接">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <p v-if="isSecureContext" class="direct-hint">
            ⚠️ 当前处于安全上下文（HTTPS），请务必使用 <strong>WSS</strong> 加密连接
            或者 <strong>本地回环</strong> 地址
          </p>

          <!-- 添加新连接表单 -->
          <div v-if="showAddForm" class="direct-connection-entry">
            <div class="direct-connection-fields">
              <div class="form-group">
                <label>WebSocket 地址</label>
                <input
                  v-model="newConnForm.wsUri"
                  type="text"
                  placeholder="ws://127.0.0.1:3001"
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label>Token（可选）</label>
                <input
                  v-model="newConnForm.wsToken"
                  type="text"
                  placeholder="OneBot 访问令牌"
                  class="form-input"
                />
              </div>
            </div>
            <div class="direct-connection-actions">
              <button class="btn btn--save" @click="saveNewConnection" :disabled="!newConnForm.wsUri">添加</button>
              <button class="btn btn--cancel" @click="cancelAddConnection">取消</button>
            </div>
          </div>

          <!-- 已保存连接列表 -->
          <template v-if="directConnections.length > 0">
            <div class="saved-connections-list">
              <div
                v-for="(conn, index) in directConnections"
                :key="conn.id"
                class="saved-connection-item"
              >
                <div class="saved-connection-info">
                  <div class="saved-connection-uri">{{ conn.wsUri }}</div>
                  <div v-if="conn.wsToken" class="saved-connection-token">Token: {{ conn.wsToken }}</div>
                </div>
                <div class="saved-connection-actions">
                  <button
                    class="btn btn--connect"
                    @click="connectDirect(index)"
                    :disabled="connectingIndex === index"
                  >
                    {{ connectingIndex === index ? "连接中..." : "连接" }}
                  </button>
                  <button class="btn btn--icon btn--danger" @click="removeDirectConnection(conn.id)" title="删除此连接">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </template>
          <p v-else-if="!showAddForm" class="direct-connect-empty-hint">点击上方 + 按钮添加直连连接</p>
        </div>

        <div v-if="currentView === 'no-backend' && enabledBackendDetector" class="retry-section">
          <button class="btn btn--secondary" @click="checkBackend">重新检测后端</button>
        </div>
      </CustomScrollBar>
    </div>
  </div>
</template>

<style scoped>
/* 基础布局 */
.accounts-view {
  height: 100%;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.polar {
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.accounts-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.account-panel {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  border-radius: 8px;
  padding: 18px 26px;
  max-width: 420px;
  width: 90%;
  max-height: 80vh;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.5);
  height: auto;
}

.panel-title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 600;
  color: #1a1a1a;
  text-align: center;
}

.panel-subtitle {
  margin: 0 0 20px;
  font-size: 13px;
  color: #808080;
  text-align: center;
}

/* BOT 列表 */
.bot-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}

.bot-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}

.bot-card:hover {
  background: rgba(235, 235, 235, 0.5);
  border-color: #dee2e6;
  transform: translateY(-1px);
}

.bot-card:active {
  background: rgba(224, 224, 224, 0.5);
  transform: translateY(0);
}

.bot-avatar,
.saved-account-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(221, 221, 221, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
}

.bot-avatar img,
.saved-account-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 24px;
}

.bot-info {
  flex: 1;
  min-width: 0;
}

.bot-name {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bot-qq {
  font-size: 12px;
  color: #808080;
  margin-top: 1px;
}

.no-bots {
  text-align: center;
  color: #808080;
}

.no-bots .hint {
  font-size: 12px;
  color: #999;
  margin: 4px 0 0;
}

/* 分割线 */
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  color: #808080;
  font-size: 12px;
}

.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: #dee2e6;
}

.retry-section {
  margin-top: 16px;
  text-align: center;
}

/* 保存的账号卡片 */
.saved-account-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-radius: 8px;
  background: rgba(240, 246, 255, 0.7);
  border: 2px solid rgba(0, 153, 255, 0.4);
  cursor: pointer;
  transition: background 0.15s, transform 0.1s, border-color 0.2s, box-shadow 0.2s;
  margin-bottom: 14px;
}

.saved-account-card:hover {
  background: rgba(224, 238, 255, 0.8);
  border-color: #0099ff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 153, 255, 0.1);
}

.saved-account-card:active {
  background: rgba(210, 228, 255, 0.85);
  transform: translateY(0);
}

.saved-account-avatar {
  width: 48px;
  height: 48px;
}

.saved-account-info {
  flex: 1;
}

.saved-account-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.saved-account-mode {
  font-size: 12px;
  color: #0099ff;
  margin-top: 2px;
}

.saved-account-enter {
  font-size: 13px;
  color: #0099ff;
  font-weight: 500;
  white-space: nowrap;
}

/* 自动登录 */
.auto-login-section {
  margin-bottom: 14px;
}

.auto-login-wrapper {
  margin: 10px 0 5px;
  text-align: center;
}

.auto-login-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.auto-login-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #0099ff;
}

.toggle-label {
  font-size: 13px;
  color: #666;
}

/* 加载动画 */
.loading-panel {
  text-align: center;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(0, 0, 0, 0.06);
  border-top-color: #0099ff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin: 0 auto 14px;
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

/* 直连区域 */
.direct-connect-section {
  text-align: left;
}

.direct-connect-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 10px;
}

.direct-connect-header h3 {
  margin: 0;
  font-size: 15px;
  color: #333;
  font-weight: 500;
}

.direct-connect-empty-hint {
  text-align: center;
  color: #808080;
  font-size: 13px;
  margin: 16px 0 0 0;
}

.direct-connection-entry {
  background: rgba(245, 245, 245, 0.5);
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}

.direct-connection-fields .form-group {
  margin-bottom: 8px;
}

.direct-connection-fields .form-group:last-child {
  margin-bottom: 0;
}

.direct-connection-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.saved-connections-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.saved-connection-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  background: rgba(255, 255, 255, 0.5);
  gap: 8px;
}

.saved-connection-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.saved-connection-uri {
  font-size: 13px;
  color: #333;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saved-connection-token {
  font-size: 11px;
  color: #808080;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saved-connection-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.direct-hint {
  font-size: 12px;
  color: #e67e22;
  background: rgba(254, 243, 226, 0.7);
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 14px;
  text-align: left;
}

.form-group {
  margin-bottom: 12px;
  text-align: left;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: #808080;
  margin-bottom: 4px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: rgba(255, 255, 255, 0.6);
  color: #333;
}

.form-input:focus {
  border-color: #0099ff;
  box-shadow: 0 0 0 2px rgba(0, 153, 255, 0.1);
  background: rgba(255, 255, 255, 0.85);
}

.form-input::placeholder {
  color: #bbb;
}

/* 统一按钮样式 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s, transform 0.1s;
  outline: 0;
  width: 100%;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--secondary {
  background: rgba(0, 0, 0, 0.04);
  color: #333;
}

.btn--secondary:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.08);
}

.btn--secondary:active:not(:disabled) {
  transform: scale(0.98);
  background: rgba(0, 0, 0, 0.12);
}

.btn--save {
  background: rgba(0, 0, 0, 0.04);
  color: #333;
  flex: 1;
  width: auto;
}

.btn--save:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.08);
}

.btn--save:active:not(:disabled) {
  transform: scale(0.98);
  background: rgba(0, 0, 0, 0.12);
}

.btn--cancel {
  background: transparent;
  color: #808080;
  flex: 1;
  width: auto;
  border: 1px solid #dee2e6;
}

.btn--cancel:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.04);
  color: #333;
}

.btn--cancel:active:not(:disabled) {
  transform: scale(0.98);
}

.btn--connect {
  background: rgba(0, 0, 0, 0.04);
  color: #333;
  font-size: 13px;
  padding: 6px 14px;
  width: auto;
  white-space: nowrap;
}

.btn--connect:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.08);
}

.btn--connect:active:not(:disabled) {
  transform: scale(0.98);
  background: rgba(0, 0, 0, 0.12);
}

.btn--icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: transparent;
  color: #808080;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  margin: 0;
  flex-shrink: 0;
}

.btn--icon:hover {
  background: #ebebeb;
  color: #333;
  border-color: #ccc;
}

.btn--icon:active {
  background: #e0e0e0;
  transform: scale(0.95);
}

.btn--danger:hover {
  background: #fee;
  color: #e81123;
  border-color: #fcc;
}
</style>