import { createApp } from 'vue'
import './styles/global.css'
import './styles/vite-env.scss'
// import App from './Test.vue'
import App from './App.vue'
import { createPinia } from 'pinia';
import 'virtual:svg-icons-register'

const pinia = createPinia();

const app = createApp(App);
app.use(pinia);
app.mount('#app');