import { ref } from "vue";
import { defineStore } from "pinia";
import type { CanvasGetResponse } from "#shared/api/canvas";
import type {
  EnvironmentVariable,
  EnvironmentVariableValues,
  MockApiDraft,
  MockApiRunResult,
  HeaderTemplateDraft,
  AuthorizationTemplateDraft,
} from "./types";

export const useMockApiStore = defineStore("mockApis", () => {
  const mockApis = ref<CanvasGetResponse["mockApis"]>([]);
  const mockDraft = ref<MockApiDraft[]>([]);
  const environmentVariables = ref<EnvironmentVariable[]>([]);
  const headerTemplates = ref<HeaderTemplateDraft[]>([]);
  const savedHeaderTemplates = ref<HeaderTemplateDraft[]>([]);
  const authorizationTemplates = ref<AuthorizationTemplateDraft[]>([]);
  const savedAuthorizationTemplates = ref<AuthorizationTemplateDraft[]>([]);
  const savedEnvironmentVariableIds = ref<string[]>([]);
  const savedEnvironmentVariableValues = ref<EnvironmentVariableValues>({});
  const runningMockId = ref<string | null>(null);
  const runResults = ref<Record<string, MockApiRunResult>>({});

  function setMockApis(value: CanvasGetResponse["mockApis"]) {
    mockApis.value = value;
  }
  function setMockDraft(value: MockApiDraft[]) {
    mockDraft.value = value;
  }
  function setEnvironmentVariables(value: EnvironmentVariable[]) {
    environmentVariables.value = value;
  }
  function setHeaderTemplates(value: HeaderTemplateDraft[]) {
    const clone = () =>
      value.map((item) => ({ ...item, headers: item.headers.map((row) => ({ ...row })) }));
    headerTemplates.value = clone();
    savedHeaderTemplates.value = clone();
  }
  function restoreHeaderTemplates() {
    headerTemplates.value = savedHeaderTemplates.value.map((item) => ({
      ...item,
      headers: item.headers.map((row) => ({ ...row })),
    }));
  }
  function setAuthorizationTemplates(value: AuthorizationTemplateDraft[]) {
    authorizationTemplates.value = value.map((item) => ({ ...item }));
    savedAuthorizationTemplates.value = value.map((item) => ({ ...item }));
  }
  function restoreAuthorizationTemplates() {
    authorizationTemplates.value = savedAuthorizationTemplates.value.map((item) => ({ ...item }));
  }
  function setSavedEnvironmentVariableIds(value: string[]) {
    savedEnvironmentVariableIds.value = value;
  }
  function setSavedEnvironmentVariableValues(value: EnvironmentVariableValues) {
    savedEnvironmentVariableValues.value = value;
  }
  function addMockDraft(value: MockApiDraft) {
    mockDraft.value.push(value);
  }
  function removeMockDraft(index: number) {
    mockDraft.value.splice(index, 1);
  }
  function deleteEnvironmentVariable(id: string) {
    environmentVariables.value = environmentVariables.value.filter(
      (variable) => variable.id !== id,
    );
  }
  function setRunningMockId(id: string | null) {
    runningMockId.value = id;
  }
  function setRunResult(id: string, result: MockApiRunResult) {
    runResults.value[id] = result;
  }
  function clearRunResults() {
    runResults.value = {};
  }
  return {
    mockApis,
    mockDraft,
    environmentVariables,
    headerTemplates,
    savedHeaderTemplates,
    authorizationTemplates,
    savedAuthorizationTemplates,
    savedEnvironmentVariableIds,
    savedEnvironmentVariableValues,
    runningMockId,
    runResults,
    setMockApis,
    setMockDraft,
    setEnvironmentVariables,
    setHeaderTemplates,
    restoreHeaderTemplates,
    setAuthorizationTemplates,
    restoreAuthorizationTemplates,
    setSavedEnvironmentVariableIds,
    setSavedEnvironmentVariableValues,
    addMockDraft,
    removeMockDraft,
    deleteEnvironmentVariable,
    setRunningMockId,
    setRunResult,
    clearRunResults,
  };
});
