import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/report_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/embedded_portal_view.dart';
import 'enter_result_screen.dart';

class ReportFormatScreen extends StatefulWidget {
  final String bookingId;
  final String patientName;
  final String? doctorName;
  final String? date;
  final bool isSignedOff;

  const ReportFormatScreen({
    super.key,
    required this.bookingId,
    required this.patientName,
    this.doctorName,
    this.date,
    this.isSignedOff = false,
  });

  @override
  State<ReportFormatScreen> createState() => _ReportFormatScreenState();
}

class _ReportFormatScreenState extends State<ReportFormatScreen> {
  bool _isResolvingFormat = true;
  bool _isDownloadingWithLH = false;
  bool _isDownloadingWithoutLH = false;
  String _assignedFormatPage = 'reportFormat';
  String _resolvedValue1 = '';
  int _reloadKey = 0;
  Completer<bool> _syncCompleter = Completer<bool>();

  bool get _isDownloading => _isDownloadingWithLH || _isDownloadingWithoutLH;

  @override
  void initState() {
    super.initState();
    _resolvedValue1 = widget.bookingId;
    _resolveAssignedFormat();
  }

  @override
  void dispose() {
    if (!_syncCompleter.isCompleted) {
      _syncCompleter.complete(false);
    }
    super.dispose();
  }

  Future<void> _resolveAssignedFormat() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    String format = auth.user?.assignedReportFormat ?? 'reportFormat';
    String value1 = widget.bookingId;

    try {
      final rawReport = await ReportService.getRawReportData(widget.bookingId);
      if (rawReport != null) {
        final serverFormat = rawReport['pdfFormat']?.toString().trim();
        if (serverFormat != null && serverFormat.isNotEmpty) {
          format = serverFormat;
        }
        final reportId = rawReport['_id']?.toString().trim();
        if (reportId != null && reportId.isNotEmpty && rawReport['isDraft'] != true) {
          value1 = reportId;
        }
      }
    } catch (_) {}

    if (mounted) {
      setState(() {
        _assignedFormatPage = format;
        _resolvedValue1 = value1;
        _isResolvingFormat = false;
      });
    }
  }

  Future<void> _handleDownloadPdf({required bool withLetterhead}) async {
    setState(() {
      if (withLetterhead) {
        _isDownloadingWithLH = true;
      } else {
        _isDownloadingWithoutLH = true;
      }
    });

    try {
      // Wait briefly if the embedded reportFormat page is still syncing its exact layout to the server
      if (!_syncCompleter.isCompleted) {
        await _syncCompleter.future.timeout(const Duration(seconds: 6), onTimeout: () => false);
      }

      final filePath = await ReportService.downloadReportPdf(
        bookingId: widget.bookingId,
        patientName: widget.patientName,
        knownReportId: _resolvedValue1 != widget.bookingId ? _resolvedValue1 : null,
        withLetterhead: withLetterhead,
      );

      if (!mounted) return;
      setState(() {
        _isDownloadingWithLH = false;
        _isDownloadingWithoutLH = false;
      });

      final modeLabel = withLetterhead ? 'With Letterhead' : 'Without Letterhead';

      if (kIsWeb || filePath == 'web_downloaded') {
        // Notify user that the browser downloaded the server-generated PDF
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Report PDF ($modeLabel) downloaded successfully!'),
            backgroundColor: AppColors.success,
            duration: const Duration(seconds: 4),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Report ($modeLabel) saved: ${filePath.split("/").last}'),
            backgroundColor: AppColors.success,
            action: SnackBarAction(
              label: 'Open',
              textColor: Colors.white,
              onPressed: () => ReportService.openReportPdf(filePath),
            ),
          ),
        );
        await ReportService.openReportPdf(filePath);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isDownloadingWithLH = false;
        _isDownloadingWithoutLH = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    // Strict RBAC Enforcement: Only Admin can access Report Format
    if (!auth.isAdmin) {
      return Scaffold(
        appBar: AppBar(title: const Text('Access Denied')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Only Admin accounts are authorized to access the Report Format & Sign-off page.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: AppColors.danger, fontWeight: FontWeight.w700),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text(
                  'Report Format',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    _assignedFormatPage,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
            Text(
              '${widget.patientName} • ${widget.bookingId}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: AppColors.textMuted,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          TextButton.icon(
            onPressed: () {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(
                  builder: (_) => EnterResultScreen(
                    bookingId: widget.bookingId,
                    patientName: widget.patientName,
                  ),
                ),
              );
            },
            icon: const Icon(Icons.edit_note_rounded, size: 18),
            label: const Text('Result', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          ),
          IconButton(
            onPressed: () {
              setState(() {
                _syncCompleter = Completer<bool>();
                _reloadKey++;
              });
            },
            tooltip: 'Reload Report Format',
            icon: const Icon(Icons.refresh_rounded, size: 20),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _isResolvingFormat
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(color: AppColors.primary),
                        SizedBox(height: 12),
                        Text(
                          'Loading assigned Report Format...',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  )
                : EmbeddedPortalView(
                    key: ValueKey('${_assignedFormatPage}_${_resolvedValue1}_$_reloadKey'),
                    page: _assignedFormatPage,
                    value1: _resolvedValue1,
                    autoPrepare: true,
                    onPrepared: (ok) {
                      if (!_syncCompleter.isCompleted) {
                        _syncCompleter.complete(ok);
                      }
                    },
                  ),
          ),

          // Sticky Native Mobile PDF Download Bar (With Letterhead & Without Letterhead)
          Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: AppColors.border)),
              boxShadow: [
                BoxShadow(
                  color: Color(0x140F172A),
                  blurRadius: 10,
                  offset: Offset(0, -3),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _isDownloading ? null : () => _handleDownloadPdf(withLetterhead: true),
                      icon: _isDownloadingWithLH
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.download_rounded, size: 18),
                      label: Text(
                        _isDownloadingWithLH ? 'Downloading...' : 'With Letterhead',
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _isDownloading ? null : () => _handleDownloadPdf(withLetterhead: false),
                      icon: _isDownloadingWithoutLH
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.slateDark),
                            )
                          : const Icon(Icons.description_outlined, size: 18),
                      label: Text(
                        _isDownloadingWithoutLH ? 'Downloading...' : 'Without Letterhead',
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.slateDark,
                        side: const BorderSide(color: AppColors.border, width: 1.3),
                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
