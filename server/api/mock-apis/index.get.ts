import { mockApiListResponseSchema } from "#shared/api/mock-apis";
import { listMockApis } from "../../repositories/mock-apis";
import { ensureProject } from "../../utils/project";
import { createListMockApisUseCase } from "../../use-cases/mock-apis/list-mock-apis";

const listMockApisUseCase = createListMockApisUseCase({ ensureProject, listMockApis });

export default defineEventHandler(async () =>
  mockApiListResponseSchema.parse(await listMockApisUseCase()),
);
