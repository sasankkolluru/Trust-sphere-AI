import type { DomainPlugin } from "./types.js";
import { ECommercePlugin, RecruitmentPlugin, SocialMediaPlugin, WebsiteBusinessPlugin } from "./plugins.js";

export const domainPlugins: readonly DomainPlugin[] = [
  ECommercePlugin,
  RecruitmentPlugin,
  SocialMediaPlugin,
  WebsiteBusinessPlugin,
];

const pluginMap = new Map(domainPlugins.map((plugin) => [plugin.name, plugin]));

export function getDomainPlugin(domain: string): DomainPlugin | undefined {
  return pluginMap.get(domain.trim().toLowerCase());
}

export function listDomainPlugins(): readonly DomainPlugin[] {
  return domainPlugins;
}
