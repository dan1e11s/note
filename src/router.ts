export type RouteParams = Record<string, string>;

export interface RouteContext {
  path: string;
  params: RouteParams;
}

export type RouteHandler = (context: RouteContext) => void;

interface CompiledRoute {
  pattern: RegExp;
  keys: string[];
  handler: RouteHandler;
}

export class Router {
  private readonly routes: CompiledRoute[] = [];
  private fallbackHandler: RouteHandler | null = null;

  on(path: string, handler: RouteHandler): this {
    const keys: string[] = [];
    const source = path
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/:(\w+)/g, (_, key: string) => {
        keys.push(key);
        return "([^/]+)";
      });

    this.routes.push({
      pattern: new RegExp("^" + source + "$"),
      keys,
      handler
    });
    return this;
  }

  fallback(handler: RouteHandler): this {
    this.fallbackHandler = handler;
    return this;
  }

  start(): void {
    window.addEventListener("hashchange", () => this.resolve());
    this.resolve();
  }

  navigate(path: string): void {
    const target = "#" + path;
    if (window.location.hash === target) {
      this.resolve();
      return;
    }
    window.location.hash = target;
  }

  private resolve(): void {
    const path = this.readPath();

    for (const route of this.routes) {
      const match = route.pattern.exec(path);
      if (match === null) {
        continue;
      }

      const params: RouteParams = {};
      route.keys.forEach((key, index) => {
        const value = match[index + 1];
        params[key] = value === undefined ? "" : decodeURIComponent(value);
      });

      route.handler({ path, params });
      return;
    }

    if (this.fallbackHandler !== null) {
      this.fallbackHandler({ path, params: {} });
    }
  }

  private readPath(): string {
    const hash = window.location.hash.slice(1);
    return hash.length > 0 ? hash : "/";
  }
}
