import { describe, expect, it, vi } from "vite-plus/test";
import {
  DuplicateEnvironmentVariableError,
  EnvironmentVariableNotFoundError,
} from "../../repositories/environment-variables/errors";
import { createCreateEnvironmentVariableUseCase } from "./create-environment-variable";
import { createDeleteEnvironmentVariableUseCase } from "./delete-environment-variable";
import { createListEnvironmentVariablesUseCase } from "./list-environment-variables";
import { createUpdateEnvironmentVariableUseCase } from "./update-environment-variable";

const value = { name: "API_TOKEN", value: "secret" };

describe("environment variable endpoint use cases", () => {
  it("lists variables for the current project", async () => {
    const listEnvironmentVariables = vi.fn().mockResolvedValue([{ id: "variable-1" }]);
    const useCase = createListEnvironmentVariablesUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      listEnvironmentVariables,
    });
    await expect(useCase()).resolves.toEqual([{ id: "variable-1" }]);
    expect(listEnvironmentVariables).toHaveBeenCalledWith("project-1");
  });

  it("creates a variable and rejects duplicate names", async () => {
    const createEnvironmentVariable = vi.fn().mockResolvedValue(undefined);
    const useCase = createCreateEnvironmentVariableUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      findByName: vi.fn().mockResolvedValue(false),
      createEnvironmentVariable,
      newId: () => "variable-1",
    });
    await expect(useCase(value)).resolves.toEqual({ id: "variable-1" });
    expect(createEnvironmentVariable).toHaveBeenCalledWith("variable-1", "project-1", value);
    const duplicate = createCreateEnvironmentVariableUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      findByName: vi.fn().mockResolvedValue(true),
      createEnvironmentVariable: vi.fn(),
    });
    await expect(duplicate(value)).rejects.toBeInstanceOf(DuplicateEnvironmentVariableError);
  });

  it("updates a variable and rejects missing or duplicate entries", async () => {
    const updateEnvironmentVariable = vi.fn().mockResolvedValue(undefined);
    const useCase = createUpdateEnvironmentVariableUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      findEnvironmentVariable: vi.fn().mockResolvedValue(true),
      findByName: vi.fn().mockResolvedValue(false),
      updateEnvironmentVariable,
    });
    await expect(useCase("variable-1", value)).resolves.toEqual({ id: "variable-1" });
    expect(updateEnvironmentVariable).toHaveBeenCalledWith("variable-1", "project-1", value);
    const missing = createUpdateEnvironmentVariableUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      findEnvironmentVariable: vi.fn().mockResolvedValue(false),
      findByName: vi.fn(),
      updateEnvironmentVariable: vi.fn(),
    });
    await expect(missing("missing", value)).rejects.toBeInstanceOf(
      EnvironmentVariableNotFoundError,
    );
  });

  it("deletes a variable for the current project", async () => {
    const deleteEnvironmentVariable = vi.fn().mockResolvedValue(undefined);
    const useCase = createDeleteEnvironmentVariableUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      deleteEnvironmentVariable,
    });
    await expect(useCase("variable-1")).resolves.toEqual({ id: "variable-1" });
    expect(deleteEnvironmentVariable).toHaveBeenCalledWith("project-1", "variable-1");
  });
});
