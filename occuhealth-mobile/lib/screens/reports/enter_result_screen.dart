import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/report_model.dart';
import '../../providers/auth_provider.dart';
import '../../services/report_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/status_badge.dart';
import 'report_format_screen.dart';

class EnterResultScreen extends StatefulWidget {
  final String bookingId;
  final String patientName;
  final String? doctorName;
  final String? age;
  final String? gender;
  final String? phone;
  final String? status;

  const EnterResultScreen({
    super.key,
    required this.bookingId,
    required this.patientName,
    this.doctorName,
    this.age,
    this.gender,
    this.phone,
    this.status,
  });

  @override
  State<EnterResultScreen> createState() => _EnterResultScreenState();
}

class _EnterResultScreenState extends State<EnterResultScreen> {
  bool _isLoading = true;
  bool _isSaving = false;
  List<ReportCategoryModel> _categories = [];
  final _notesController = TextEditingController();
  bool _isSignedOff = false;

  @override
  void initState() {
    super.initState();
    _loadReportParameters();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadReportParameters() async {
    setState(() => _isLoading = true);

    try {
      // 1. Try fetching saved report data first
      final savedReport = await ReportService.getReportData(widget.bookingId);
      if (savedReport != null && savedReport.categories.isNotEmpty) {
        setState(() {
          _categories = savedReport.categories;
          _notesController.text = savedReport.moreDetails;
          _isSignedOff = savedReport.isSignedOff;
          _isLoading = false;
        });
        return;
      }

      // 2. Fetch barcode single tests & panels
      final initialCategories = await ReportService.getBarcodeTests(widget.bookingId);
      if (initialCategories.isNotEmpty) {
        setState(() {
          _categories = initialCategories;
          _isLoading = false;
        });
        return;
      }

      // 3. Fallback dummy routine group if none found
      setState(() {
        _categories = [
          ReportCategoryModel(
            category: 'Diagnostic Parameters',
            title: 'Diagnostic Parameters',
            type: 'test',
            tests: [
              ReportParameterModel(
                testId: '1',
                testName: 'General Clinical Observation',
                result: '',
                unit: '',
                normalRange: 'Normal',
              ),
            ],
          ),
        ];
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error loading parameters: ${e.toString()}'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _saveReport({required bool isFinalSignOff}) async {
    setState(() => _isSaving = true);

    try {
      final bookingMap = {
        'bookingId': widget.bookingId,
        'patientName': widget.patientName,
        'doctorName': widget.doctorName ?? 'Self',
        'year': widget.age ?? '',
        'gender': widget.gender ?? 'Male',
        'patientPhone': widget.phone ?? '',
      };

      await ReportService.saveReportData(
        booking: bookingMap,
        bookingId: widget.bookingId,
        categories: _categories,
        notes: _notesController.text.trim(),
        isFinalSignOff: isFinalSignOff,
      );

      setState(() {
        _isSaving = false;
        if (isFinalSignOff) _isSignedOff = true;
      });

      if (!mounted) return;

      if (isFinalSignOff) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: const Row(
              children: [
                Icon(Icons.verified_rounded, color: AppColors.success, size: 28),
                SizedBox(width: 10),
                Text('Report Signed Off!'),
              ],
            ),
            content: Text(
              'Test results for ${widget.patientName} have been finalized and verified.\nReport is ready for PDF download!',
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pop();
                },
                child: const Text('Back to Cases'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                onPressed: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute(
                      builder: (_) => ReportFormatScreen(
                        bookingId: widget.bookingId,
                        patientName: widget.patientName,
                        doctorName: widget.doctorName,
                        isSignedOff: true,
                      ),
                    ),
                  );
                },
                child: const Text('View & Download PDF'),
              ),
            ],
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Report draft saved successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
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
              'Franchisees are not authorized to enter results or edit reports.',
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
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Enter Results (लैब रिजल्ट)'),
            Text(
              'ID: ${widget.bookingId} • ${widget.patientName}',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textMuted),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.picture_as_pdf_outlined, color: AppColors.primary),
            tooltip: 'Report Format Preview',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ReportFormatScreen(
                    bookingId: widget.bookingId,
                    patientName: widget.patientName,
                    doctorName: widget.doctorName,
                    isSignedOff: _isSignedOff,
                  ),
                ),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Patient Info Header Card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.border, width: 1.2),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              widget.patientName,
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            StatusBadge(
                              status: widget.status ?? (_isSignedOff ? 'completed' : 'in-process'),
                              isSignedOff: _isSignedOff,
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${widget.age ?? "--"} • ${widget.gender ?? "M"} • Phone: ${widget.phone ?? "N/A"}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Doctor: Dr. ${widget.doctorName ?? "Self"} • Barcode: ${widget.bookingId}',
                          style: const TextStyle(fontSize: 12, color: AppColors.primaryDark, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Categories & Parameter Inputs
                  ..._categories.map((cat) {

                    return Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.border, width: 1.2),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Category Header
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: const BoxDecoration(
                              color: AppColors.surfaceSecondary,
                              borderRadius: BorderRadius.vertical(top: Radius.circular(17)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.folder_open_rounded, size: 18, color: AppColors.primary),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    cat.title.toUpperCase(),
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.primaryDark,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    '${cat.tests.length} Parameters',
                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textMuted),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Table Header
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            decoration: const BoxDecoration(
                              border: Border(bottom: BorderSide(color: AppColors.border)),
                            ),
                            child: const Row(
                              children: [
                                Expanded(flex: 3, child: Text('TEST / PARAMETER', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.textMuted))),
                                Expanded(flex: 3, child: Text('RESULT VALUE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.textMuted))),
                                Expanded(flex: 2, child: Text('REF RANGE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.textMuted))),
                              ],
                            ),
                          ),

                          // Parameter rows
                          ...cat.tests.map((param) {

                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              decoration: const BoxDecoration(
                                border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  // Test Name & Unit
                                  Expanded(
                                    flex: 3,
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          param.testName,
                                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                                        ),
                                        if (param.unit.isNotEmpty)
                                          Text(
                                            'Unit: ${param.unit}',
                                            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 8),

                                  // Result Input
                                  Expanded(
                                    flex: 3,
                                    child: SizedBox(
                                      height: 42,
                                      child: TextFormField(
                                        initialValue: param.result,
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                                        decoration: InputDecoration(
                                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                          hintText: 'Enter result',
                                          isDense: true,
                                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                        ),
                                        onChanged: (val) {
                                          param.result = val;
                                        },
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),

                                  // Reference Range
                                  Expanded(
                                    flex: 2,
                                    child: Text(
                                      param.normalRange.isNotEmpty ? param.normalRange : '—',
                                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w500),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                      ),
                    );
                  }),

                  // Additional Findings & Notes
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.border, width: 1.2),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Additional Findings / Clinical Notes',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _notesController,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            hintText: 'Enter doctor comments or specimen notes...',
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Bottom Action Buttons
                  Row(
                    children: [
                      // Save Draft Button
                      Expanded(
                        child: CustomButton(
                          text: 'Save Draft (ड्राफ्ट सेव)',
                          variant: ButtonVariant.outline,
                          height: 52,
                          isLoading: _isSaving,
                          icon: const Icon(Icons.save_outlined, size: 18),
                          onPressed: () => _saveReport(isFinalSignOff: false),
                        ),
                      ),
                      const SizedBox(width: 12),

                      // Sign Off & Finalize Button
                      Expanded(
                        child: CustomButton(
                          text: 'Sign-off & Finalize',
                          variant: ButtonVariant.success,
                          height: 52,
                          isLoading: _isSaving,
                          icon: const Icon(Icons.verified_rounded, size: 18, color: Colors.white),
                          onPressed: () => _saveReport(isFinalSignOff: true),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }
}

