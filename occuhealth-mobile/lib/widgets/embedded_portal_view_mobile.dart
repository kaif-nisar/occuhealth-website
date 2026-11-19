import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../services/storage_service.dart';
import '../theme/app_colors.dart';

class EmbeddedPortalView extends StatefulWidget {
  final String page;
  final String value1;
  final bool autoPrepare;
  final VoidCallback? onLoaded;
  final ValueChanged<bool>? onPrepared;

  const EmbeddedPortalView({
    super.key,
    required this.page,
    required this.value1,
    this.autoPrepare = false,
    this.onLoaded,
    this.onPrepared,
  });

  @override
  State<EmbeddedPortalView> createState() => _EmbeddedPortalViewState();
}

class _EmbeddedPortalViewState extends State<EmbeddedPortalView> {
  WebViewController? _controller;
  bool _isLoading = true;
  String? _error;
  bool _preparedNotified = false;

  static const String _injectMobileEmbedJs = '''
    (function() {
      try {
        sessionStorage.setItem('oh_embed_mobile', '1');
        if (!document.getElementById('oh-mobile-embed-css')) {
          var style = document.createElement('style');
          style.id = 'oh-mobile-embed-css';
          style.textContent = `
            #left-navbar, .left-navbar, #top-navbar, .top-navbar, .oh-verify-container, #mobileMessage {
              display: none !important;
              visibility: hidden !important;
              width: 0 !important;
              height: 0 !important;
            }
            .full-width {
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
            }
            #content-box, .content-box {
              margin: 0 !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: 100vh !important;
              padding: 8px !important;
              box-sizing: border-box !important;
            }
          `;
          document.head.appendChild(style);
        }
      } catch (e) {}
    })();
  ''';

  String _buildAutoPrepareJs() {
    final safePage = jsonEncode(widget.page);
    final safeVal = jsonEncode(widget.value1);
    return '''
      (function() {
        if (window.__ohAutoPrepareStarted) return;
        window.__ohAutoPrepareStarted = true;
        var pageName = $safePage;
        var v1 = $safeVal;
        if (!/^reportFormat/i.test(pageName)) return;

        var notify = function(ok, detail) {
          try {
            if (window.OHBridge && typeof window.OHBridge.postMessage === 'function') {
              window.OHBridge.postMessage(JSON.stringify({ type: 'OH_REPORT_PREPARED', ok: Boolean(ok), value1: v1, detail: detail || '' }));
            }
          } catch (e) {}
        };

        var synced = false;
        var tries = 0;
        var timer = setInterval(function() {
          tries++;
          if (synced || tries > 45) {
            clearInterval(timer);
            if (!synced) notify(false, 'timeout');
            return;
          }
          var dock = document.querySelector('.download-pdf-div');
          var dockReady = dock && (dock.classList.contains('is-ready') || window.getComputedStyle(dock).display !== 'none');
          var headerEl = document.querySelector('.report-details');
          var footerEl = document.querySelector('.signed-off-div') || document.querySelector('.signed-off-div2');
          var styleEl = document.getElementById('stying');
          var hasBody = Boolean(document.querySelector('.container2 .section, .sheet-body .section, #tables-container .section'));
          if (!dockReady || !headerEl || !footerEl || !styleEl || !hasBody) return;

          synced = true;
          clearInterval(timer);

          setTimeout(async function() {
            try {
              var saveBtn = document.getElementById('savePDF');
              if (saveBtn) {
                var origFetch = window.fetch;
                var done = false;
                window.fetch = function() {
                  var urlArg = arguments[0];
                  var p = origFetch.apply(this, arguments);
                  if (typeof urlArg === 'string' && urlArg.indexOf('adding-pdf-data') !== -1) {
                    p.then(function(r) {
                      if (!done) { done = true; window.fetch = origFetch; notify(r && r.ok, 'savePDF'); }
                    }).catch(function() {
                      if (!done) { done = true; window.fetch = origFetch; notify(false, 'savePDF-error'); }
                    });
                  }
                  return p;
                };
                saveBtn.click();
                setTimeout(function() {
                  if (!done) { done = true; window.fetch = origFetch; notify(true, 'savePDF-timeout'); }
                }, 4000);
                return;
              }

              var containerEl = document.querySelector('.container2');
              if (!containerEl) { notify(false, 'no-container2'); return; }
              var repRes = await fetch('/api/v1/user/ReportData', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value1: v1 })
              });
              var rep = repRes.ok ? await repRes.json() : null;
              var docRes = await fetch('/api/v1/user/getDoctorsSign').catch(function() { return null; });
              var docJson = (docRes && docRes.ok) ? await docRes.json().catch(function() { return null; }) : null;
              var docData = (docJson && docJson.data) ? docJson.data : (docJson || {});
              var rectH = headerEl.getBoundingClientRect ? Math.round(headerEl.getBoundingClientRect().height) : 135;
              var invMargin = Math.max(115, Math.min(260, rectH || 135));
              if (pageName === 'reportFormat4') invMargin += 20;

              var payload = {
                htmlContent: containerEl.outerHTML,
                cssContent: styleEl.innerHTML,
                header: headerEl.outerHTML,
                footer: footerEl.outerHTML,
                reportId: (rep && rep._id) ? rep._id : v1,
                bookingId: (rep && rep.bookingId) ? rep.bookingId : v1,
                investigationmargin: invMargin,
                format: pageName
              };
              if (typeof docData.showlabinchargesign === 'boolean') payload.showlab = docData.showlabinchargesign;
              if (typeof docData.showfirstdoctorsign === 'boolean') payload.showdoctorfirst = docData.showfirstdoctorsign;
              if (typeof docData.showseconddoctorsign === 'boolean') payload.showdoctorsecond = docData.showseconddoctorsign;

              var addRes = await fetch('/api/v1/user/adding-pdf-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              notify(addRes && addRes.ok, 'legacy-sync');
            } catch (err) {
              notify(false, String(err && err.message || err));
            }
          }, 450);
        }, 350);
      })();
    ''';
  }

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  @override
  void didUpdateWidget(covariant EmbeddedPortalView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.page != widget.page ||
        oldWidget.value1 != widget.value1 ||
        oldWidget.autoPrepare != widget.autoPrepare) {
      _preparedNotified = false;
      _initWebView();
    }
  }

  Future<void> _initWebView() async {
    if (!Platform.isAndroid && !Platform.isIOS) {
      setState(() {
        _isLoading = false;
        _error = 'Embedded web portal is optimized for Android, iOS, and Web browsers.';
      });
      if (widget.autoPrepare && !_preparedNotified) {
        _preparedNotified = true;
        widget.onPrepared?.call(false);
      }
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final baseUrl = await StorageService.getServerUrl();
      final token = await StorageService.getToken() ?? '';
      final parsedBase = Uri.parse(baseUrl);

      if (token.isNotEmpty) {
        final cookieManager = WebViewCookieManager();
        await cookieManager.setCookie(
          WebViewCookie(
            name: 'accessToken',
            value: token,
            domain: parsedBase.host,
            path: '/',
          ),
        );
      }

      final encodedPage = Uri.encodeComponent(widget.page);
      final encodedValue = Uri.encodeComponent(widget.value1);
      final autoParam = widget.autoPrepare ? '&autoPrepare=1' : '';
      final targetUri = Uri.parse(
        '$baseUrl/admin/admin.html?page=$encodedPage&value1=$encodedValue&embed=mobile$autoParam',
      );

      final controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xFFF8FAFC))
        ..addJavaScriptChannel(
          'OHBridge',
          onMessageReceived: (JavaScriptMessage message) {
            try {
              final decoded = jsonDecode(message.message);
              if (decoded is Map && decoded['type'] == 'OH_REPORT_PREPARED') {
                if (!_preparedNotified) {
                  _preparedNotified = true;
                  widget.onPrepared?.call(decoded['ok'] == true);
                }
              }
            } catch (_) {}
          },
        )
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageStarted: (_) {
              if (mounted) setState(() => _isLoading = true);
            },
            onPageFinished: (_) async {
              try {
                await _controller?.runJavaScript(_injectMobileEmbedJs);
                await _controller?.runJavaScript('''
                  try {
                    var existing = JSON.parse(localStorage.getItem('booking') || 'null');
                    if (existing && existing.bookingId !== "${widget.value1}" && existing._id !== "${widget.value1}") {
                      localStorage.removeItem('booking');
                    }
                  } catch (e) {}
                ''');
                if (widget.autoPrepare || widget.page.toLowerCase().startsWith('reportformat')) {
                  await _controller?.runJavaScript(_buildAutoPrepareJs());
                }
              } catch (_) {}
              if (mounted) {
                setState(() => _isLoading = false);
                widget.onLoaded?.call();
              }
            },
            onWebResourceError: (err) {
              if (err.isForMainFrame == true && mounted) {
                setState(() {
                  _isLoading = false;
                  _error = err.description;
                });
                if (widget.autoPrepare && !_preparedNotified) {
                  _preparedNotified = true;
                  widget.onPrepared?.call(false);
                }
              }
            },
          ),
        )
        ..loadRequest(
          targetUri,
          headers: token.isNotEmpty ? {'Authorization': 'Bearer $token'} : const {},
        );

      if (mounted) {
        setState(() {
          _controller = controller;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = e.toString();
        });
      }
      if (widget.autoPrepare && !_preparedNotified) {
        _preparedNotified = true;
        widget.onPrepared?.call(false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, color: AppColors.danger, size: 42),
              const SizedBox(height: 10),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 14),
              ElevatedButton.icon(
                onPressed: _initWebView,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    return Stack(
      children: [
        if (_controller != null)
          Positioned.fill(
            child: WebViewWidget(controller: _controller!),
          ),
        if (_isLoading)
          Positioned.fill(
            child: Container(
              color: AppColors.background.withValues(alpha: 0.92),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const CircularProgressIndicator(color: AppColors.primary),
                    const SizedBox(height: 14),
                    Text(
                      widget.page == 'labreport'
                          ? 'Loading Lab Report (Enter Result)...'
                          : 'Loading Assigned Report Format (${widget.page})...',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
