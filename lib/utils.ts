import JSON5 from "json5";
import { clsx } from "clsx";

import type { ConfigRecord } from "@/lib/types";

export const cn = (...inputs: Array<string | false | null | undefined>) =>
  clsx(inputs);

export const nowIso = () => new Date().toISOString();

export const hashText = (text: string) =>
  Math.abs(
    Array.from(text).reduce((acc, character) => (acc * 33 + character.charCodeAt(0)) | 0, 5381),
  )
    .toString(16)
    .slice(0, 12);

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
};

export const stableStringify = (value: unknown) =>
  JSON.stringify(stableValue(value), null, 2);

export const parseConfigText = (text: string): ConfigRecord =>
  JSON5.parse(text) as ConfigRecord;

export const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !(value instanceof Date);

export const deepMerge = (
  target: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(patch)) {
    const currentValue = result[key];

    if (isPlainObject(currentValue) && isPlainObject(value)) {
      result[key] = deepMerge(currentValue, value);
      continue;
    }

    result[key] = value;
  }

  return result;
};

export const getAtPath = (obj: unknown, keyPath: string): unknown => {
  return keyPath.split(".").reduce<unknown>((current, segment) => {
    if (current === undefined || current === null) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isNaN(index) ? undefined : current[index];
    }

    if (typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, obj);
};

export const setAtPath = (
  obj: Record<string, unknown>,
  keyPath: string,
  value: unknown,
) => {
  const segments = keyPath.split(".");
  const clone = structuredClone(obj);
  let current: Record<string, unknown> = clone;

  segments.forEach((segment, index) => {
    const isLeaf = index === segments.length - 1;

    if (isLeaf) {
      current[segment] = value;
      return;
    }

    const next = current[segment];
    if (!isPlainObject(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  });

  return clone;
};

export const flattenEntries = (
  value: unknown,
  prefix = "",
): Array<{ path: string; value: unknown }> => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      flattenEntries(item, prefix ? `${prefix}.${index}` : `${index}`),
    );
  }

  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, nested]) =>
      flattenEntries(nested, prefix ? `${prefix}.${key}` : key),
    );
  }

  return [{ path: prefix, value }];
};

export const previewValue = (value: unknown) => {
  if (typeof value === "string") {
    if (value.length > 48) {
      return `${value.slice(0, 20)}...${value.slice(-8)}`;
    }
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }

  return JSON.stringify(value);
};

export const humanizeKey = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const redactSecret = (value: string) => {
  if (value.startsWith("$env:") || value.startsWith("$file:") || value.startsWith("$exec:")) {
    return value;
  }

  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}********${value.slice(-4)}`;
};

export const isSecretLike = (keyPath: string, value: unknown) => {
  if (typeof value !== "string") {
    return false;
  }

  if (
    value.startsWith("$env:") ||
    value.startsWith("$file:") ||
    value.startsWith("$exec:")
  ) {
    return false;
  }

  const normalizedPath = keyPath.toLowerCase();
  if (/(token|secret|apikey|api_key|password|webhook|privatekey|auth)/.test(normalizedPath)) {
    return true;
  }

  return Boolean(
    value.match(
      /(sk-[\w-]{8,}|ghp_[\w-]{8,}|\d{6,}:[A-Za-z0-9_-]{10,}|https:\/\/hooks\.slack\.com\/services\/.+)/,
    ),
  );
};

export const redactSecretsDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecretsDeep(item));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, nested]) => {
      acc[key] = redactSecretsDeep(nested);
      return acc;
    }, {});
  }

  if (typeof value === "string" && isSecretLike("value", value)) {
    return redactSecret(value);
  }

  return value;
};

export const quoteShell = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;
