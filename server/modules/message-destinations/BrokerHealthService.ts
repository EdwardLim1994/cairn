import { connect as connectRabbitMq } from "amqplib";
import { Kafka, type SASLOptions } from "kafkajs";
import type { KafkaConnection, RabbitMqConnection } from "#shared/api/message-flows";

function saslCredentials(connection: KafkaConnection, password: string): SASLOptions {
  const credentials = { username: connection.username!, password };
  switch (connection.saslMechanism ?? "plain") {
    case "scram-sha-256":
      return { mechanism: "scram-sha-256", ...credentials };
    case "scram-sha-512":
      return { mechanism: "scram-sha-512", ...credentials };
    default:
      return { mechanism: "plain", ...credentials };
  }
}

/** Checks broker connectivity without creating or inspecting destinations. */
export class BrokerHealthService {
  async checkKafka(connection: KafkaConnection, password?: string) {
    if (connection.securityProtocol.startsWith("SASL") && (!connection.username || !password))
      return false;
    const kafka = new Kafka({
      clientId: connection.clientId ?? "cairn-health-check",
      brokers: connection.brokers.split(",").map((broker) => broker.trim()),
      connectionTimeout: 2000,
      requestTimeout: 2000,
      ssl: connection.securityProtocol === "SSL" || connection.securityProtocol === "SASL_SSL",
      ...(connection.securityProtocol.startsWith("SASL")
        ? { sasl: saslCredentials(connection, password!) }
        : {}),
    });
    const admin = kafka.admin();
    let connected = false;
    try {
      await admin.connect();
      connected = true;
      await admin.describeCluster();
      return true;
    } catch {
      return false;
    } finally {
      if (connected) await admin.disconnect().catch(() => undefined);
    }
  }

  async checkRabbitMq(connection: RabbitMqConnection, password?: string) {
    if (connection.username && !password) return false;
    let client: Awaited<ReturnType<typeof connectRabbitMq>> | undefined;
    try {
      client = await connectRabbitMq(
        {
          protocol: connection.tls ? "amqps" : "amqp",
          hostname: connection.host,
          port: connection.port,
          username: connection.username ?? "guest",
          password: password ?? "guest",
          vhost: connection.virtualHost,
          heartbeat: 5,
        },
        { timeout: 2000 },
      );
      const channel = await client.createChannel();
      await channel.close();
      return true;
    } catch {
      return false;
    } finally {
      if (client) await client.close().catch(() => undefined);
    }
  }
}
