import { ref } from "vue";
import { defineStore } from "pinia";
import type { CanvasGetResponse } from "#shared/api/canvas";

export const useMessageDestinationStore = defineStore("messageDestinations", () => {
  const messageDestinations = ref<CanvasGetResponse["messageDestinations"]>([]);

  function setMessageDestinations(value: CanvasGetResponse["messageDestinations"]) {
    messageDestinations.value = value;
  }

  return { messageDestinations, setMessageDestinations };
});
