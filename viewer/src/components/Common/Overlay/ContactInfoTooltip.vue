<script>
import { defineComponent } from 'vue'
import Tooltip from "./Tooltip.vue";
import { CalledEmitter, Emitter } from "@/composables/useEventBus.js";
import {
  checkResponseOK,
  fetchContactShareArk,
  fetchGroupInfo,
  fetchGroupMemberInfo,
  fetchGroupNotice, fetchProfileLikeInfo, fetchSendProfileLike,
  fetchStrangerInfo,
  getGroupLogo,
  getUserLogo
} from "@/scripts/backend-api.js";
import { nanoid } from "nanoid";
import EnterArrow from "../Widgets/EnterArrow.vue";
import { isNumber, isString, mergeNotEmpty } from "@/scripts/types-util.js";
import QIcon from "@/components/Common/Icons/QIcon.vue";
import { showErrorToast } from "@/scripts/toast.js";
import {
  getGroupInfoCacheFromAll,
  getGroupUserInfoCache,
  getUserAvatarFrameCache,
  getUserInfoCache
} from "@/scripts/user-info-util.js";
import { checkSameContact, createGroupContact } from "@/scripts/contacts-util.js";

export default defineComponent({
  name: "ContactInfoTooltip",
  components: { QIcon, EnterArrow, Tooltip },
  data() {
    return {
      group_user: null,
      user: null,
      group: null,
      group_id: null,
      user_id: null,
      position: null,
      showId: null,
      showTime: null,
      latestGroupNotice: null,
      remarkModel: null,
      profileLike: null
    }
  },
  inject: ['selfId', "changeFriendContactRemark", "changeGroupContactRemark", "activeContact", "flattenContacts", "selectContact"],
  methods: {
    isString,
    getGroupLogo,
    getUserLogo,
    disappear() {
      this.group_user = this.user = this.group = this.group_id = this.user_id =
        this.position = this.showId = this.showTime = this.latestGroupNotice = this.remarkModel = this.profileLike = null
    },
    showContactInfo(options) {
      this.disappear()
      let { position, group_user, user, group, group_id, user_id, event } = options
      if (event instanceof PointerEvent) {
        position = { x: event.clientX, y: event.clientY }
      }
      if (!position) {
        return
      }
      // console.log(options)
      const showId = this.showId = nanoid()
      this.showTime = Date.now();
      const setter = key => {
        return info => {
          if (this.showId === showId) {
            this[key] = mergeNotEmpty(this[key], info) || info
          }
        }
      }
      if (group_user) {
        group_id = group_user.group_id
        user_id = group_user.user_id
      }
      if (group) {
        group_id = group.group_id
      }
      if (user) {
        user_id = user.user_id
      }
      if (group_id && user_id) {
        group_user = group_user || {}
        this.group_user = mergeNotEmpty(group_user, getGroupUserInfoCache(group_id, user_id)) || group_user
        fetchGroupMemberInfo(group_id, user_id).then(setter("group_user"))
      }
      if (user_id) {
        user = user || {}
        this.user = mergeNotEmpty(user, getUserInfoCache(user_id)) || user
        fetchStrangerInfo(user_id).then(setter("user"))
        fetchProfileLikeInfo(user_id).then(setter("profileLike"))
      }
      if (group_id && !user_id) {
        group = group || {}
        this.group = mergeNotEmpty(group, getGroupInfoCacheFromAll(group_id)) || group
        fetchGroupInfo(group_id).then(setter("group"))
        const setGroupNotice = info => {
          if (this.showId === showId) {
            this.latestGroupNotice = info?.[0]?.message
          }
        }
        if (checkSameContact(this.activeContact, createGroupContact(group_id))) {
          try {
            CalledEmitter.emit("get-current-group-notices").then(setGroupNotice)
          } catch (e) {

          }
        }
        fetchGroupNotice(group_id).then(setGroupNotice)
      }
      this.group_id = group_id
      this.user_id = Number(user_id) || user_id
      this.position = position
    },
    documentMousedown(e) {
      if (!e?.target?.closest(".contact-info-tooltip") && (Date.now() - this.showTime) > 100) {
        this.disappear()
      }
    },
    showGroupNotices() {
      Emitter.emit("show-group-notices")
      this.disappear()
    },
    handleRemarkBlur() {
      if (this.isGroupContact && this.group_id) {
        if (this.remarkModel !== this.group?.group_remark) {
          this.changeGroupContactRemark(this.group_id, this.remarkModel)
        }
      } else if (this.user_id) {
        if (this.remarkModel !== this.userRemark) {
          this.changeFriendContactRemark(this.user_id, this.remarkModel)
        }
      }
    },
    async sendProfileLike() {
      if (!this.user_id || !this.notSelf) return
      const showId = this.showId
      const result = await fetchSendProfileLike(this.user_id)
      if (checkResponseOK(result)) {
        if (showId !== this.showId) return
        if (isNumber(this.profileLike?.voteInfo?.total_count)) {
          this.profileLike.voteInfo.total_count++
        }
        const info = await fetchProfileLikeInfo(this.user_id)
        if (showId === this.showId) {
          this.profileLike = info
        }
      } else {
        showErrorToast(`点赞失败: ${ result?.message }`)
        console.error("点赞个人配置失败:", result)
      }
    },
    handleShare() {
      const contact = this.user_id
        ? { contact_id: this.user_id, type: 'private' }
        : { contact_id: this.group_id, type: 'group' }
      Emitter.emit(
        "select-contacts-send-msg",
        (async () => [await fetchContactShareArk(contact)])()
      )
      this.disappear()
    },
    handleSendMessage() {
      const contact = this.user_id
        ? { contact_id: this.user_id, type: 'private' }
        : { contact_id: this.group_id, type: 'group' }
      this.selectContact(contact)
      this.disappear()
    }
  },
  mounted() {
    document.addEventListener("mousedown", this.documentMousedown)
  },
  unmounted() {
    document.removeEventListener("mousedown", this.documentMousedown)
  },
  computed: {
    isGroupContact() {
      return !this.user_id && this.group_id
    },
    userRemark() {
      return this.user?.remark ?? this.group_user?.remark
    },
    userNickname() {
      return this.user?.nickname ?? this.group_user?.nickname
    },
    notSelf() {
      if (!this.user_id) return true
      return this.user_id !== this.selfId
    },
    avatarFrameUrl() {
      if (!this.user_id) return
      return getUserAvatarFrameCache(this.user_id)
    },
    isContact() {
      if (!this.user_id || !this.flattenContacts) return false
      return this.flattenContacts.some(
        contact => checkSameContact(contact, { contact_id: this.user_id, type: 'private' })
      )
    }
  },
  watch: {
    user(val) {
      if (isString(val?.remark) && !isString(this.remarkModel) && !this.isGroupContact) {
        this.remarkModel = val.remark
      }
    },
    group(val) {
      if (isString(val?.group_remark) && !isString(this.remarkModel) && this.isGroupContact) {
        this.remarkModel = val.group_remark
      }
    }
  }
})
</script>

<template>
  <Tooltip
    v-if="position"
    :tip-position="position"
    placement="br"
    :always-exists="true"
    trigger="toggle"
    :width="300"
  >
    <template #content>
      <div class="tooltip-style contact-info-tooltip">
        <div v-if="user_id">
          <div class="contact-info-header">
            <div
              :data-has-frame="!!avatarFrameUrl"
              :style="{
                '--avatar-frame-url': `url(${avatarFrameUrl})`
              }"
              class="contact-info-logo-container">
              <img class="contact-info-logo" :src="getUserLogo(user_id)" alt="">
            </div>
            <div class="contact-info-header-text overflow-ellipsis">
              <span class="contact-info-name overflow-ellipsis" :title="userNickname">{{ userNickname }}</span>
              <span class="contact-info-id">QQ {{ user_id }}</span>
            </div>
            <div class="contact-profile-like" :class="{ clickable: notSelf }" v-if="profileLike"
                 @click="sendProfileLike">
              <QIcon name="like_outline_24"/>
              {{ profileLike?.voteInfo?.total_count }}
            </div>
          </div>
          <div class="contact-info-details">
            <div class="row" v-if="user?.qqLevel">
              <div class="label">等级</div>
              <div class="value">{{ user.qqLevel }}</div>
            </div>
            <div class="row" v-if="notSelf && isString(userRemark)">
              <div class="label">备注</div>
              <input class="value clickable overflow-ellipsis" :placeholder="userNickname" v-model="remarkModel"
                     @blur="handleRemarkBlur">
            </div>
            <div class="row" v-if="group_user?.card">
              <div class="label">群昵称</div>
              <div class="value overflow-ellipsis" :title="group_user.card">{{ group_user.card }}</div>
            </div>
            <div class="row" v-if="user?.long_nick">
              <div class="label">签名</div>
              <div class="value overflow-ellipsis" :title="user.long_nick">{{ user.long_nick }}</div>
            </div>
            <div class="row">
              <div class="label">QQ 空间</div>
              <a class="value clickable" :href="`https://user.qzone.qq.com/${user_id}`" target="_blank">查看 QQ 空间</a>
            </div>
          </div>
        </div>
        <div v-else-if="group_id">
          <div class="contact-info-header">
            <div class="contact-info-logo-container">
              <img class="contact-info-logo" :src="getGroupLogo(group_id)" alt="">
            </div>
            <div class="contact-info-header-text overflow-ellipsis">
              <span class="contact-info-name">{{ group?.group_name }}</span>
              <span class="contact-info-id">
                {{ group_id }}
                <span v-if="group?.member_count">（{{ group.member_count }}人）</span>
              </span>
            </div>
          </div>
          <div class="contact-info-details">
            <div class="row" v-if="isString(group?.group_remark)">
              <div class="label">备注</div>
              <input class="value clickable overflow-ellipsis" placeholder="设置群聊备注" v-model="remarkModel"
                     @blur="handleRemarkBlur"/>
            </div>
            <div class="row" v-if="latestGroupNotice">
              <div class="label">群公告</div>
              <div class="value clickable overflow-ellipsis with-arrow" @click="showGroupNotices">
                <span class="overflow-ellipsis">
                <span v-if="latestGroupNotice?.image?.length">【图片】</span>
                <span v-html="latestGroupNotice.text"></span>
                </span>
                <EnterArrow :size="18"/>
              </div>
            </div>
          </div>
        </div>
        <div v-if="user_id || group_id" class="contact-info-actions">
          <button class="contact-info-action-btn cancel-btn" @click="handleShare">
            分享
          </button>
          <button v-if="group_id || (user_id && isContact)" class="contact-info-action-btn primary-btn"
                  @click="handleSendMessage">
            发消息
          </button>
        </div>
      </div>
    </template>
  </Tooltip>
</template>

<style scoped lang="scss">
.tooltip-style.contact-info-tooltip {
  /* 底色：整体白色背景 */
  background-color: $color-bg-card;
  background-repeat: no-repeat;
  background-position: top center;
  background-size: 100% auto;
  width: 300px;
  padding-top: 10px;
  max-width: 100%;
  /* 顶部背景图：仅顶部显示、不重复、铺满宽度 */
  background-image: url("#{$base-url}QQ/app/img/minicard.bg.c44eefb168ed8bd4d8e2.png");
}

.contact-info-header {
  padding: 12px;
  margin: 8px 0;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.contact-info-logo-container {
  position: relative;

  &, .contact-info-logo {
    @include avatar(60px);
  }

  &[data-has-frame]::after {
    @include after-avatar-frame(60px);
  }
}

.contact-info-header-text {
  @extend %flex-column;
  justify-content: center;
  margin-left: 16px;
  gap: 2px;
  flex: 1;
  line-height: normal;
}

.contact-profile-like {
  @extend %flex-column;
  @extend %flex-center-children;
  float: right;
  border-radius: $radius-sm;
  padding: 4px 6px;

  &.clickable {
    cursor: pointer;
    @extend %hover-active-bg;
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.contact-info-name {
  font-size: 20px;
}

.contact-info-id {
  color: $color-text-muted;
}

.contact-info-details {
  width: 100%;
  padding: 0 12px;
  font-size: 15px;

  .row {
    display: flex;
    margin-bottom: 10px;
    cursor: default;
    align-items: center;
  }

  .label {
    flex: 0 0 80px;
    white-space: nowrap;
    color: $color-text-muted;
  }

  .label, .value {
    padding: 5px;
  }

  .value {
    flex: 1;
    border-radius: 5px;
    color: black;

    &.with-arrow {
      display: flex;
      align-items: center;
    }

    &.clickable:hover {
      background-color: $color-bg-card-alt;
    }

    &.clickable:active {
      background-color: $color-bg-active;
    }
  }

  input.value {
    outline: none;
    border: 1px solid transparent;
    padding: 2px 5px;

    &:focus {
      background-color: transparent !important;
      border-color: $color-primary;
    }
  }
}

.contact-info-actions {
  display: flex;
  gap: 8px;
  padding: 8px 12px 12px;
  margin-top: 8px;

  .contact-info-action-btn {
    flex: 1;
    @include btn-base;
    font-size: 14px;
    padding: 8px 12px;
    border-radius: $radius-card !important;

    &.cancel-btn {
      @include btn-cancel;
    }

    &.primary-btn {
      @include btn-primary;
    }
  }
}
</style>