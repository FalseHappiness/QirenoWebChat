import { createApp } from 'vue'
import './styles/global.scss'
import './styles/themes/base.css'
import './styles/vite-env.scss'
// import App from './Test.vue'
import App from './App.vue'
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import 'virtual:svg-icons-register'
import { applyTheme } from "@/scripts/theme.js";

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const app = createApp(App);
app.use(pinia);
app.mount('#app');

applyTheme();