<script setup>
defineProps({
  showAddForm: Boolean,
  newConnForm: Object,
  directConnections: Array,
  isSecureContext: Boolean,
  connectingIndex: Number,
})

const emit = defineEmits(['add', 'cancel-add', 'save', 'remove', 'connect'])
</script>

<template>
  <div class="direct-connect-section">
    <div class="direct-connect-header">
      <h3>前端直连 OneBot</h3>
      <button class="btn-add-connection" @click="emit('add')" title="添加连接">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- 添加新连接的表单 -->
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
        <button class="btn btn-save" @click="emit('save')" :disabled="!newConnForm.wsUri">添加</button>
        <button class="btn btn-cancel" @click="emit('cancel-add')">取消</button>
      </div>
    </div>

    <!-- 已保存的连接列表 -->
    <template v-if="directConnections.length > 0">
      <p class="direct-hint" v-if="isSecureContext">
        ⚠️ 当前处于安全上下文（HTTPS），请务必使用 <strong>WSS（WebSocket Secure）</strong> 加密连接
      </p>

      <div class="saved-connections-list">
        <div
          v-for="(conn, index) in directConnections"
          :key="conn.id"
          class="saved-connection-item"
        >
          <div class="saved-connection-info">
            <div class="saved-connection-uri">{{ conn.wsUri }}</div>
            <div class="saved-connection-token" v-if="conn.wsToken">Token: {{ conn.wsToken }}</div>
          </div>
          <div class="saved-connection-actions">
            <button
              class="btn btn-connect"
              @click="emit('connect', index)"
              :disabled="connectingIndex === index"
            >
              {{ connectingIndex === index ? '连接中...' : '连接' }}
            </button>
            <button
              class="btn btn-delete"
              @click="emit('remove', conn.id)"
              title="删除此连接"
            >
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
</template>

<style scoped>
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

.btn-add-connection {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: transparent;
  color: #808080;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  padding: 0;
  margin: 0;
  flex-shrink: 0;
}

.btn-add-connection:hover {
  background: #EBEBEB;
  color: #333;
  border-color: #ccc;
}

.btn-add-connection:active {
  background: #e0e0e0;
}

/* 添加新连接的表单 */
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

/* 已保存的连接列表 */
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

.btn-save {
  background: rgba(0, 0, 0, 0.04);
  color: #333;
  flex: 1;
  margin-top: 0;
  width: auto;
}

.btn-save:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.08);
}

.btn-save:active:not(:disabled) {
  transform: scale(0.98);
  background: rgba(0, 0, 0, 0.12);
}

.btn-cancel {
  background: transparent;
  color: #808080;
  flex: 1;
  margin-top: 0;
  width: auto;
  border: 1px solid #dee2e6;
}

.btn-cancel:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.04);
  color: #333;
}

.btn-cancel:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-connect {
  background: rgba(0, 0, 0, 0.04);
  color: #333;
  font-size: 13px;
  padding: 6px 14px;
  margin-top: 0;
  width: auto;
  white-space: nowrap;
}

.btn-connect:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.08);
}

.btn-connect:active:not(:disabled) {
  transform: scale(0.98);
  background: rgba(0, 0, 0, 0.12);
}

.btn-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: transparent;
  color: #999;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  margin-top: 0;
  flex-shrink: 0;
}

.btn-delete:hover {
  background: #fee;
  color: #e81123;
  border-color: #fcc;
}

.btn-delete:active {
  transform: scale(0.95);
}
</style>