import { computed, ref } from "vue";

export type WorkspaceDrawerView =
  | "service"
  | "message-queue"
  | "mock-apis"
  | "history"
  | "graph-code"
  | "access-tokens"
  | "manage-nodes"
  | null;

export function useWorkspaceDrawerState() {
  const activeDrawer = ref<WorkspaceDrawerView>(null);

  function model(view: Exclude<WorkspaceDrawerView, null>) {
    return computed({
      get: () => activeDrawer.value === view,
      set: (open: boolean) => {
        if (open) activeDrawer.value = view;
        else if (activeDrawer.value === view) activeDrawer.value = null;
      },
    });
  }

  return { activeDrawer, model };
}
