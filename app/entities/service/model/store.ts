import { ref } from "vue";
import { defineStore } from "pinia";
import type { CanvasGetResponse } from "#shared/api/canvas";

export const useServiceStore = defineStore("services", () => {
  const services = ref<CanvasGetResponse["services"]>([]);

  function setServices(value: CanvasGetResponse["services"]) {
    services.value = value;
  }

  return { services, setServices };
});
