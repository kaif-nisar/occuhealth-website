import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/report_service.dart';
import '../theme/app_colors.dart';
import 'embedded_portal_view.dart';

class ReportDownloadSheet extends StatefulWidget {
  final String bookingId;
  final String patientName;

  const ReportDownloadSheet({
    super.key,
    required this.bookingId,
    required this.patientName,
  });

  static Future<void> show(
    BuildContext context, {
    required String bookingId,
    required String patientName,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ReportDownloadSheet(
        bookingId: bookingId,
        patientName: patientName,
      ),
    );
  }

  @override
  State<ReportDownloadSheet> createState() => _ReportDownloadSheetState();
}

class _ReportDownloadSheetState extends State<ReportDownloadSheet> {
  bool _isLoadingWithLH = false;
  bool _isLoadingWithoutLH = false;
  String? _statusText;
  String? _errorMessage;
  String? _lastDownloadedPath;
  bool _lastWasWithLH = true;

  // Hidden offscreen preparer for brand-new reports whose exact layout isn't synced on server yet
  String? _preparingFormatPage;
  String? _preparingValue1;
  Completer<bool>? _prepareCompleter;

  bool get _isBusy => _isLoadingWithLH || _isLoadingWithoutLH;

  @override
  void dispose() {
    if (_prepareCompleter != null && !_prepareCompleter!.isCompleted) {
      _prepareCompleter!.complete(false);
    }
    super.dispose();
  }

  Future<void> _ensureServerLayoutPrepared(ReportReadyInfo info, String fallbackFormat) async {
    final formatPage = (info.assignedPdfFormat != null && info.assignedPdfFormat!.isNotEmpty)
        ? info.assignedPdfFormat!
        : fallbackFormat;

    final completer = Completer<bool>();
    if (!mounted) return;
    setState(() {
      _statusText = 'Preparing exact website format on server...';
      _preparingFormatPage = formatPage;
      _preparingValue1 = info.reportId;
      _prepareCompleter = completer;
    });

    try {
      await completer.future.timeout(const Duration(seconds: 12), onTimeout: () => false);
    } catch (_) {}

    if (mounted) {
      setState(() {
        _preparingFormatPage = null;
        _preparingValue1 = null;
        _prepareCompleter = null;
      });
    }
  }

  Future<void> _download({required bool withLetterhead}) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    setState(() {
      _errorMessage = null;
      _statusText = 'Checking report status on server...';
      if (withLetterhead) {
        _isLoadingWithLH = true;
      } else {
        _isLoadingWithoutLH = true;
      }
    });

    try {
      final info = await ReportService.checkReportReady(widget.bookingId);
      if (info == null || !info.exists) {
        throw Exception(
          'Report is not ready yet. Please enter test results and sign off the report first.',
        );
      }

      // If this report has not been rendered/saved via reportFormat on the server yet,
      // automatically run the user's exact assigned website reportFormat page so the server
      // stores the exact HTML/CSS/header/footer/signatures before generating the PDF!
      if (!info.hasSavedLayout && auth.isAdmin) {
        await _ensureServerLayoutPrepared(
          info,
          auth.user?.assignedReportFormat ?? 'reportFormat',
        );
      }

      if (!mounted) return;
      setState(() {
        _statusText = withLetterhead
            ? 'Generating server PDF (With Letterhead)...'
            : 'Generating server PDF (Without Letterhead)...';
      });

      final path = await ReportService.downloadReportPdf(
        bookingId: info.bookingId,
        patientName: widget.patientName.isNotEmpty ? widget.patientName : info.patientName,
        knownReportId: info.reportId,
        withLetterhead: withLetterhead,
      );

      if (!mounted) return;
      setState(() {
        _isLoadingWithLH = false;
        _isLoadingWithoutLH = false;
        _statusText = null;
        _lastDownloadedPath = path;
        _lastWasWithLH = withLetterhead;
      });

      final label = withLetterhead ? 'With Letterhead' : 'Without Letterhead';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            kIsWeb || path == 'web_downloaded'
                ? 'Report PDF ($label) downloaded successfully!'
                : 'Report PDF ($label) saved: ${path.split("/").last}',
          ),
          backgroundColor: AppColors.success,
          duration: const Duration(seconds: 4),
          action: (!kIsWeb && path != 'web_downloaded')
              ? SnackBarAction(
                  label: 'Open',
                  textColor: Colors.white,
                  onPressed: () => ReportService.openReportPdf(path),
                )
              : null,
        ),
      );

      if (!kIsWeb && path != 'web_downloaded') {
        await ReportService.openReportPdf(path);
      }
    } catch (e) {
      if (!mounted) return;
      final cleanErr = e.toString().replaceFirst('Exception: ', '');
      setState(() {
        _isLoadingWithLH = false;
        _isLoadingWithoutLH = false;
        _statusText = null;
        _preparingFormatPage = null;
        _preparingValue1 = null;
        _errorMessage = cleanErr;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
        20,
        12,
        20,
        MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.picture_as_pdf_rounded, color: AppColors.primary, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Download Report PDF',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${widget.patientName} • ${widget.bookingId}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: _isBusy ? null : () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded, color: AppColors.textMuted),
              ),
            ],
          ),
          const SizedBox(height: 14),

          if (_statusText != null && _isBusy) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2.2, color: AppColors.primary),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _statusText!,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryDark,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          if (_errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.dangerLight,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.danger,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],

          // Option 1: WITH LETTERHEAD (Server-generated exact website PDF)
          _DownloadOptionTile(
            title: 'With Letterhead',
            subtitle: 'Download official server-rendered PDF with lab letterhead & signatures',
            icon: Icons.article_rounded,
            accentColor: AppColors.primary,
            isLoading: _isLoadingWithLH,
            disabled: _isBusy,
            isPrimary: true,
            onTap: () => _download(withLetterhead: true),
          ),
          const SizedBox(height: 10),

          // Option 2: WITHOUT LETTERHEAD (Server-generated exact website PDF)
          _DownloadOptionTile(
            title: 'Without Letterhead',
            subtitle: 'Download print-ready server-rendered PDF for pre-printed letterhead paper',
            icon: Icons.description_outlined,
            accentColor: AppColors.slateDark,
            isLoading: _isLoadingWithoutLH,
            disabled: _isBusy,
            isPrimary: false,
            onTap: () => _download(withLetterhead: false),
          ),

          if (_lastDownloadedPath != null) ...[
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: () async {
                await ReportService.shareReportPdf(
                  _lastDownloadedPath!,
                  patientName: widget.patientName,
                );
              },
              icon: const Icon(Icons.share_rounded, size: 18, color: AppColors.successDark),
              label: Text(
                'Share ${_lastWasWithLH ? "With Letterhead" : "Without Letterhead"} PDF via WhatsApp',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.successDark,
                ),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.success),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],

          // Hidden 1x1 offscreen preparer when a brand-new report needs its exact website format synced to server
          if (_preparingFormatPage != null && _preparingValue1 != null)
            SizedBox(
              width: 1,
              height: 1,
              child: Opacity(
                opacity: 0.01,
                child: EmbeddedPortalView(
                  key: ValueKey('prep_${_preparingFormatPage}_$_preparingValue1'),
                  page: _preparingFormatPage!,
                  value1: _preparingValue1!,
                  autoPrepare: true,
                  onPrepared: (ok) {
                    if (_prepareCompleter != null && !_prepareCompleter!.isCompleted) {
                      _prepareCompleter!.complete(ok);
                    }
                  },
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _DownloadOptionTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color accentColor;
  final bool isLoading;
  final bool disabled;
  final bool isPrimary;
  final VoidCallback onTap;

  const _DownloadOptionTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.accentColor,
    required this.isLoading,
    required this.disabled,
    required this.isPrimary,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isPrimary ? AppColors.primary : Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: disabled ? null : onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isPrimary ? AppColors.primary : AppColors.border,
              width: 1.3,
            ),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isPrimary
                      ? Colors.white.withValues(alpha: 0.18)
                      : AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: isLoading
                    ? SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: isPrimary ? Colors.white : accentColor,
                        ),
                      )
                    : Icon(
                        icon,
                        size: 22,
                        color: isPrimary ? Colors.white : accentColor,
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isLoading ? 'Preparing PDF on server...' : title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: isPrimary ? Colors.white : AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 11.5,
                        color: isPrimary
                            ? Colors.white.withValues(alpha: 0.85)
                            : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.download_rounded,
                color: isPrimary ? Colors.white : accentColor,
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
