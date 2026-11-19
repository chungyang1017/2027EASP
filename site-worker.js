// 會議網站的 Worker（2026-10-13）：舊網址 taiwan.easp2027.workers.dev 和 www 都 301 轉到 easpfiss2027.org，
// 新網域的 http:// 也 301 轉到 https://（2026-10-15，Google 把 http 版當成重複頁面）。其他請求直接交給靜態檔案（網頁/）。
const CANONICAL = "easpfiss2027.org";
// 舊網址是否轉到新網域。2026-10-13 22:00 確認 .org 已發布、各大公共 DNS 都查得到後打開。
const REDIRECT_WORKERS_DEV = true;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname !== CANONICAL && ((REDIRECT_WORKERS_DEV && url.hostname.endsWith(".workers.dev")) || url.hostname === `www.${CANONICAL}`)) {
      url.protocol = "https:";
      url.hostname = CANONICAL;
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    if (url.hostname === CANONICAL && url.protocol === "http:") {
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
