<!-- RecentContactItem.vue -->
<script setup>
import { computed, ref, onMounted, h, watch, inject } from "vue";
import { parseMessagePreview, parseNoticePreview } from "@/scripts/parse-message.js";
import { getGroupLogo, getUserLogo } from "@/scripts/backend-api.js";
import { vCustomMenu } from "@/directives/context-menu.js";
import { formatRelativeTime, parseJSON } from "@/scripts/util.js";
import { CacheNameKey, fetchDisplayName, getContactNameRef } from "@/scripts/user-info-util.js";
import { createContactContextMenuItems } from "@/scripts/contact-content-menu.js";

const props = defineProps({
  contact: {
    type: Object,
    required: true
  },
  active: {
    type: Boolean,
    default: false
  },
})

const displayName = ref('') // 使用ref来管理名称状态
const isError = ref(false) // 错误状态

const isGroup = computed(() => {
  return props.contact.type === 'group'
})

const selectContact = inject("selectContact")

const handleClick = () => {
  selectContact(props.contact)
}

// 获取显示名称的函数
const getName = async () => {
  await getContactNameRef(props.contact, displayName, isError)
};

// 点击名称重新获取
const handleNameClick = (e) => {
  // e.stopPropagation()
  // getName()
}

const previewSenderName = ref("");
const previewMessage = ref([])

const getPreviewText = async () => {
  try {
    let event = props.contact.latest_msg;
    event = parseJSON(event);
    // console.log(props.contact);
    const isMessage = ['message_sent', 'message'].includes(event?.post_type)
    const isNotice = event?.post_type === 'notice'

    let display_name = props.contact.name;
    /*
    if (!isGroup.value) {
      display_name = event.self_id === event.user_id ? '呼' : '应';
    }
     */
    if (isMessage && isGroup.value) {
      const id = [event.group_id, event.user_id];
      const type = CacheNameKey.GROUP_USER;
      const fetchResult = await fetchDisplayName(id, type);
      display_name = fetchResult.error ? display_name : fetchResult.name;
    }

    let parsedMessage = []
    if (isMessage) {
      parsedMessage = await parseMessagePreview(event, true);
    } else if (isNotice) {
      parsedMessage = await parseNoticePreview(event, true)
    }

    previewSenderName.value = display_name
    previewMessage.value = parsedMessage
  } catch (error) {
    console.error('Error in getPreviewText:', error);

    previewSenderName.value = ""
    previewMessage.value = []
  }
}

watch(() => props.contact.latest_msg, async () => {
  try {
    await getPreviewText();
  } catch (error) {
    console.error('Error in RecentContactItem get preview text:', error);
  }
})

const computedPreviewText = computed(() => {
  let children = []
  if (previewMessage.value) {
    const is_group = isGroup.value;
    let event = props.contact.latest_msg;
    event = parseJSON(event);
    const isMessage = ['message_sent', 'message'].includes(event?.post_type)

    if ((isMessage && is_group && previewSenderName.value) || !isMessage || !is_group) {
      children = [
        ...(
          (isMessage && is_group) ? [previewSenderName.value, ': '] : []
        ),
        ...previewMessage.value
      ]
    }
  }
  return () => h(
    "small",
    { class: "text-muted overflow-ellipsis" },
    children
  );
});

// 计算显示Logo
const logoUrl = computed(() => {
  return (isGroup.value ? getGroupLogo : getUserLogo)(props.contact.contact_id)
})

const avatarElement = ref(null)
const showContactInfo = inject("showContactInfo")

const customContextMenu = () => createContactContextMenuItems({
  contact: props.contact,
  avatarElement: avatarElement.value,
  showContactInfo
})

watch(() => props.contact?.name, newName => {
  displayName.value = newName
})

// 组件挂载时获取名称
onMounted(async () => {
  try {
    displayName.value = props.contact.name
    await getPreviewText()
    await getName();
  } catch (error) {
    console.error('Error in RecentContactItem mounted:', error);
  }
});
</script>

<template>
  <div
    class="recent-contact-item"
    :class="{ active }"
    v-custom-menu="customContextMenu"
    @click="handleClick"
  >
    <img alt="" :src="logoUrl" class="contact-logo" ref="avatarElement">
    <div class="contact-info">
      <div class="display-flex justify-content-between">
        <span
          @click="handleNameClick"
          class="contact-name overflow-ellipsis"
          :class="{
            'text-error': isError,
          }"
        >
          {{ displayName || contact.contact_id }}
        </span>
        <small class="text-muted">{{ formatRelativeTime(contact.last_time) }}</small>
      </div>
      <computed-preview-text/>
    </div>
  </div>
</template>

<style scoped lang="scss">
.recent-contact-item {
  padding: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  height: 60px;
  margin: 5px 4px;
  border-radius: $radius-btn;

  &:hover {
    background-color: $color-bg-hover;
  }

  &:active {
    background-color: $color-bg-active;
  }

  &.active {
    background-color: $color-bg-active-contact !important;

    &:active {
      background-color: $color-bg-active-contact-pressed !important;
    }

    .text-error {
      color: $color-text-error-soft !important;
    }

    .contact-name.text-muted {
      opacity: 0.5;
    }
  }
}

.contact-logo {
  @include avatar(40px);
  float: left;
  margin-right: 10px;
}

.contact-info {
  flex: 1;
  line-height: 18px;
  overflow: hidden;
  @include text-ellipsis;
}

.text-muted {
  font-size: 12px;
  white-space: nowrap;
}

.contact-name {
  font-size: 16px !important;
}

.text-error {
  color: $color-error !important;
}

.recent-contact-item:deep(.msg-preview-emoji) {
  height: 15px;
  margin: -2px 1px 0 1px;
}
</style>