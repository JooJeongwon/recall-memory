// The full Workers runtime declarations replace browser DOM globals, so only expose the generated bindings here.
declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}
