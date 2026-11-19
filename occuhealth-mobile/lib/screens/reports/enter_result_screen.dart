import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/embedded_portal_view.dart';
import '../../widgets/report_download_sheet.dart';
import 'report_format_screen.dart';

/// Admin-only Enter Result screen that embeds the exact website labreport.html page.
/// Strict workflow enforcement:
/// - Report Format & Download PDF shortcuts in the AppBar are ONLY shown if the report
///   has already been signed off (completed / partially completed).
/// - For unsigned/pending cases, the admin enters and saves results inside labreport.html first,
///   which then automatically transitions to the user's assigned reportFormat page for sign-off.
class EnterResultScreen extends StatefulWidget {
  final String bookingId;
  final String? patientName;
  final String? doctorName;
  final String? age;
  final String? gender;
  final String? phone;
  final String? status;
  final bool isSignedOff;
  final Map<String, dynamic>? bookingData;

  const EnterResultScreen({
    super.key,
    required this.bookingId,
    this.patientName,
    this.doctorName,
    this.age,
    this.gender,
    this.phone,
    this.status,
    this.isSignedOff = false,
    this.bookingData,
  });

  @override
  State<EnterResultScreen> createState() => _EnterResultScreenState();
}

class _EnterResultScreenState extends State<EnterResultScreen> {
  int _reloadKey = 0;

  /// Returns true only when the booking has already been signed off on Report Format.
  bool get _canShowSignedOffActions {
    if (widget.isSignedOff) return true;
    final s = (widget.status ?? '').trim().toLowerCase();
    if (s.contains('cancel')) return false;
    return s == 'completed' || s.contains('partial');
  }

  /// Triggers a fresh reload of the embedded labreport.html view.
  void _reload() {
    setState(() => _reloadKey++);
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    // Strict RBAC Enforcement: Only Admin accounts can access Enter Result
    if (!auth.isAdmin) {
      return Scaffold(
        appBar: AppBar(title: const Text('Access Denied')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.lock_rounded, size: 52, color: AppColors.danger),
                SizedBox(height: 16),
                Text(
                  'Restricted Area (Admin Only)',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
                SizedBox(height: 8),
                Text(
                  'Franchise, Super Franchise, and Sub Franchise accounts do not have permission to enter lab test results.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final displayPatient = (widget.patientName != null && widget.patientName!.trim().isNotEmpty)
        ? widget.patientName!.trim()
        : (widget.bookingData?['patientName']?.toString() ?? 'Patient');

    final showSignedOffShortcuts = _canShowSignedOffActions;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 0,
        // Displays current patient name & booking ID in the header
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Lab Report (Enter Result)',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
            ),
            Text(
              '$displayPatient • ${widget.bookingId}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.textMuted,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          // Show Download PDF & Report Format ONLY if the report is already signed off
          if (showSignedOffShortcuts) ...[
            IconButton(
              onPressed: () {
                ReportDownloadSheet.show(
                  context,
                  bookingId: widget.bookingId,
                  patientName: displayPatient,
                );
              },
              tooltip: 'Download Report PDF (With / Without Letterhead)',
              icon: const Icon(Icons.download_rounded, color: AppColors.primary),
            ),
            TextButton.icon(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ReportFormatScreen(
                      bookingId: widget.bookingId,
                      patientName: displayPatient,
                      doctorName: widget.doctorName ?? widget.bookingData?['doctorName']?.toString(),
                      date: widget.bookingData?['date']?.toString(),
                      isSignedOff: true,
                    ),
                  ),
                );
              },
              icon: const Icon(Icons.article_outlined, size: 17),
              label: const Text('Format', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            ),
          ],
          IconButton(
            onPressed: _reload,
            tooltip: 'Reload Page',
            icon: const Icon(Icons.refresh_rounded, size: 20),
          ),
        ],
      ),
      // Embeds the exact website labreport.html page with zero desktop sidebar/navbar clutter
      body: EmbeddedPortalView(
        key: ValueKey('labreport_${widget.bookingId}_$_reloadKey'),
        page: 'labreport',
        value1: widget.bookingId,
      ),
    );
  }
}
