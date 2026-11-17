import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../models/booking_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/booking_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/status_badge.dart';
import '../../widgets/summary_card.dart';
import '../reports/enter_result_screen.dart';

class ListBookingsScreen extends StatefulWidget {
  const ListBookingsScreen({super.key});

  @override
  State<ListBookingsScreen> createState() => _ListBookingsScreenState();
}

class _ListBookingsScreenState extends State<ListBookingsScreen> {
  final _searchController = TextEditingController();
  final _patientController = TextEditingController();
  final _mobileController = TextEditingController();
  bool _showFilterPanel = false;

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
    _patientController.dispose();
    _mobileController.dispose();
    super.dispose();
  }

  void _shareBookingReceipt(BookingModel booking) {
    final tests = booking.tableData.map((v) => v.testName).join(', ');
    final barcodes = booking.barcodeList.join(', ');

    final text = '''
OCCUHEALTH DIAGNOSTICS - BOOKING RECEIPT
--------------------------------------
Booking ID: ${booking.bookingId}
Patient: ${booking.patientName}
Age/Gender: ${booking.formattedAge} / ${booking.formattedGender}
Mobile: ${booking.patientPhone ?? 'N/A'}
Doctor: ${booking.doctorName ?? 'Self'}
Date: ${booking.date ?? 'N/A'} ${booking.time ?? ''}
Status: ${booking.statusDisplay}
Barcodes: $barcodes
Tests: $tests
Total Amount: ₹${booking.total.toStringAsFixed(2)}
--------------------------------------
OccuHealth Diagnostic Network
''';

    Share.share(text, subject: 'OccuHealth Booking Receipt - ${booking.bookingId}');
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final bookingProv = Provider.of<BookingProvider>(context);
    final isAdmin = auth.isAdmin;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('List Bookings (लिस्ट बुकिंग)'),
            Text(
              'Page ${bookingProv.page} of ${bookingProv.totalPages} • ${bookingProv.total} Total',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textMuted),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              _showFilterPanel ? Icons.filter_list_off_rounded : Icons.filter_list_rounded,
              color: bookingProv.hasActiveFilters ? AppColors.primary : AppColors.textSecondary,
            ),
            tooltip: 'Filter Bookings',
            onPressed: () {
              setState(() {
                _showFilterPanel = !_showFilterPanel;
              });
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textSecondary),
            tooltip: 'Refresh',
            onPressed: () => bookingProv.fetchBookings(refresh: true),
          ),
          const SizedBox(width: 6),
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
              // 4 Summary Metrics (From Franchise Portal List Booking)
              Row(
                children: [
                  Expanded(
                    child: SummaryCard(
                      title: 'Total',
                      count: bookingProv.summary.total.toString(),
                      subtitle: 'All bookings',
                      accentColor: AppColors.primary,
                      icon: Icons.list_alt_rounded,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SummaryCard(
                      title: 'Pending',
                      count: bookingProv.summary.pending.toString(),
                      subtitle: 'Awaiting',
                      accentColor: AppColors.warning,
                      icon: Icons.access_time_rounded,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: SummaryCard(
                      title: 'Completed',
                      count: bookingProv.summary.completed.toString(),
                      subtitle: 'Finalized',
                      accentColor: AppColors.success,
                      icon: Icons.check_circle_rounded,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SummaryCard(
                      title: 'Attention',
                      count: bookingProv.summary.attention.toString(),
                      subtitle: 'Partial / Hold',
                      accentColor: AppColors.info,
                      icon: Icons.warning_amber_rounded,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Search Bar
              TextField(
                controller: _searchController,
                onSubmitted: bookingProv.setSearchQuery,
                decoration: InputDecoration(
                  hintText: 'Search by Booking ID or Barcode...',
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
              const SizedBox(height: 10),

              // Filter Panel (Expandable)
              if (_showFilterPanel) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border, width: 1.2),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Filters & Hierarchy Controls',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                          ),
                          TextButton(
                            onPressed: () {
                              _searchController.clear();
                              _patientController.clear();
                              _mobileController.clear();
                              bookingProv.clearFilters();
                            },
                            child: const Text('Reset All', style: TextStyle(fontSize: 12)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      // Status Dropdown Filter
                      const Text('Status Filter:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
                      const SizedBox(height: 6),
                      Container(
                        height: 44,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceSecondary,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: bookingProv.statusFilter,
                            isExpanded: true,
                            items: const [
                              DropdownMenuItem(value: '', child: Text('All Statuses (Active)')),
                              DropdownMenuItem(value: 'booked', child: Text('Booked')),
                              DropdownMenuItem(value: 'pending', child: Text('Pending')),
                              DropdownMenuItem(value: 'Partially Completed', child: Text('Partially Completed')),
                              DropdownMenuItem(value: 'Hold', child: Text('Hold / On Hold')),
                              DropdownMenuItem(value: 'Clinical', child: Text('Clinical')),
                              DropdownMenuItem(value: 'completed', child: Text('Completed')),
                              DropdownMenuItem(value: 'cancelled', child: Text('Cancelled')),
                            ],
                            onChanged: (val) {
                              if (val != null) bookingProv.setStatusFilter(val);
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Patient Name & Phone Filters
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _patientController,
                              decoration: const InputDecoration(
                                hintText: 'Patient Name',
                                isDense: true,
                              ),
                              onSubmitted: (v) {
                                bookingProv.setPatientName(v);
                                bookingProv.fetchBookings();
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              controller: _mobileController,
                              keyboardType: TextInputType.phone,
                              decoration: const InputDecoration(
                                hintText: 'Mobile No.',
                                isDense: true,
                              ),
                              onSubmitted: (v) {
                                bookingProv.setMobileNumber(v);
                                bookingProv.fetchBookings();
                              },
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],

              // Bookings List State
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
                  child: Column(
                    children: [
                      const Icon(Icons.inbox_outlined, size: 48, color: AppColors.textLight),
                      const SizedBox(height: 12),
                      const Text(
                        'No bookings match your criteria',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Try clearing filters or search by another keyword.',
                        style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                      ),
                      const SizedBox(height: 16),
                      OutlinedButton(
                        onPressed: bookingProv.clearFilters,
                        child: const Text('Clear Filters'),
                      ),
                    ],
                  ),
                ),
              ] else ...[
                ...bookingProv.bookings.map((b) => _bookingCard(b, isAdmin)),
              ],

              // Pagination Controls
              if (bookingProv.totalPages > 1) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Page ${bookingProv.page} of ${bookingProv.totalPages}',
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textSecondary),
                      ),
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.chevron_left_rounded),
                            onPressed: bookingProv.page > 1 ? bookingProv.previousPage : null,
                          ),
                          IconButton(
                            icon: const Icon(Icons.chevron_right_rounded),
                            onPressed: bookingProv.page < bookingProv.totalPages ? bookingProv.nextPage : null,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bookingCard(BookingModel b, bool isAdmin) {
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
          // Row 1: Booking ID & Status
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

          // Row 2: Patient Name, Age & Gender
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      b.patientName,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Dr. ${b.doctorName ?? "Self"} • ${b.labName ?? "Direct"}',
                      style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.surfaceSecondary,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(
                  '${b.formattedAge} / ${b.formattedGender}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Row 3: Barcodes Chips
          if (b.barcodeList.isNotEmpty) ...[
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: b.barcodeList.take(3).map((bar) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceSecondary,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.qr_code_2_rounded, size: 12, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Text(bar, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                    ],
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 10),
          ],

          // Row 4: Registered User & Date
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'By: ${b.createdByUser ?? "User"} • ${b.date ?? (b.createdAt != null ? DateFormat('dd MMM yyyy').format(b.createdAt!) : "N/A")}',
                style: const TextStyle(fontSize: 11, color: AppColors.textLight, fontWeight: FontWeight.w500),
              ),
              Text(
                '₹${b.total.toStringAsFixed(2)}',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 10),

          // Action Buttons:
          // For Franchise: Share / Download Receipt
          // For Admin: Share Receipt + [Enter Result] (Strictly hidden for Franchise!)
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () => _shareBookingReceipt(b),
                icon: const Icon(Icons.share_outlined, size: 16),
                label: const Text('Receipt Slip (रसीद)', style: TextStyle(fontSize: 12)),
              ),
              if (isAdmin) ...[
                const SizedBox(width: 8),
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
                  label: const Text('Enter Result', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

