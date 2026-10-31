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
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".app__framework-select-menu")) return;
    if (!target?.closest(".app__framework-select")) options.frameworkMenuOpen.value = false;
  }

  return { closeSettings, closeSettingsOutside };
}
