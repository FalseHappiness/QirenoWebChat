import { createApp } from 'vue'
import './styles/global.css'
import './styles/vite-env.scss'
// import App from './Test.vue'
import App from './App.vue'
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import 'virtual:svg-icons-register'

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const app = createApp(App);
app.use(pinia);
app.mount('#app');