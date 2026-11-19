// ignore_for_file: avoid_web_libraries_in_flutter
import 'dart:async';
import 'dart:html' as html;
import 'dart:ui_web' as ui_web;
import 'package:flutter/material.dart';
import '../services/storage_service.dart';
import '../theme/app_colors.dart';

/// Web implementation of [EmbeddedPortalView] that embeds the exact website
/// labreport.html or assigned reportFormat*.html page inside an authenticated iframe.
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
  static int _viewCounter = 0;
  String? _viewType;
  String? _directFallbackUrl;
  bool _requiresProxyNotice = false;
  bool _isLoading = true;
  String? _error;
  StreamSubscription<html.MessageEvent>? _msgSub;
  bool _preparedNotified = false;

  @override
  void initState() {
    super.initState();
    _listenForPrepared();
    _initIframe();
  }

  @override
  void dispose() {
    _msgSub?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant EmbeddedPortalView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.page != widget.page ||
        oldWidget.value1 != widget.value1 ||
        oldWidget.autoPrepare != widget.autoPrepare) {
      _preparedNotified = false;
      _initIframe();
    }
  }

  /// Listens for postMessage completion events fired by our mobile-embed bridge
  /// once reportFormat*.html finishes syncing adding-pdf-data to the server.
  void _listenForPrepared() {
    _msgSub?.cancel();
    _msgSub = html.window.onMessage.listen((event) {
      final data = event.data;
      if (data is Map && data['type'] == 'OH_REPORT_PREPARED') {
        final msgVal = data['value1']?.toString() ?? '';
        if (msgVal.isEmpty || msgVal == widget.value1) {
          if (!_preparedNotified) {
            _preparedNotified = true;
            widget.onPrepared?.call(data['ok'] == true);
          }
        }
      }
    });
  }

  /// Configures and registers the iframe pointing to the authenticated /mobile-embed proxy route.
  Future<void> _initIframe() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _requiresProxyNotice = false;
    });

    try {
      final baseUrl = await StorageService.getServerUrl();
      final token = await StorageService.getToken() ?? '';
      final encodedPage = Uri.encodeComponent(widget.page);
      final encodedValue = Uri.encodeComponent(widget.value1);
      final encodedToken = Uri.encodeComponent(token);
      final autoParam = widget.autoPrepare ? '&autoPrepare=1' : '';

      final isLocalProxy = baseUrl.contains(':3005');
      final directUrl = '$baseUrl/admin/admin.html?page=$encodedPage&value1=$encodedValue';

      // When running Flutter Web directly against occuhealth.in without mobile_preview.js,
      // Chrome blocks cross-origin iframes via X-Frame-Options: SAMEORIGIN.
      if (!isLocalProxy && baseUrl.contains('occuhealth.in')) {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _requiresProxyNotice = true;
            _directFallbackUrl = directUrl;
          });
        }
        return;
      }

      final String targetUrl = isLocalProxy
          ? '$baseUrl/mobile-embed?page=$encodedPage&value1=$encodedValue&token=$encodedToken$autoParam'
          : '$directUrl&embed=mobile$autoParam';

      _viewCounter++;
      final viewId = 'oh-portal-iframe-${widget.page}-${widget.value1}-$_viewCounter';

      ui_web.platformViewRegistry.registerViewFactory(viewId, (int _) {
        final iframe = html.IFrameElement()
          ..src = targetUrl
          ..style.border = 'none'
          ..style.width = '100%'
          ..style.height = '100%'
          ..style.backgroundColor = '#f8fafc'
          ..allow = 'clipboard-read; clipboard-write';

        iframe.onLoad.listen((_) {
          if (mounted) {
            setState(() => _isLoading = false);
            widget.onLoaded?.call();
          }
        });

        return iframe;
      });

      if (mounted) {
        setState(() {
          _viewType = viewId;
        });
      }

      // Safety timeout so loading overlay never stays stuck
      Future.delayed(const Duration(seconds: 4), () {
        if (mounted && _isLoading) {
          setState(() => _isLoading = false);
        }
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = e.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Helpful notice when web browser runs without local proxy (avoids Chrome "Refused to connect")
    if (_requiresProxyNotice) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 420),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.security_rounded, color: AppColors.primary, size: 42),
                const SizedBox(height: 12),
                const Text(
                  'Web Preview Proxy Required',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Browser security blocks embedding occuhealth.in directly. Start the preview with "node mobile_preview.js" (port 8080) or open on Android/iOS APK.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.45),
                ),
                const SizedBox(height: 16),
                if (_directFallbackUrl != null)
                  ElevatedButton.icon(
                    onPressed: () {
                      html.window.open(_directFallbackUrl!, '_blank');
                    },
                    icon: const Icon(Icons.open_in_new_rounded, size: 18),
                    label: const Text('Open Page in New Tab'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                    ),
                  ),
              ],
            ),
          ),
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 42),
              const SizedBox(height: 10),
              Text(
                'Page load error: $_error',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.danger, fontSize: 13),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: _initIframe,
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
        if (_viewType != null)
          Positioned.fill(
            child: HtmlElementView(viewType: _viewType!),
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
