<script>
import { defineComponent } from 'vue'
import SimpleWindow from "@/components/Common/Overlay/SimpleWindow.vue"
import VirtualScroller from "@/components/Common/Scrolling/VirtualScroller.vue"
import GroupLevelTitle from "@/components/Destination/Chat/Message/GroupLevelTitle.vue"
import QIcon from "@/components/Common/Icons/QIcon.vue"
import { getUserLogo } from "@/scripts/backend-api.js"
import { getCacheName, CacheNameKey } from "@/scripts/user-info-util.js"
import { pinyin } from "pinyin-pro"
import { vCustomMenu } from "@/directives/context-menu.js"
import { createUserAvatarContextMenuItems } from "@/scripts/avatar-content-menu.js"
import { filterGroupMembers } from "@/scripts/contacts-util.js"

export default defineComponent({
  name: "GroupMembersViewer",
  components: { SimpleWindow, VirtualScroller, GroupLevelTitle, QIcon },
  directives: { 'custom-menu': vCustomMenu },
  props: {
    group_id: {
      type: Number,
      required: true
    },
    groupUsers: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'click-show-contact-info'],
  inject: ["activeContact", "flattenContacts", "selectContact", 'selfId'],
  data() {
    return {
      filterText: '',
      closed: false
    }
  },
  computed: {
    /**
     * 当前用户自己的群成员信息（用于权限判断）
     */
    selfGroupUser() {
      return this.groupUsers?.find?.(u => u.user_id === this.selfId) || {}
    },

    /**
     * 根据搜索文本过滤后的成员列表
     * 使用 contacts-util 中的 filterGroupMembers 实现高级搜索
     * 支持：前缀匹配置顶 + 多名称字段权重优先级 + 拼音/简拼 + ID匹配
     * 返回 null 表示未搜索，使用分类视图
     */
    filteredGroupUsers() {
      return filterGroupMembers(this.group_id, this.groupUsers, this.filterText)
    },

    /**
     * 分类后的群成员（用于 VirtualScroller 渲染）
     * 顺序：群主 → 管理员 → 机器人 → A‑Z → #
     */
    categorizedList() {
      if (this.filteredGroupUsers !== null) {
        // 搜索模式下，返回扁平列表
        return this.filteredGroupUsers
      }

      if (!this.groupUsers) return []

      const users = this.groupUsers
      const ownerAdmin = []
      const robot = []
      const letterMap = {}
      const special = []

      for (const user of users) {
        const role = user.role
        if (role === 'owner' || role === 'admin') {
          ownerAdmin.push(user)
        } else if (user.is_robot) {
          robot.push(user)
        } else {
          const letter = this.getFirstLetter(user)
          if (/^[A-Z]$/.test(letter)) {
            if (!letterMap[letter]) letterMap[letter] = []
            letterMap[letter].push(user)
          } else {
            special.push(user)
          }
        }
      }

      // 角色权重：owner 优先级高于 admin，之后再按昵称中文排序
      const sortOwnerAdmin = (a, b) => {
        const weight = { owner: 0, admin: 1 }
        const wA = weight[a.role]
        const wB = weight[b.role]
        if (wA !== wB) return wA - wB
        // 同权限按名称排序
        return this.getDisplayName(a).localeCompare(this.getDisplayName(b), 'zh')
      }

      const sortByName = (a, b) => this.getDisplayName(a).localeCompare(this.getDisplayName(b), 'zh')

      // 群主管理员使用专属排序
      ownerAdmin.sort(sortOwnerAdmin)
      robot.sort(sortByName)
      special.sort(sortByName)

      const sortedLetters = Object.keys(letterMap).sort()
      for (const letter of sortedLetters) {
        letterMap[letter].sort(sortByName)
      }

      return { ownerAdmin, robot, letterMap, sortedLetters, special }
    },

    /**
     * 扁平化为 VirtualScroller 可用的列表
     * 每个元素：{ header: '分类名' } 或 用户对象
     */
    virtualItems() {
      if (Array.isArray(this.categorizedList)) {
        return this.categorizedList
      }

      const { ownerAdmin, robot, letterMap, sortedLetters, special } = this.categorizedList
      const items = []

      if (ownerAdmin.length) {
        items.push({ header: `群主/管理员(${ownerAdmin.length}人)` })
        items.push(...ownerAdmin)
      }
      if (robot.length) {
        items.push({ header: `机器人(${robot.length}个)` })
        items.push(...robot)
      }
      for (const letter of sortedLetters) {
        const members = letterMap[letter]
        items.push({ header: letter + `(${members.length}人)` })
        items.push(...members)
      }
      if (special.length) {
        items.push({ header: `#(${special.length}人)` })
        items.push(...special)
      }

      return items
    }
  },
  methods: {
    /**
     * 获取用户显示名称：card || remark || nickname || user_id
     */
    getDisplayName(user) {
      if (!user) return ''
      const cached = getCacheName([this.group_id, user.user_id], CacheNameKey.GROUP_USER)
      return cached || user.card || user.remark || user.nickname || String(user.user_id)
    },

    /**
     * 获取用户名称首字母，用于分类
     */
    getFirstLetter(user) {
      const name = this.getDisplayName(user)
      if (!name) return '#'
      const firstChar = name[0]
      if (/[a-zA-Z]/.test(firstChar)) {
        return firstChar.toUpperCase()
      }
      try {
        const py = pinyin(firstChar, { toneType: 'none', type: 'array' })
        if (py && py[0]) {
          const letter = py[0][0].toUpperCase()
          if (/[A-Z]/.test(letter)) return letter
        }
      } catch (e) {
        // fallback
      }
      return '#'
    },

    /**
     * 点击用户容器，通知父组件显示联系人信息
     */
    handleClickMember(e, user) {
      if (!user) return
      this.$emit('click-show-contact-info', e, {
        user_id: user.user_id,
        nickname: user.nickname
      })
    },

    /**
     * 创建右键菜单项（工厂函数，返回 v-custom-menu 需要的函数）
     */
    createContextMenu(user) {
      return e => createUserAvatarContextMenuItems({
        userInfo: user,
        selfInfo: this.selfGroupUser,
        displayName: this.getDisplayName(user),
        activeContact: this.activeContact,
        flattenContacts: this.flattenContacts,
        selectContact: this.selectContact,
        showContactInfo: this.handleClickMember,
        avatarElement: e?.target?.closest('.group-members-item')?.querySelector('.group-members-item-avatar')
      })
    },
    getUserLogo,
    close() {
      if (this.closed) return
      this.closed = true
      setTimeout(() => this.$emit("close"), 200)
    }
  }
})
</script>

<template>
  <div class="group-members-viewer" :class="{ closed }">
    <div class="group-members-title">
      <QIcon name="arrow_left_24" @click="close"/>
      群聊成员 {{ groupUsers?.length }}
    </div>

    <div class="group-members-search">
      <QIcon name="search_24" class="group-members-search-icon"/>
      <input
        v-model="filterText"
        placeholder="搜索"
        class="group-members-search-input"
      />
    </div>

    <div class="group-members-scroll-container">
      <VirtualScroller
        v-if="virtualItems.length"
        :items="virtualItems"
        :item-height="48"
        :header-height="32"
        :buffer="5"
        header-key="header"
        class="group-members-scroller"
      >
        <template #default="{ item, index, isStickyActive }">
          <!-- 分类标题 -->
          <div
            v-if="item.header"
            class="group-members-header"
            :class="{ hide: isStickyActive }"
          >
            {{ item.header }}
          </div>
          <!-- 用户条目 -->
          <div
            v-else
            class="group-members-item"
            v-custom-menu="createContextMenu(item)"
            @click="handleClickMember($event, item)"
          >
            <img
              class="group-members-item-avatar"
              alt=""
              :src="getUserLogo(item.user_id)"
            />
            <span class="group-members-item-name overflow-ellipsis">{{
                getDisplayName(item)
              }}</span>
            <GroupLevelTitle :user-info="item"/>
          </div>
        </template>
        <template #sticky-header="{ header }" class="group-members-sticky-header">
          {{ header.text }}
        </template>
      </VirtualScroller>

      <div v-else-if="filterText" class="group-members-empty">
        无搜索结果
      </div>
      <div v-else class="group-members-empty">
        暂无群成员
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.group-members-viewer {
  @extend %flex-column;
  @include square-size(100%);
  overflow: hidden;
  position: absolute;
  animation: simplePopUpMaskIn 0.2s ease-in-out;
  transition: opacity 0.2s ease-in-out;
  opacity: 1;
  left: 0;
  top: 0;
  background-color: $color-bg-page;
  z-index: 10;
}

.group-members-viewer.closed {
  opacity: 0;
}

.group-members-title {
  @extend %flex-row-center;
  padding: 10px 10px 2px;
  font-size: 16px;
  line-height: 100%;
}

.group-members-title svg {
  @include square-size($close-btn-size);
  margin: 0 5px;
  cursor: pointer;
}

.group-members-search {
  margin: 8px 12px 4px 12px;
  background-color: $color-bg-hover;
  border-radius: $radius-btn;
  display: flex;
  height: 28px;
  align-items: center;
  border: 1px solid $color-bg-hover;
  overflow: hidden;
  flex-shrink: 0;
}

.group-members-search-icon {
  height: 18px;
  width: 18px;
  margin: 0 4px 0 6px;
  color: $color-text-muted;
  flex-shrink: 0;
}

.group-members-search:focus-within {
  border-color: $color-primary;
}

.group-members-search-input {
  outline: none;
  background: none;
  border: none;
  font-size: 14px;
  padding: 0 4px 0 0;
  flex: 1 1 auto;
  min-width: 0;
}

.group-members-scroll-container {
  flex: 1;
  overflow: hidden;
  padding: 0 12px 8px;
}

.group-members-scroller {
  height: 100% !important;
}

.group-members-header {
  height: 32px;
  line-height: 32px;
  padding: 0 14px;
  font-size: 13px;
  color: $color-text-muted;
  background-color: $color-bg-page;
  border-bottom: 1px solid $color-border-faint;
  transition: opacity 0.2s;
  user-select: none;
}

.group-members-header.hide {
  opacity: 0;
}

.group-members-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  margin: 2px 0;
  border-radius: $radius-btn;
  cursor: pointer;
  font-size: 14px;
  height: 48px;
  box-sizing: border-box;
}

.group-members-item:hover {
  background-color: $color-bg-hover;
}

.group-members-item:active {
  background-color: $color-bg-active;
}

.group-members-item-avatar {
  @extend %avatar-sm;
  margin-right: 10px;
  flex-shrink: 0;
}

.group-members-item-name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  color: $color-text-primary;
}

.group-members-empty {
  text-align: center;
  color: $color-text-muted;
  padding: 40px 0;
  font-size: 14px;
}

:deep(.sticky-header) {
  backdrop-filter: blur(5px);
  background-color: color-mix(in srgb, $color-bg-page 90%, transparent);
}
</style>