import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/booking_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/booking_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/status_badge.dart';
import '../reports/enter_result_screen.dart';
import '../reports/report_format_screen.dart';

class AllCasesScreen extends StatefulWidget {
  const AllCasesScreen({super.key});

  @override
  State<AllCasesScreen> createState() => _AllCasesScreenState();
}

class _AllCasesScreenState extends State<AllCasesScreen> {
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<BookingProvider>(context, listen: false).fetchBookings();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final bookingProv = Provider.of<BookingProvider>(context);

    // Verify Admin Authorization
    if (!auth.isAdmin) {
      return Scaffold(
        appBar: AppBar(title: const Text('Access Denied')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Only Admin accounts are authorized to access Cases and Result Entry.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: AppColors.danger),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Cases & Lab Management'),
            Text(
              'Enter results & sign off diagnostic reports',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textMuted),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textSecondary),
            onPressed: () => bookingProv.fetchBookings(refresh: true),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => bookingProv.fetchBookings(refresh: true),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Search input
              TextField(
                controller: _searchController,
                onSubmitted: bookingProv.setSearchQuery,
                decoration: InputDecoration(
                  hintText: 'Search cases by ID, barcode, or patient...',
                  prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textMuted),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            bookingProv.setSearchQuery('');
                          },
                        )
                      : null,
                ),
              ),
              const SizedBox(height: 14),

              // Cases List
              if (bookingProv.isLoading) ...[
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: CircularProgressIndicator(),
                  ),
                ),
              ] else if (bookingProv.bookings.isEmpty) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Center(
                    child: Text('No cases found. Tap refresh to load latest bookings.'),
                  ),
                ),
              ] else ...[
                ...bookingProv.bookings.map((b) => _caseCard(b)),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _caseCard(BookingModel b) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text(
                    b.bookingId,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primaryDark,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${b.tableData.length} Tests',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primaryDark),
                    ),
                  ),
                ],
              ),
              StatusBadge(status: b.status, isSignedOff: b.isSignedOff),
            ],
          ),
          const SizedBox(height: 10),

          // Patient Name & Doctor
          Text(
            b.patientName,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 2),
          Text(
            '${b.formattedAge} • ${b.formattedGender} • Dr. ${b.doctorName ?? "Self"}',
            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
          ),
          const SizedBox(height: 8),

          // Barcodes list
          if (b.barcodeList.isNotEmpty) ...[
            Text(
              'Barcodes: ${b.barcodeList.join(", ")}',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
          ],

          const Divider(height: 16),

          // Action Buttons: Enter Result & Report Format
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              // Report Format Button
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
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
                icon: const Icon(Icons.picture_as_pdf_rounded, size: 16, color: AppColors.primary),
                label: const Text('Report Format (फॉर्मेट)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 8),

              // Enter Result Button
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
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
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.edit_note_rounded, size: 16, color: Colors.white),
                label: const Text('Enter Result (रिजल्ट)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

