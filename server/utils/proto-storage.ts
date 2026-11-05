import { createStorage } from "unstorage";
import fsDriver from "unstorage/drivers/fs";
import s3Driver from "unstorage/drivers/s3";

function createProtoStorage() {
  if ((process.env.PROTO_STORAGE_DRIVER ?? "fs") === "s3") {
    const required = (name: string) => {
      const value = process.env[name]?.trim();
      if (!value) throw new Error(`Missing required environment variable: ${name}`);
      return value;
    };

    return createStorage({
      driver: s3Driver({
        endpoint: required("PROTO_STORAGE_S3_ENDPOINT"),
        region: required("PROTO_STORAGE_S3_REGION"),
        bucket: required("PROTO_STORAGE_S3_BUCKET"),
        accessKeyId: required("PROTO_STORAGE_S3_ACCESS_KEY_ID"),
        secretAccessKey: required("PROTO_STORAGE_S3_SECRET_ACCESS_KEY"),
      }),
    });
  }

  if ((process.env.PROTO_STORAGE_DRIVER ?? "fs") !== "fs") {
    throw new Error("PROTO_STORAGE_DRIVER must be fs or s3");
  }

  return createStorage({
    driver: fsDriver({ base: process.env.PROTO_STORAGE_FS_BASE ?? "/app/data/protos" }),
  });
}

const protoStorage = createProtoStorage();

export function putProtoFile(key: string, content: string) {
  return protoStorage.setItem(key, content);
}

export function getProtoFile(key: string) {
  return protoStorage.getItem<string>(key);
}

export function removeProtoFile(key: string) {
  return protoStorage.removeItem(key);
}
