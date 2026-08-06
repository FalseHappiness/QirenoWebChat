<script>
import { defineComponent } from 'vue'
import SimplePopUp from "../../../Common/Overlay/SimplePopUp.vue";
import { Collapse, CollapsePanel, Checkbox, CheckboxGroup } from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css';
import CustomScrollBar from "../../../Common/Scrolling/CustomScrollBar.vue";
import { filterSearchContacts, flattenCategorizedContacts } from "@/scripts/contacts-util.js";
import QIcon from "../../../Common/Icons/QIcon.vue";
import { getGroupLogo, getUserLogo } from "@/scripts/backend-api.js";

export default defineComponent({
  name: "ContactsPicker",
  components: {
    QIcon,
    CustomScrollBar,
    SimplePopUp,
    ACollapse: Collapse,
    ACollapsePanel: CollapsePanel,
    ACheckbox: Checkbox,
    ACheckboxGroup: CheckboxGroup,
  },
  inject: ["categorizedContacts"],
  data() {
    return {
      collapseActiveKeys: [-100],
      selectedContactsKeys: [],
      filterContactsValue: ""
    }
  },
  props: {
    onConfirm: {
      type: Function,
      default: new Function()
    },
    onCancel: {
      type: Function,
      default: new Function()
    },
  },
  computed: {
    selectedContacts() {
      return this.selectedContactsKeys.map(key => this.getContact(key)).filter(contact => contact)
    },
    flattenContacts() {
      return flattenCategorizedContacts(this.categorizedContacts)
    },
    filteredContacts() {
      return filterSearchContacts(this.filterContactsValue.toLowerCase(), this.flattenContacts)
    }
  },
  methods: {
    getLogo(id, type) {
      return type === 'group'
        ? getGroupLogo(id, 40)
        : getUserLogo(id, 40)
    },
    getContact(id, type) {
      if (!type) {
        [type, id] = id.split('.')
      }
      return this.flattenContacts.find(contact => contact && String(contact.contact_id) === id && contact.type === type)
    },
    confirm(confirm) {
      this.$refs.popUp.confirm(confirm, this.selectedContacts)
    }
  },
  mounted() {
    // console.log(this.categorizedContacts)
  },
})
</script>

<template>
  <div class="contacts-picker">
    <SimplePopUp :on-confirm="onConfirm"
                 :on-cancel="onCancel"
                 :container-styles="$style['contacts-picker-container']"
                 ref="popUp">
      <div class="contacts-picker-contacts-area">
        <div class="contacts-picker-contacts-area-search">
          <QIcon name="search_24" class="contacts-picker-contacts-area-search-icon"/>
          <input @input="filterContactsValue = $event.target.value" placeholder="搜索"
                 class="contacts-picker-contacts-area-search-input">
        </div>
        <div class="contacts-picker-contacts-area-contacts">
          <CustomScrollBar>
            <a-checkbox-group v-model:value="selectedContactsKeys" class="width-100">
              <a-collapse v-if="filteredContacts === undefined"
                          ghost
                          v-model:activeKey="collapseActiveKeys"
                          style="width: 100%">
                <template #expandIcon="{ isActive }">
                  <QIcon
                    name="arrow_right_small_16"
                    class="contacts-picker-expand-icon"
                    :class="{ active: isActive }"
                  />
                </template>
                <a-collapse-panel
                  v-if="categorizedContacts?.length"
                  v-for="category in categorizedContacts"
                  :key="category.id"
                  :header="category.name">
                  <a-checkbox
                    v-for="contact in category.contacts"
                    :value="`${contact.type}.${contact.contact_id}`"
                    class="contacts-picker-contacts-area-contact">
                    <img class="contacts-picker-contacts-area-contact-logo" alt=""
                         :src="getLogo(contact.contact_id, contact.type)"
                         loading="lazy">
                    {{ contact.name }}
                  </a-checkbox>
                </a-collapse-panel>
              </a-collapse>
              <div v-else style="width: 100%;">
                <a-checkbox
                  v-if="filteredContacts.length"
                  v-for="contact in filteredContacts"
                  :value="`${contact.type}.${contact.contact_id}`"
                  class="contacts-picker-contacts-area-contact">
                  <img class="contacts-picker-contacts-area-contact-logo" alt=""
                       :src="getLogo(contact.contact_id, contact.type)"
                       loading="lazy">
                  {{ contact.name }}
                </a-checkbox>
                <p v-else style="color: gray;text-align: center">无搜索结果</p>
              </div>
            </a-checkbox-group>
          </CustomScrollBar>
        </div>
      </div>
      <div class="contacts-picker-preview-area">
        <div class="contacts-picker-selected-info">
          <span>{{ selectedContactsKeys?.length > 1 ? '分别' : '' }}发送给：</span>
          <span style="color: gray;" v-if="selectedContactsKeys?.length">
              已选 {{ selectedContactsKeys.length }} 个联系人
            </span>
        </div>
        <div class="contacts-picker-selected-contacts-area">
          <CustomScrollBar style="padding-right: 9px;">
            <div
              v-for="contact in selectedContacts"
              class="contacts-picker-contacts-area-contact"
              @click="selectedContactsKeys = selectedContactsKeys.filter(key => key !== `${contact.type}.${contact.contact_id}`)">
              <div class="contacts-picker-contacts-area-contact-left">
                <img class="contacts-picker-contacts-area-contact-logo" alt=""
                     :src="getLogo(contact.contact_id, contact.type)"
                     loading="lazy">
                {{ contact.name }}
              </div>
              <QIcon name="close_16" class="contacts-picker-contacts-area-contact-close-btn"/>
            </div>
          </CustomScrollBar>
        </div>
        <div class="contacts-picker-control-area">
          <div class="contacts-picker-buttons-container">
            <div class="contacts-picker-button contacts-picker-button-confirm" @click="confirm(true)">确定</div>
            <div class="contacts-picker-button contacts-picker-button-cancel" @click="confirm(false)">取消</div>
          </div>
        </div>
      </div>
    </SimplePopUp>
  </div>
</template>

<style scoped lang="scss">
.contacts-picker-contacts-area {
  width: 50%;
  border-right: 1px solid $color-bg-contact-picker-border;
  display: flex;
  flex-direction: column;
}

.contacts-picker-contacts-area-contacts {
  flex: 1;
  overflow: hidden auto;
}

.contacts-picker-contacts-area-contacts:deep(.ant-collapse-content-box) {
  padding: 0 12px 0 0;
  padding-block: 0 !important;
}

.contacts-picker-contacts-area-contacts:deep(.ant-collapse-header) {
  padding: 8px 8px 8px 4px;
}

.contacts-picker-expand-icon {
  width: 16px;
  height: 16px;
  margin-right: -5px;
  transition: transform 0.3s ease-in-out;
  transform: rotate(0deg);
}

.contacts-picker-expand-icon.active {
  transform: rotate(90deg);
}

.contacts-picker-contacts-area-contact {
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  display: flex;
  cursor: pointer;
  align-items: center;
  font-size: 14px;
}

.contacts-picker-contacts-area-contact-logo {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  margin-right: 8px;
}

.contacts-picker-contacts-area-contact:hover {
  background-color: rgba(230, 230, 230, 0.5);
}

.contacts-picker-contacts-area-contact:active {
  background-color: rgba(200, 200, 200, 0.5);
}

.contacts-picker-contacts-area-contact:deep(.ant-checkbox-inner) {
  border-radius: 50%;
}

.contacts-picker-contacts-area-contact:deep(.ant-checkbox-inner):hover, .contacts-picker-contacts-area-contact:hover:deep(.ant-checkbox-inner) {
  border-color: $color-bg-contact-picker-checkbox;
}

.contacts-picker-contacts-area-contact:deep(.ant-checkbox-checked)::after {
  border: none;
}

.contacts-picker-contacts-area-contact:deep(.ant-checkbox) {
  flex-shrink: 0;
}

.contacts-picker-contacts-area-contact:deep(.ant-checkbox+span), .contacts-picker-contacts-area-contact-left {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.contacts-picker-preview-area {
  display: flex;
  flex-direction: column;
  padding: 2px 0 2px 12px;
  flex: 1;
  overflow: hidden;
}

.contacts-picker-selected-contacts-area {
  flex: 1;
  overflow: hidden;
}

.contacts-picker-selected-info {
  display: flex;
  font-size: 12px;
  justify-content: space-between;
  padding: 6px 0;
}

.contacts-picker-contacts-area-contact-close-btn {
  width: 14px;
  height: 14px;
  color: $color-text-white;
  background-color: $color-text-muted;
  border-radius: 50%;
}

.contacts-picker-contacts-area-contact-left {
  flex: 1;
}

.contacts-picker-buttons-container {
  display: flex;
  justify-content: flex-end;
}

.contacts-picker-button {
  margin: 5px;
  width: 76px;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: white;
  border-radius: 10px;
  cursor: pointer;
}

.contacts-picker-button-confirm {
  background-color: $color-primary;
  color: white;
}

.contacts-picker-button-confirm:hover {
  background-color: $color-bg-primary-hover;
}

.contacts-picker-button-confirm:active {
  background-color: $color-bg-primary-active;
  color: rgba(255, 255, 255, 0.4);
}

.contacts-picker-button-cancel {
  border: 1px solid $color-border-cancel;
  color: black;
}

.contacts-picker-button-cancel:hover {
  background-color: $color-bg-hover-alt;
}

.contacts-picker-button-cancel:active {
  background-color: $color-bg-active-alt;
  color: $color-text-muted;
}

.contacts-picker-contacts-area-search {
  margin: 5px 12px 5px 5px;
  background-color: $color-bg-search;
  border-radius: 6px;
  display: flex;
  height: 28px;
  align-items: center;
  border: 1px solid $color-bg-search;
  overflow: hidden;
}

.contacts-picker-contacts-area-search-icon {
  height: 18px;
  width: 18px;
  margin: 0 4px 0 6px;
  color: $color-text-muted;
  flex-shrink: 0;
}

.contacts-picker-contacts-area-search:focus-within {
  border-color: $color-primary;
}

.contacts-picker-contacts-area-search-input {
  outline: none;
  background: none;
  border: none;
  font-size: 14px;
  padding: 0 4px 0 0;
  flex: 1 1 auto;
  min-width: 0;
}
</style>

<style module>
.contacts-picker-container {
  width: 520px;
  height: 540px;
  flex-direction: row;
  padding: 10px 12px 15px 15px;
  max-width: calc(100% - 20px);
  max-height: calc(100% - 20px);
}
</style>