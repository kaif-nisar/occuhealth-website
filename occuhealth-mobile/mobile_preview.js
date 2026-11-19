import http from 'http';
import https from 'https';
import os from 'os';
import fs from 'fs';
import { spawn } from 'child_process';

const TARGET_HOST = 'occuhealth.in';
const PROXY_PORT = 3005;
const FLUTTER_PORT = 8080;

// Stores the latest authenticated JWT seen from the Flutter app so embedded iframe
// requests remain authenticated even when mobile browsers block cross-port cookies.
let latestEmbedToken = '';

// Clean mobile-embed CSS & auto-prepare script injected into /admin/admin.html
const MOBILE_EMBED_SNIPPET = `
<style id="oh-mobile-embed-css">
  html.oh-mobile-embed, body.oh-mobile-embed {
    overflow-x: auto !important;
    background: #f8fafc !important;
  }
  html.oh-mobile-embed #left-navbar,
  html.oh-mobile-embed .left-navbar,
  html.oh-mobile-embed #top-navbar,
  html.oh-mobile-embed .top-navbar,
  html.oh-mobile-embed .oh-verify-container,
  html.oh-mobile-embed #mobileMessage {
    display: none !important;
    visibility: hidden !important;
    width: 0 !important;
    height: 0 !important;
  }
  html.oh-mobile-embed .full-width {
    display: block !important;
    padding: 0 !important;
    margin: 0 !important;
    width: 100% !important;
  }
  html.oh-mobile-embed #content-box,
  html.oh-mobile-embed .content-box {
    margin: 0 !important;
    margin-left: 0 !important;
    margin-top: 0 !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    min-height: 100vh !important;
    padding: 8px !important;
    box-sizing: border-box !important;
  }
</style>
<script id="oh-mobile-embed-js">
  (function () {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('embed') === 'mobile') {
        sessionStorage.setItem('oh_embed_mobile', '1');
      }
      if (sessionStorage.getItem('oh_embed_mobile') === '1') {
        document.documentElement.classList.add('oh-mobile-embed');
        document.addEventListener('DOMContentLoaded', function () {
          document.body.classList.add('oh-mobile-embed');
        });
      }

      // Always clear stale cached booking when a different value1 bookingId is opened
      var v1 = params.get('value1');
      if (v1) {
        try {
          var existing = JSON.parse(localStorage.getItem('booking') || 'null');
          if (existing && existing.bookingId !== v1 && existing._id !== v1) {
            localStorage.removeItem('booking');
          }
        } catch (e) {}
      }

      // Auto-sync rendered reportFormat DOM to /api/v1/user/adding-pdf-data so server PDF matches website 100%
      var pageName = String(params.get('page') || '');
      var wantAutoPrepare = params.get('autoPrepare') === '1' || /^reportFormat/i.test(pageName);
      if (wantAutoPrepare && /^reportFormat/i.test(pageName)) {
        var notifyPrepared = function (ok, detail) {
          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'OH_REPORT_PREPARED', ok: Boolean(ok), value1: v1, detail: detail || '' }, '*');
            }
          } catch (e) {}
          try {
            if (window.OHBridge && typeof window.OHBridge.postMessage === 'function') {
              window.OHBridge.postMessage(JSON.stringify({ type: 'OH_REPORT_PREPARED', ok: Boolean(ok), value1: v1, detail: detail || '' }));
            }
          } catch (e) {}
        };

        var syncedOnce = false;
        var tries = 0;
        var pollTimer = setInterval(async function () {
          tries++;
          if (syncedOnce || tries > 45) {
            clearInterval(pollTimer);
            if (!syncedOnce) notifyPrepared(false, 'timeout');
            return;
          }

          var dock = document.querySelector('.download-pdf-div');
          var dockReady = dock && (dock.classList.contains('is-ready') || window.getComputedStyle(dock).display !== 'none');
          var headerEl = document.querySelector('.report-details');
          var footerEl = document.querySelector('.signed-off-div') || document.querySelector('.signed-off-div2');
          var styleEl = document.getElementById('stying');
          var hasBody = Boolean(document.querySelector('.container2 .section, .sheet-body .section, #tables-container .section'));

          if (!dockReady || !headerEl || !footerEl || !styleEl || !hasBody) {
            return;
          }

          syncedOnce = true;
          clearInterval(pollTimer);

          setTimeout(async function () {
            try {
              var saveBtn = document.getElementById('savePDF');
              if (saveBtn) {
                var origFetch = window.fetch;
                var resolved = false;
                window.fetch = function () {
                  var urlArg = arguments[0];
                  var p = origFetch.apply(this, arguments);
                  if (typeof urlArg === 'string' && urlArg.indexOf('adding-pdf-data') !== -1) {
                    p.then(function (r) {
                      if (!resolved) {
                        resolved = true;
                        window.fetch = origFetch;
                        notifyPrepared(r && r.ok, 'savePDF');
                      }
                    }).catch(function () {
                      if (!resolved) {
                        resolved = true;
                        window.fetch = origFetch;
                        notifyPrepared(false, 'savePDF-error');
                      }
                    });
                  }
                  return p;
                };
                saveBtn.click();
                setTimeout(function () {
                  if (!resolved) {
                    resolved = true;
                    window.fetch = origFetch;
                    notifyPrepared(true, 'savePDF-timeout');
                  }
                }, 4000);
                return;
              }

              var containerEl = document.querySelector('.container2');
              if (!containerEl) {
                notifyPrepared(false, 'no-container2');
                return;
              }
              var repRes = await fetch('/api/v1/user/ReportData', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value1: v1 })
              });
              var rep = repRes.ok ? await repRes.json() : null;
              var docRes = await fetch('/api/v1/user/getDoctorsSign').catch(function () { return null; });
              var docJson = (docRes && docRes.ok) ? await docRes.json().catch(function () { return null; }) : null;
              var docData = (docJson && docJson.data) ? docJson.data : (docJson || {});
              var rectH = headerEl.getBoundingClientRect ? Math.round(headerEl.getBoundingClientRect().height) : 135;
              var invMargin = Math.max(115, Math.min(260, rectH || 135));
              if (pageName === 'reportFormat4') invMargin += 20;

              var savePayload = {
                htmlContent: containerEl.outerHTML,
                cssContent: styleEl.innerHTML,
                header: headerEl.outerHTML,
                footer: footerEl.outerHTML,
                reportId: (rep && rep._id) ? rep._id : v1,
                bookingId: (rep && rep.bookingId) ? rep.bookingId : v1,
                investigationmargin: invMargin,
                format: pageName
              };
              if (typeof docData.showlabinchargesign === 'boolean') savePayload.showlab = docData.showlabinchargesign;
              if (typeof docData.showfirstdoctorsign === 'boolean') savePayload.showdoctorfirst = docData.showfirstdoctorsign;
              if (typeof docData.showseconddoctorsign === 'boolean') savePayload.showdoctorsecond = docData.showseconddoctorsign;

              var addRes = await fetch('/api/v1/user/adding-pdf-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(savePayload)
              });
              notifyPrepared(addRes && addRes.ok, 'legacy-sync');
            } catch (err) {
              notifyPrepared(false, String(err && err.message || err));
            }
          }, 450);
        }, 350);
      }
    } catch (e) {}
  })();
</script>
`;

// Headers that prevent embedding inside a cross-port iframe on Chrome/Safari
const BLOCKED_RESPONSE_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'cross-origin-resource-policy',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'origin-agent-cluster',
  'strict-transport-security',
]);

function getLanIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const [name, list] of Object.entries(interfaces)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const isVirtual = /vethernet|vmware|virtualbox|wsl|docker|hyper-v/i.test(name);
        ips.push({ name, address: iface.address, isVirtual });
      }
    }
  }
  ips.sort((a, b) => {
    if (a.isVirtual !== b.isVirtual) return a.isVirtual ? 1 : -1;
    const aWiFi = /wi-?fi|wireless|wlan/i.test(a.name) ? 0 : 1;
    const bWiFi = /wi-?fi|wireless|wlan/i.test(b.name) ? 0 : 1;
    return aWiFi - bWiFi;
  });
  return ips;
}

function sanitizeSetCookie(cookies) {
  if (!cookies) return undefined;
  const arr = Array.isArray(cookies) ? cookies : [cookies];
  return arr.map((c) =>
    c
      .replace(/;\s*Domain=[^;]+/gi, '')
      .replace(/;\s*Secure/gi, '')
      .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
  );
}

function startCorsProxy() {
  const server = http.createServer((req, res) => {
    const reqOrigin = req.headers.origin || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': reqOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers':
        req.headers['access-control-request-headers'] ||
        'Content-Type, Authorization, Accept, X-Requested-With',
      'Access-Control-Expose-Headers': 'Content-Disposition, Content-Type',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Access-Control-Max-Age': '86400',
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    // Capture Bearer token from normal Flutter API calls as a fallback for iframe requests
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const bearer = authHeader.slice(7).trim();
      if (bearer) latestEmbedToken = bearer;
    }

    // Authenticated embed entry point for Enter Result (labreport) & Assigned Report Format pages
    if (req.url && req.url.startsWith('/mobile-embed')) {
      try {
        const parsed = new URL(req.url, `http://localhost:${PROXY_PORT}`);
        const page = parsed.searchParams.get('page') || 'labreport';
        const value1 = parsed.searchParams.get('value1') || '';
        const token = parsed.searchParams.get('token') || latestEmbedToken || '';
        const autoPrepare = parsed.searchParams.get('autoPrepare') === '1' ? '&autoPrepare=1' : '';
        if (token) {
          latestEmbedToken = token;
        }
        const targetLocation = `/admin/admin.html?page=${encodeURIComponent(page)}&value1=${encodeURIComponent(value1)}&embed=mobile${autoPrepare}`;
        const headers = {
          ...corsHeaders,
          Location: targetLocation,
          'Cache-Control': 'no-store',
        };
        if (token) {
          headers['Set-Cookie'] = `accessToken=${token}; Path=/; SameSite=Lax`;
        }
        res.writeHead(302, headers);
        res.end();
        return;
      } catch (err) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'text/plain' });
        res.end('Invalid mobile-embed parameters');
        return;
      }
    }

    const isAdminHtml = req.url && /^\/admin\/admin\.html(\?|$)/i.test(req.url);

    const forwardHeaders = { ...req.headers };
    delete forwardHeaders.host;
    delete forwardHeaders.origin;
    delete forwardHeaders.referer;
    forwardHeaders.host = TARGET_HOST;
    forwardHeaders.origin = 'https://www.occuhealth.in';
    forwardHeaders.referer = 'https://www.occuhealth.in/';

    // Ensure embedded iframe sub-requests always carry accessToken even if browser partitions cookies
    const existingCookie = String(forwardHeaders.cookie || '');
    const hasAccessCookie = /(?:^|;\s*)accessToken=/.test(existingCookie);
    if (!hasAccessCookie && latestEmbedToken) {
      forwardHeaders.cookie = existingCookie
        ? `${existingCookie}; accessToken=${latestEmbedToken}`
        : `accessToken=${latestEmbedToken}`;
    }
    if (!forwardHeaders.authorization && latestEmbedToken) {
      forwardHeaders.authorization = `Bearer ${latestEmbedToken}`;
    }

    if (isAdminHtml) {
      forwardHeaders['accept-encoding'] = 'identity';
    }

    const proxyReq = https.request(
      {
        hostname: TARGET_HOST,
        port: 443,
        path: req.url,
        method: req.method,
        headers: forwardHeaders,
      },
      (proxyRes) => {
        const resHeaders = {};
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          const lower = k.toLowerCase();
          if (lower.startsWith('access-control-') || BLOCKED_RESPONSE_HEADERS.has(lower)) {
            continue;
          }
          if (lower === 'set-cookie') {
            resHeaders[k] = sanitizeSetCookie(v);
            continue;
          }
          // Keep any server redirect inside our local proxy so the iframe never hits X-Frame-Options
          if (lower === 'location' && typeof v === 'string') {
            resHeaders[k] = v.replace(/^https?:\/\/(?:www\.)?occuhealth\.in/i, '');
            continue;
          }
          resHeaders[k] = v;
        }
        Object.assign(resHeaders, corsHeaders);

        // Inject clean mobile-embed CSS/JS into /admin/admin.html
        if (isAdminHtml && (proxyRes.statusCode || 200) === 200) {
          const chunks = [];
          proxyRes.on('data', (chunk) => chunks.push(chunk));
          proxyRes.on('end', () => {
            let html = Buffer.concat(chunks).toString('utf8');
            if (html.includes('</head>')) {
              html = html.replace('</head>', `${MOBILE_EMBED_SNIPPET}</head>`);
            } else {
              html = `${MOBILE_EMBED_SNIPPET}${html}`;
            }
            delete resHeaders['content-length'];
            delete resHeaders['content-encoding'];
            resHeaders['content-type'] = 'text/html; charset=utf-8';
            res.writeHead(200, resHeaders);
            res.end(html);
          });
          return;
        }

        res.writeHead(proxyRes.statusCode || 200, resHeaders);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      console.error(`[CORS Proxy Error] ${req.method} ${req.url}:`, err.message);
      if (!res.headersSent) {
        res.writeHead(502, {
          ...corsHeaders,
          'Content-Type': 'application/json',
        });
      }
      res.end(
        JSON.stringify({
          success: false,
          message: `Proxy error connecting to ${TARGET_HOST}: ${err.message}`,
        })
      );
    });

    req.pipe(proxyReq);
  });

  server.listen(PROXY_PORT, '0.0.0.0', () => {
    const ips = getLanIps();
    const primaryIp = ips.length > 0 ? ips[0].address : 'localhost';

    console.log('\n============================================================');
    console.log('  OccuHealth Mobile Preview (CORS-Free + Embedded Portal)');
    console.log('============================================================');
    console.log(`  CORS Proxy Running : http://${primaryIp}:${PROXY_PORT} -> https://${TARGET_HOST}`);
    console.log(`  Open on Mobile     : http://${primaryIp}:${FLUTTER_PORT}`);
    console.log(`  Open on Laptop     : http://localhost:${FLUTTER_PORT}`);
    if (ips.length > 1) {
      console.log(
        '  Other detected IPs : ' +
          ips.slice(1).map((i) => `http://${i.address}:${FLUTTER_PORT} (${i.name})`).join(', ')
      );
    }
    console.log('------------------------------------------------------------');
    console.log('  Keep Laptop & Mobile on the SAME Wi-Fi.');
    console.log('  Press "r" for Hot Reload, "R" for Hot Restart, "q" to Quit.');
    console.log('============================================================\n');
  });

  return server;
}

const proxyServer = startCorsProxy();

const knownFlutterBat = 'C:\\Users\\kaifx\\flutter\\bin\\flutter.bat';
const flutterCmd = fs.existsSync(knownFlutterBat) ? `"${knownFlutterBat}"` : 'flutter';

const flutterProc = spawn(
  `${flutterCmd} run -d web-server --web-port ${FLUTTER_PORT} --web-hostname 0.0.0.0`,
  {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  }
);

function cleanup() {
  try {
    proxyServer.close();
  } catch (_) {}
  try {
    flutterProc.kill();
  } catch (_) {}
  process.exit(0);
}

flutterProc.on('exit', (code) => {
  proxyServer.close();
  process.exit(code ?? 0);
});

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
