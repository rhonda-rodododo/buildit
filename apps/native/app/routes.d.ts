// deno-lint-ignore-file
/* eslint-disable */
// biome-ignore: needed import
import type { OneRouter } from 'one'

declare module 'one' {
  export namespace OneRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(tabs)` | `/(tabs)/groups` | `/(tabs)/home` | `/(tabs)/messages` | `/(tabs)/settings` | `/_sitemap` | `/compose` | `/groups` | `/home` | `/import` | `/login` | `/messages` | `/scan` | `/settings`
      DynamicRoutes: `/chat/${OneRouter.SingleRoutePart<T>}`
      DynamicRouteTemplate: `/chat/[pubkey]`
      IsTyped: true
      RouteTypes: {
        '/chat/[pubkey]': RouteInfo<{ pubkey: string }>
      }
    }
  }
}

/**
 * Helper type for route information
 */
type RouteInfo<Params = Record<string, never>> = {
  Params: Params
  LoaderProps: { path: string; params: Params; request?: Request }
}