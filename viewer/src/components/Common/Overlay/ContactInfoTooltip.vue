<script>
import { defineComponent } from 'vue'
import Tooltip from "./Tooltip.vue";
import { Emitter } from "@/composables/useEventBus.js";
import {
  fetchGroupInfo,
  fetchGroupMemberInfo,
  fetchGroupNotice,
  fetchStrangerInfo,
  getGroupLogo,
  getUserLogo
} from "@/scripts/backend-api.js";
import { nanoid } from "nanoid";
import EnterArrow from "../Widgets/EnterArrow.vue";
import { isString } from "@/scripts/types-util.js";

export default defineComponent({
  name: "ContactInfoTooltip",
  components: { EnterArrow, Tooltip },
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
      remarkModel: null
    }
  },
  inject: ['selfId', "changeFriendContactRemark", "changeGroupContactRemark"],
  methods: {
    isString,
    getGroupLogo,
    getUserLogo,
    disappear() {
      this.group_user = this.user = this.group = this.group_id = this.user_id =
        this.position = this.showId = this.showTime = this.latestGroupNotice = this.remarkModel = null
    },
    showContactInfo(options) {
      this.disappear()
      let { position, group_user, user, group, group_id, user_id } = options
      if (!position) {
        return
      }
      // console.log(options)
      const showId = this.showId = nanoid()
      this.showTime = Date.now();
      const setter = (key, merge = true) => {
        return info => {
          if (this.showId === showId) {
            if (merge) {
              info = { ...this[key], ...info }
            }
            this[key] = info
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
        this.group_user = group_user
        fetchGroupMemberInfo(group_id, user_id).then(setter("group_user"))
      }
      if (user_id) {
        this.user = user
        fetchStrangerInfo((user_id)).then(setter("user"))
      }
      if (group_id && !user_id) {
        this.group = group
        fetchGroupInfo(group_id).then(setter("group"))
        fetchGroupNotice(group_id).then(info => {
          if (this.showId === showId) {
            this.latestGroupNotice = info?.[0]?.message
          }
        })
      }
      this.group_id = group_id
      this.user_id = Number(user_id) || user_id
      this.position = position
    },
    documentClick(e) {
      if (!e?.target?.closest(".contact-info-tooltip") && (Date.now() - this.showTime) > 300) {
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
  },
  mounted() {
    document.addEventListener("click", this.documentClick)
  },
  unmounted() {
    document.removeEventListener("click", this.documentClick)
  },
  computed: {
    isGroupContact() {
      return !this.user_id && this.group_id
    },
    userRemark() {
      return this.user?.remark ?? this.group_user?.remark
    },
    userNickname() {
      return this.group_user?.nickname ?? this.user?.nickname
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
            <img class="contact-info-logo" :src="getUserLogo(user_id)" alt="">
            <div class="contact-info-header-text overflow-ellipsis">
              <span class="contact-info-name">{{ userNickname }}</span>
              <span class="contact-info-id">QQ {{ user_id }}</span>
            </div>
          </div>
          <div class="contact-info-details">
            <div class="row" v-if="user?.qqLevel">
              <div class="label">等级</div>
              <div class="value">{{ user.qqLevel }}</div>
            </div>
            <div class="row" v-if="user_id !== selfId && isString(userRemark)">
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
            <img class="contact-info-logo" :src="getGroupLogo(group_id)" alt="">
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
}

.contact-info-logo {
  @include avatar(60px);
}

.contact-info-header-text {
  @extend %flex-column;
  justify-content: center;
  margin-left: 16px;
  gap: 8px;
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
</style>