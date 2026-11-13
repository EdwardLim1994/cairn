import { computed, ref } from "vue";

export type WorkspaceDrawerView =
  | "service"
  | "message-queue"
  | "mock-apis"
  | "history"
  | "access-tokens"
  | "manage-nodes"
  | null;

export function useWorkspaceDrawerState() {
  const activeDrawer = ref<WorkspaceDrawerView>(null);

  function open(view: Exclude<WorkspaceDrawerView, null>) {
    activeDrawer.value = view;
  }

  function close(view: Exclude<WorkspaceDrawerView, null>) {
    if (activeDrawer.value === view) activeDrawer.value = null;
  }

  function model(view: Exclude<WorkspaceDrawerView, null>) {
    return computed({
      get: () => activeDrawer.value === view,
      set: (isOpen: boolean) => {
        if (isOpen) open(view);
        else close(view);
      },
    });
  }

  return { activeDrawer, model };
}
