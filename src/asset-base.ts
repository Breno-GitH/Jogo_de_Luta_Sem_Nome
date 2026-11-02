/** Resolve from the compiled JS chunk, not the page pathname. The same build
 * can be mounted at either Apache alias, including every nested art page. */
const entryUrl = import.meta.url;
export const assetBase = new URL(import.meta.env.DEV ? "/" : "../", entryUrl)
  .href;
export const socketPath = import.meta.env.DEV
  ? "/socket.io"
  : new URL("socket.io", assetBase).pathname;
