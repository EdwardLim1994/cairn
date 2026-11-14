import { describe, expect, it, vi } from "vite-plus/test";
import { createCheckMessageDestinationHealthUseCase } from "../index";

describe("message destination health", () => {
  it("reports broker connectivity and authentication failures per destination", async () => {
    const checkKafka = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const checkRabbitMq = vi.fn().mockResolvedValue(false);
    const useCase = createCheckMessageDestinationHealthUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      listTargets: vi.fn().mockResolvedValue([
        {
          id: "kafka-online",
          broker: "kafka",
          connection: { brokers: "localhost:9092", securityProtocol: "PLAINTEXT" },
        },
        {
          id: "kafka-auth-failed",
          broker: "kafka",
          connection: {
            brokers: "localhost:9092",
            securityProtocol: "SASL_SSL",
            username: "operator",
            passwordVariable: "KAFKA_PASSWORD",
          },
          password: "wrong-secret",
        },
        {
          id: "rabbit-offline",
          broker: "rabbitmq",
          connection: { host: "localhost", port: 5672, virtualHost: "/", tls: false },
        },
      ]),
      checkKafka,
      checkRabbitMq,
    });

    await expect(useCase()).resolves.toEqual([
      { id: "kafka-online", online: true },
      { id: "kafka-auth-failed", online: false },
      { id: "rabbit-offline", online: false },
    ]);
    expect(checkKafka).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ username: "operator" }),
      "wrong-secret",
    );
    expect(checkRabbitMq).toHaveBeenCalledOnce();
  });
});
