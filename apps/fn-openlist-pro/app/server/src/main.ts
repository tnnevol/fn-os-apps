import { createApp } from "vue";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import "virtual:uno.css";
import "@/assets/css/reset.scss";
import "@/assets/css/element-light.scss";
// import "@/assets/css/element-dark.scss";
import App from "./App.vue";

const app = createApp(App);

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.mount("#app");
