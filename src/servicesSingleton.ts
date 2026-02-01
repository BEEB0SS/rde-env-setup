import type { Services } from "./services";

let services: Services | undefined;

/**
 * Called exactly once during extension activation.
 */
export function setServices(s: Services) {
  services = s;
}

/**
 * Used anywhere else in the extension to access shared services.
 */
export function getServices(): Services {
  if (!services) {
    throw new Error("RDE services not initialized. Did you call setServices() in activate()?");
  }
  return services;
}

