import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/booking_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/booking_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/report_download_sheet.dart';
import '../../widgets/status_badge.dart';
import '../auth/login_screen.dart';
import '../booking/list_bookings_screen.dart';
import '../booking/new_booking_screen.dart';
import '../cases/all_cases_screen.dart';
import '../reports/enter_result_screen.dart';
import '../reports/report_format_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<BookingProvider>(context, listen: false).fetchBookings();
    });
  }

  void _handleLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Confirm Logout'),
        content: const Text('Are you sure you want to sign out from OccuHealth?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () async {
              Navigator.of(ctx).pop();
              await Provider.of<AuthProvider>(context, listen: false).logout();
              if (mounted) {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
            },
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final bookingProv = Provider.of<BookingProvider>(context);
    final user = auth.user;
    final isAdmin = auth.isAdmin;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        // Top navigation bar displaying the official OccuHealth brand logo and active lab/role label
        title: Row(
          children: [
            Image.asset(
              'assets/logo.png',
              height: 32,
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.local_hospital_rounded, color: Colors.white, size: 18),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'OccuHealth',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                      letterSpacing: -0.3,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    user?.labName ?? user?.roleDisplay ?? 'Diagnostic Lab',
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
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textSecondary),
            tooltip: 'Refresh Bookings',
            onPressed: () => bookingProv.fetchBookings(refresh: true),
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.textMuted),
            tooltip: 'Logout',
            onPressed: _handleLogout,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => bookingProv.fetchBookings(refresh: true),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // User Greeting Banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0F6CBD), Color(0xFF1D86DE)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.25),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                isAdmin ? Icons.verified_user_rounded : Icons.store_rounded,
                                color: Colors.white,
                                size: 14,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                user?.roleDisplay ?? 'User',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          DateTime.now().toLocal().toString().split(' ')[0],
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.8),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    // Personalized greeting header for the signed-in user
                    Text(
                      'Welcome, ${user?.fullName ?? user?.username ?? "Doctor"}!',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isAdmin
                          ? 'Manage bookings, enter test results & sign off diagnostic reports.'
                          : 'Register patients, track barcodes, and download completed reports.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.white.withValues(alpha: 0.9),
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Primary quick-action button to register a new patient booking
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppColors.primary,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const NewBookingScreen()),
                          );
                        },
                        icon: const Icon(Icons.add_circle_rounded, size: 20),
                        label: const Text(
                          'New Patient Booking',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),

              // Summary Counters Grid
              const Text(
                'BOOKINGS OVERVIEW',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textMuted,
                  letterSpacing: 0.6,
                ),
              ),
              const SizedBox(height: 10),

              Row(
                children: [
                  Expanded(
                    child: _statMiniCard(
                      label: 'Total',
                      value: bookingProv.summary.total.toString(),
                      color: AppColors.primary,
                      icon: Icons.folder_shared_rounded,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _statMiniCard(
                      label: 'Pending',
                      value: bookingProv.summary.pending.toString(),
                      color: AppColors.warning,
                      icon: Icons.hourglass_top_rounded,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _statMiniCard(
                      label: 'Completed',
                      value: bookingProv.summary.completed.toString(),
                      color: AppColors.success,
                      icon: Icons.check_circle_rounded,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _statMiniCard(
                      label: 'Attention',
                      value: bookingProv.summary.attention.toString(),
                      color: AppColors.info,
                      icon: Icons.warning_amber_rounded,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Navigation Action Cards
              const Text(
                'CORE WORKSPACES',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textMuted,
                  letterSpacing: 0.6,
                ),
              ),
              const SizedBox(height: 12),

              // Card 1: List Booking (Available to both Franchise and Admin roles)
              _actionTile(
                icon: Icons.format_list_bulleted_rounded,
                iconBg: AppColors.primaryLight,
                iconColor: AppColors.primary,
                title: 'List Bookings',
                subtitle: 'All bookings, statuses, barcodes, receipts & completed PDF downloads',
                badgeText: '${bookingProv.total} Cases',
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ListBookingsScreen()),
                  );
                },
              ),
              const SizedBox(height: 12),

              // Card 2: Cases & Report Management (Strictly Admin Only)
              if (isAdmin) ...[
                _actionTile(
                  icon: Icons.assignment_turned_in_rounded,
                  iconBg: const Color(0xFFEDE9FE),
                  iconColor: const Color(0xFF7C3AED),
                  title: 'All Cases & Lab Reports',
                  subtitle: 'Enter test parameters, preview assigned report format & sign off reports',
                  badgeText: 'Admin Only',
                  badgeColor: const Color(0xFF7C3AED),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const AllCasesScreen()),
                    );
                  },
                ),
                const SizedBox(height: 12),
              ],

              // Recent Bookings Header
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'RECENT BOOKINGS',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textMuted,
                      letterSpacing: 0.6,
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const ListBookingsScreen()),
                      );
                    },
                    child: const Text('View All →', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  ),
                ],
              ),
              const SizedBox(height: 4),

              // Recent Bookings Preview
              if (bookingProv.isLoading) ...[
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: CircularProgressIndicator(),
                  ),
                ),
              ] else if (bookingProv.bookings.isEmpty) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.inbox_rounded, size: 40, color: AppColors.textLight),
                      const SizedBox(height: 8),
                      const Text(
                        'No recent bookings found',
                        style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 4),
                      TextButton(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const NewBookingScreen()),
                          );
                        },
                        child: const Text('+ Register First Patient'),
                      ),
                    ],
                  ),
                ),
              ] else ...[
                ...bookingProv.bookings.take(6).map((b) => _recentBookingCard(b, isAdmin: isAdmin)),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _statMiniCard({
    required String label,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionTile({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String title,
    required String subtitle,
    required String badgeText,
    Color badgeColor = AppColors.primary,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.border, width: 1.2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          title,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: badgeColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          badgeText,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: badgeColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.textLight),
          ],
        ),
      ),
    );
  }

  /// Builds a single Recent Booking card with strict status-aware action controls:
  /// - Download Report (PDF) is enabled ONLY when the report is completed / partially completed / signed off.
  /// - Enter Result (Admin only) opens the exact website labreport.html page.
  /// - Report Format (Admin only) is shown ONLY after the report has been signed off at least once.
  Widget _recentBookingCard(BookingModel b, {required bool isAdmin}) {
    final canDownload = b.isReportDownloadable;
    final showReportFormat = isAdmin && b.canShowReportFormat;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Patient info header row with status badge
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Center(
                  child: Icon(Icons.person_outline_rounded, color: AppColors.primary, size: 22),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      b.patientName,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${b.bookingId} • ${b.formattedAge} • ${b.formattedGender}',
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
              ),
              const SizedBox(width: 8),
              StatusBadge(status: b.status, isSignedOff: b.isSignedOff),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 10),

          // Status-aware action buttons row
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              // Report Download PDF button (only active when report is ready/signed off)
              if (canDownload)
                ElevatedButton.icon(
                  onPressed: () {
                    ReportDownloadSheet.show(
                      context,
                      bookingId: b.bookingId,
                      patientName: b.patientName,
                    );
                  },
                  icon: const Icon(Icons.download_rounded, size: 15),
                  label: const Text(
                    'Download Report PDF',
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                )
              else
                // Clear muted indicator for pending / non-ready reports (prevents broken downloads)
                InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Report is not ready for download yet. Please complete and sign off the report first.',
                        ),
                        backgroundColor: AppColors.slateDark,
                        duration: Duration(seconds: 3),
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSecondary,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.hourglass_empty_rounded, size: 14, color: AppColors.textMuted),
                        SizedBox(width: 5),
                        Text(
                          'Report Not Ready',
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              // Admin-only: Enter Result opens the exact website labreport.html page
              if (isAdmin)
                OutlinedButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => EnterResultScreen(
                          bookingId: b.bookingId,
                          patientName: b.patientName,
                          doctorName: b.doctorName,
                          age: b.formattedAge,
                          gender: b.formattedGender,
                          phone: b.patientPhone,
                          status: b.status,
                          isSignedOff: b.isSignedOff,
                          bookingData: {
                            'patientName': b.patientName,
                            'bookingId': b.bookingId,
                            'year': b.year,
                            'gender': b.gender,
                            'doctorName': b.doctorName,
                            'date': b.date,
                          },
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.edit_note_rounded, size: 15),
                  label: const Text(
                    'Enter Result',
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(color: AppColors.primary),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),

              // Admin-only: Report Format is visible ONLY after the report has been signed off
              if (showReportFormat)
                OutlinedButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ReportFormatScreen(
                          bookingId: b.bookingId,
                          patientName: b.patientName,
                          doctorName: b.doctorName,
                          date: b.date,
                          isSignedOff: b.isSignedOff,
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.article_outlined, size: 15),
                  label: const Text(
                    'Report Format',
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.slateDark,
                    side: const BorderSide(color: AppColors.border),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

