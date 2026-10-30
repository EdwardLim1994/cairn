import type { Ref } from "vue";
import type { useGraphStore } from "../stores/graph";

export function useSettingsPanelViewModel(options: {
  serviceDialog: Ref<boolean>;
  mockPanel: Ref<boolean>;
  frameworkMenuOpen: Ref<boolean>;
  graphStore: ReturnType<typeof useGraphStore>;
  syncNodes: () => void;
}) {
  function closeSettings() {
    options.serviceDialog.value = false;
    options.mockPanel.value = false;
    options.frameworkMenuOpen.value = false;
    options.graphStore.setSelection(null);
    options.syncNodes();
  }

  function closeSettingsOutside(event: PointerEvent) {
    if (event.target instanceof Element && event.target.closest(".app__side-dialog")) {
      if (!event.target.closest(".framework-select")) options.frameworkMenuOpen.value = false;
      return;
    }
    closeSettings();
  }

  return { closeSettings, closeSettingsOutside };
}
