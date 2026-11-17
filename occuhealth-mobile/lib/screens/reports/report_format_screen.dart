import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/report_model.dart';
import '../../providers/auth_provider.dart';
import '../../services/report_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/custom_button.dart';
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
  bool _isLoading = true;
  bool _isDownloading = false;
  String? _downloadedPdfPath;
  ReportDataModel? _reportData;

  @override
  void initState() {
    super.initState();
    _loadReportDetails();
  }

  Future<void> _loadReportDetails() async {
    setState(() => _isLoading = true);
    try {
      final rep = await ReportService.getReportData(widget.bookingId);
      setState(() {
        _reportData = rep;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleDownloadPdf({bool openImmediately = true}) async {
    setState(() => _isDownloading = true);
    try {
      final filePath = await ReportService.downloadReportPdf(
        bookingId: widget.bookingId,
        patientName: widget.patientName,
      );

      setState(() {
        _downloadedPdfPath = filePath;
        _isDownloading = false;
      });

      if (!mounted) return;

      if (kIsWeb || filePath == 'web_downloaded') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Report PDF downloaded successfully to your Downloads folder! (रिपोर्ट डाउनलोड हो गई)'),
            backgroundColor: AppColors.success,
            duration: Duration(seconds: 4),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Report downloaded: ${filePath.split("/").last}'),
            backgroundColor: AppColors.success,
            action: SnackBarAction(
              label: 'Open',
              textColor: Colors.white,
              onPressed: () => ReportService.openReportPdf(filePath),
            ),
          ),
        );

        if (openImmediately) {
          await ReportService.openReportPdf(filePath);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isDownloading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Download failed: ${e.toString()}'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _handleShareWhatsapp() async {
    try {
      String? path = _downloadedPdfPath;
      if (path == null) {
        setState(() => _isDownloading = true);
        path = await ReportService.downloadReportPdf(
          bookingId: widget.bookingId,
          patientName: widget.patientName,
        );
        setState(() {
          _downloadedPdfPath = path;
          _isDownloading = false;
        });
      }

      await ReportService.shareReportPdf(path, patientName: widget.patientName);
    } catch (e) {
      if (mounted) {
        setState(() => _isDownloading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Share error: ${e.toString()}'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    // Verify Admin Access
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

    final isSigned = _reportData?.isSignedOff ?? widget.isSignedOff;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Report Format (रिपोर्ट फॉर्मेट)'),
            Text(
              'ID: ${widget.bookingId}',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textMuted),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_rounded, color: AppColors.primary),
            tooltip: 'Share Report',
            onPressed: _handleShareWhatsapp,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              child: Column(
                children: [
                  // A4 Styled Preview Sheet Container
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border, width: 1.2),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Diagnostic Letterhead Preview Header
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(6),
                                      decoration: BoxDecoration(
                                        color: AppColors.primary,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: const Icon(Icons.local_hospital_rounded, color: Colors.white, size: 18),
                                    ),
                                    const SizedBox(width: 8),
                                    const Text(
                                      'OCCUHEALTH',
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.primaryDark,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                const Text(
                                  'Standard Diagnostic Laboratory',
                                  style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                                ),
                              ],
                            ),

                            // Sign-off Status Pill (Identical to reportFormat.html)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: isSigned ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: isSigned ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                                  width: 1.2,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    isSigned ? Icons.verified_rounded : Icons.pending_rounded,
                                    size: 13,
                                    color: isSigned ? const Color(0xFF166534) : const Color(0xFFB45309),
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    isSigned ? 'Signed Off' : 'Pending Sign-off',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      color: isSigned ? const Color(0xFF166534) : const Color(0xFFB45309),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        const Divider(thickness: 1.5, color: AppColors.primaryDark),
                        const SizedBox(height: 12),

                        // Patient & Referring Doctor Information Grid
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceSecondary,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            children: [
                              _metaRow('Patient Name:', widget.patientName, isBold: true),
                              const SizedBox(height: 6),
                              _metaRow('Booking ID / Barcode:', widget.bookingId),
                              const SizedBox(height: 6),
                              _metaRow('Referring Doctor:', 'Dr. ${widget.doctorName ?? "Self"}'),
                              const SizedBox(height: 6),
                              _metaRow('Report Date:', widget.date ?? DateTime.now().toString().split(' ')[0]),
                            ],
                          ),
                        ),
                        const SizedBox(height: 18),

                        // Formatted Parameters Table
                        if (_reportData != null && _reportData!.categories.isNotEmpty) ...[
                          ..._reportData!.categories.map((cat) {
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  color: AppColors.primarySoft,
                                  child: Text(
                                    cat.title.toUpperCase(),
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.primaryDark),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                ...cat.tests.map((t) {
                                  return Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 4),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          flex: 3,
                                          child: Text(
                                            t.testName,
                                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                          ),
                                        ),
                                        Expanded(
                                          flex: 2,
                                          child: Text(
                                            t.result.isNotEmpty ? t.result : '—',
                                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.primary),
                                          ),
                                        ),
                                        Expanded(
                                          flex: 2,
                                          child: Text(
                                            t.unit,
                                            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                          ),
                                        ),
                                        Expanded(
                                          flex: 2,
                                          child: Text(
                                            t.normalRange,
                                            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                }),
                                const SizedBox(height: 12),
                              ],
                            );
                          }),
                        ] else ...[
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 24),
                            child: Center(
                              child: Text(
                                'No parameters entered yet. Click "Enter Result" to fill values.',
                                style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                              ),
                            ),
                          ),
                        ],

                        // Notes if any
                        if (_reportData?.moreDetails.isNotEmpty == true) ...[
                          const SizedBox(height: 10),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceSecondary,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Findings / Notes:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                                const SizedBox(height: 4),
                                Text(_reportData!.moreDetails, style: const TextStyle(fontSize: 12)),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Actions: Download PDF, WhatsApp Share, Enter Result
                  CustomButton(
                    text: _isDownloading ? 'Downloading PDF...' : 'Download Report PDF (डाउनलोड)',
                    variant: ButtonVariant.primary,
                    height: 52,
                    isLoading: _isDownloading,
                    icon: const Icon(Icons.cloud_download_rounded, color: Colors.white, size: 20),
                    onPressed: () => _handleDownloadPdf(openImmediately: true),
                  ),
                  const SizedBox(height: 12),

                  CustomButton(
                    text: 'Share via WhatsApp (व्हाट्सएप शेयर)',
                    variant: ButtonVariant.success,
                    height: 52,
                    icon: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                    onPressed: _handleShareWhatsapp,
                  ),
                  const SizedBox(height: 12),

                  CustomButton(
                    text: 'Edit / Enter Results (रिजल्ट बदलें)',
                    variant: ButtonVariant.outline,
                    height: 52,
                    icon: const Icon(Icons.edit_note_rounded, color: AppColors.primary, size: 20),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => EnterResultScreen(
                            bookingId: widget.bookingId,
                            patientName: widget.patientName,
                            doctorName: widget.doctorName,
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _metaRow(String label, String value, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w600),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

