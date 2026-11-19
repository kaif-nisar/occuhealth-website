import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/doctor_model.dart';
import '../../models/lab_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/new_booking_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/add_doctor_dialog.dart';
import '../../widgets/add_lab_dialog.dart';
import '../../widgets/booking_success_dialog.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';
import '../reports/enter_result_screen.dart';
import 'list_bookings_screen.dart';

class NewBookingScreen extends StatefulWidget {
  const NewBookingScreen({super.key});

  @override
  State<NewBookingScreen> createState() => _NewBookingScreenState();
}

class _NewBookingScreenState extends State<NewBookingScreen> {
  final _patientNameController = TextEditingController();
  final _ageValueController = TextEditingController();
  final _phoneController = TextEditingController();
  final _discountController = TextEditingController(text: '0');
  final _clinicalHistoryController = TextEditingController();
  final _searchTestController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final newBookingProv = Provider.of<NewBookingProvider>(context, listen: false);
      newBookingProv.initForm(auth.user?.id);
    });
  }

  @override
  void dispose() {
    _patientNameController.dispose();
    _ageValueController.dispose();
    _phoneController.dispose();
    _discountController.dispose();
    _clinicalHistoryController.dispose();
    _searchTestController.dispose();
    super.dispose();
  }

  Future<void> _pickAttachment(NewBookingProvider prov) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf'],
      );

      if (result != null && result.files.single.path != null) {
        prov.setAttachedFile(File(result.files.single.path!));
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Attached: ${result.files.single.name}'),
            backgroundColor: AppColors.successDark,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('File picker error: ${e.toString()}'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  void _openAddDoctorDialog(NewBookingProvider prov, String? userId) async {
    final result = await showDialog<DoctorModel>(
      context: context,
      builder: (_) => AddDoctorDialog(
        onAdd: ({
          required String firstName,
          required String lastName,
          required String specialization,
          String? address,
        }) {
          return prov.createDoctor(
            firstName: firstName,
            lastName: lastName,
            specialization: specialization,
            address: address,
            userId: userId,
          );
        },
      ),
    );

    if (result != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Doctor "${result.displayName}" added successfully!'),
          backgroundColor: AppColors.success,
        ),
      );
    }
  }

  void _openAddLabDialog(NewBookingProvider prov, String? userId) async {
    final result = await showDialog<LabModel>(
      context: context,
      builder: (_) => AddLabDialog(
        onAdd: ({
          required String labName,
          String? labAddress,
        }) {
          return prov.createLab(
            labName: labName,
            labAddress: labAddress,
            userId: userId,
          );
        },
      ),
    );

    if (result != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Lab "${result.labName}" added successfully!'),
          backgroundColor: AppColors.success,
        ),
      );
    }
  }

  Future<void> _handleSubmitBooking(NewBookingProvider prov, AuthProvider auth) async {
    prov.setPatientName(_patientNameController.text.trim());
    prov.setAge(_ageValueController.text.trim());
    prov.setPatientPhone(_phoneController.text.trim());
    prov.setClinicalHistory(_clinicalHistoryController.text.trim());
    final discountVal = double.tryParse(_discountController.text.trim()) ?? 0.0;
    prov.setDiscount(discountVal);

    try {
      final res = await prov.submitBooking(
        activeUserId: auth.user?.id ?? '',
        activeUsername: auth.user?.username ?? 'user',
      );

      final bookingId = res['bookingId']?.toString() ?? prov.barcodeId;
      final patientName = res['patientName']?.toString() ?? _patientNameController.text;
      final total = (res['total'] as num?)?.toDouble() ?? prov.grandTotal;
      final sampleCount = (res['sampleCount'] as num?)?.toInt() ?? prov.sampleVials.length;

      if (!mounted) return;

      // Show Popup Modal with visible [Enter Result] and [List Booking] buttons!
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => BookingSuccessDialog(
          bookingId: bookingId,
          patientName: patientName,
          totalAmount: total,
          sampleCount: sampleCount,
          isAdmin: auth.isAdmin,
          onEnterResult: () {
            // Navigate directly to Enter Result screen for this booking
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(
                builder: (_) => EnterResultScreen(
                  bookingId: bookingId,
                  patientName: patientName,
                  doctorName: prov.doctorDisplayName,
                  age: '${_ageValueController.text} ${prov.ageUnit}',
                  gender: prov.gender,
                  phone: _phoneController.text,
                ),
              ),
            );
          },
          onListBooking: () {
            // Navigate to List Booking screen
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const ListBookingsScreen()),
            );
          },
          onNewBooking: () {
            prov.resetForm();
            _patientNameController.clear();
            _ageValueController.clear();
            _phoneController.clear();
            _discountController.text = '0';
            _clinicalHistoryController.clear();
            _searchTestController.clear();
          },
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final prov = Provider.of<NewBookingProvider>(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('New Patient Booking'),
            Text(
              'ID: ${prov.barcodeId} • Fast Registration',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textMuted),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textSecondary),
            tooltip: 'Reset Form',
            onPressed: () {
              prov.resetForm();
              _patientNameController.clear();
              _ageValueController.clear();
              _phoneController.clear();
              _discountController.text = '0';
              _clinicalHistoryController.clear();
              _searchTestController.clear();
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: prov.isLoadingInitial
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 14),
                  Text('Loading tests, doctors & labs...', style: TextStyle(color: AppColors.textMuted)),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // SECTION 1: Patient demographic fields (Name, Age, Unit, Gender, Phone)
                  _cardSection(
                    title: '1. Patient Information',
                    icon: Icons.person_rounded,
                    children: [
                      CustomTextField(
                        label: 'Patient Full Name *',
                        hint: 'Enter patient full name',
                        controller: _patientNameController,
                        prefixIcon: const Icon(Icons.badge_outlined, color: AppColors.textMuted),
                        onChanged: prov.setPatientName,
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            flex: 2,
                            child: CustomTextField(
                              label: 'Age *',
                              hint: 'e.g. 32',
                              controller: _ageValueController,
                              keyboardType: TextInputType.number,
                              onChanged: prov.setAge,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            flex: 2,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Unit',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Container(
                                  height: 48,
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(color: AppColors.border, width: 1.2),
                                  ),
                                  child: DropdownButtonHideUnderline(
                                    child: DropdownButton<String>(
                                      value: prov.ageUnit,
                                      isExpanded: true,
                                      items: ['Yrs', 'Mos', 'Days'].map((u) {
                                        return DropdownMenuItem(value: u, child: Text(u));
                                      }).toList(),
                                      onChanged: (val) {
                                        if (val != null) prov.setAgeUnit(val);
                                      },
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            flex: 3,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Gender',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Container(
                                  height: 48,
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(color: AppColors.border, width: 1.2),
                                  ),
                                  child: DropdownButtonHideUnderline(
                                    child: DropdownButton<String>(
                                      value: prov.gender,
                                      isExpanded: true,
                                      items: ['Male', 'Female', 'Other'].map((g) {
                                        return DropdownMenuItem(value: g, child: Text(g));
                                      }).toList(),
                                      onChanged: (val) {
                                        if (val != null) prov.setGender(val);
                                      },
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      CustomTextField(
                        label: 'Patient Mobile Number',
                        hint: '10-digit mobile number',
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        prefixIcon: const Icon(Icons.phone_outlined, color: AppColors.textMuted),
                        onChanged: prov.setPatientPhone,
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // SECTION 2: Referring Doctor & Laboratory selection with quick-add dialogs
                  _cardSection(
                    title: '2. Doctor & Laboratory',
                    icon: Icons.local_hospital_outlined,
                    children: [
                      // Referring doctor selector with + Add New Doctor shortcut
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Referring Doctor',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                          ),
                          InkWell(
                            onTap: () => _openAddDoctorDialog(prov, auth.user?.id),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(vertical: 2, horizontal: 4),
                              child: Text(
                                '+ Add New Doctor',
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Container(
                        height: 48,
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.border, width: 1.2),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<DoctorModel?>(
                            value: prov.selectedDoctor,
                            isExpanded: true,
                            hint: const Text('Select doctor or Self/Walk-in', style: TextStyle(fontSize: 13)),
                            items: [
                              const DropdownMenuItem<DoctorModel?>(
                                value: null,
                                child: Text('Self / Direct Walk-in (No Doctor)'),
                              ),
                              ...prov.doctorList.map((d) {
                                return DropdownMenuItem<DoctorModel?>(
                                  value: d,
                                  child: Text(d.fullTitle, overflow: TextOverflow.ellipsis),
                                );
                              }),
                            ],
                            onChanged: prov.selectDoctor,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Laboratory / Hospital selector with + Add New Lab button
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Laboratory / Hospital',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                          ),
                          InkWell(
                            onTap: () => _openAddLabDialog(prov, auth.user?.id),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(vertical: 2, horizontal: 4),
                              child: Text(
                                '+ Add New Lab',
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Container(
                        height: 48,
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.border, width: 1.2),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<LabModel?>(
                            value: prov.selectedLab,
                            isExpanded: true,
                            hint: const Text('Select lab or Default Lab', style: TextStyle(fontSize: 13)),
                            items: [
                              const DropdownMenuItem<LabModel?>(
                                value: null,
                                child: Text('Direct Center (Default)'),
                              ),
                              ...prov.labList.map((l) {
                                return DropdownMenuItem<LabModel?>(
                                  value: l,
                                  child: Text(l.labName, overflow: TextOverflow.ellipsis),
                                );
                              }),
                            ],
                            onChanged: prov.selectLab,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Prescription / Requisition file attachment
                      const Text(
                        'Prescription / Requisition File',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      if (prov.attachedFile == null) ...[
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            backgroundColor: Colors.white,
                            side: const BorderSide(color: AppColors.border, width: 1.2),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 16),
                          ),
                          onPressed: () => _pickAttachment(prov),
                          icon: const Icon(Icons.attach_file_rounded, color: AppColors.primary),
                          label: const Text(
                            'Upload Prescription / Requisition',
                            style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ] else ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.primaryLight,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.description_rounded, color: AppColors.primary, size: 24),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  prov.attachedFile!.path.split(Platform.pathSeparator).last,
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.cancel_rounded, color: AppColors.danger, size: 20),
                                onPressed: prov.removeAttachedFile,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 16),

                  // SECTION 3: Interactive test, panel & package selection
                  _cardSection(
                    title: '3. Select Tests & Packages',
                    icon: Icons.science_outlined,
                    children: [
                      // Search Bar
                      TextField(
                        controller: _searchTestController,
                        onChanged: prov.setSearchQuery,
                        decoration: InputDecoration(
                          hintText: 'Search test, panel or package name...',
                          prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textMuted),
                          suffixIcon: _searchTestController.text.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.clear_rounded, size: 18),
                                  onPressed: () {
                                    _searchTestController.clear();
                                    prov.setSearchQuery('');
                                  },
                                )
                              : null,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Category Filters: All, Tests, Panels, Packages
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: ['All', 'Tests', 'Panels', 'Packages'].map((cat) {
                            final isSel = prov.catalogFilter == cat;
                            return Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(cat),
                                selected: isSel,
                                onSelected: (_) => prov.setCatalogFilter(cat),
                                selectedColor: AppColors.primary,
                                labelStyle: TextStyle(
                                  color: isSel ? Colors.white : AppColors.textSecondary,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Available Test Options Grid / Chips
                      const Text(
                        'Tap to add to booking:',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textMuted),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: prov.filteredCatalog.map((item) {
                          final isSelected = prov.isItemSelected(item);
                          return FilterChip(
                            selected: isSelected,
                            showCheckmark: isSelected,
                            checkmarkColor: Colors.white,
                            backgroundColor: Colors.white,
                            selectedColor: AppColors.primary,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(
                                color: isSelected ? AppColors.primary : AppColors.border,
                                width: 1.2,
                              ),
                            ),
                            label: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  item.name,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                                    color: isSelected ? Colors.white : AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isSelected ? Colors.white.withValues(alpha: 0.25) : AppColors.primaryLight,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    '₹${item.price.toInt()}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      color: isSelected ? Colors.white : AppColors.primaryDark,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            onSelected: (_) => prov.toggleSelectItem(item),
                          );
                        }).toList(),
                      ),

                      // Selected Tests Tags Summary
                      if (prov.selectedItems.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        const Divider(),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Selected Items (${prov.selectedItems.length}):',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                            ),
                            Text(
                              'Subtotal: ₹${prov.subTotal.toStringAsFixed(2)}',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.primary),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: prov.selectedItems.map((item) {
                            return Chip(
                              backgroundColor: AppColors.primarySoft,
                              deleteIcon: const Icon(Icons.close_rounded, size: 16, color: AppColors.primaryDark),
                              onDeleted: () => prov.removeItem(item),
                              label: Text(
                                '${item.name} (₹${item.price.toInt()})',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primaryDark,
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 16),

                  // SECTION 4: Sample Vials & Barcodes Breakdown (Auto-Calculated)
                  if (prov.sampleVials.isNotEmpty) ...[
                    _cardSection(
                      title: '4. Sample Collection Vials (${prov.sampleVials.length} Tubes)',
                      icon: Icons.biotech_rounded,
                      children: [
                        ...prov.sampleVials.map((vial) {
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceSecondary,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.opacity_rounded, color: AppColors.danger, size: 20),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            'Vial: ${vial.sampleType}',
                                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: AppColors.primary.withValues(alpha: 0.1),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              vial.barcodeId,
                                              style: const TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.w800,
                                                color: AppColors.primary,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        vial.testNames.join(', '),
                                        style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],

                  // SECTION 5: Discount & Billing Summary
                  _cardSection(
                    title: '5. Discount & Billing',
                    icon: Icons.receipt_long_rounded,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: CustomTextField(
                              label: 'Discount (₹)',
                              hint: '0',
                              controller: _discountController,
                              keyboardType: TextInputType.number,
                              onChanged: (val) {
                                final d = double.tryParse(val) ?? 0.0;
                                prov.setDiscount(d);
                              },
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: CustomTextField(
                              label: 'Clinical Notes / History',
                              hint: 'e.g. Fasting sample',
                              controller: _clinicalHistoryController,
                              onChanged: prov.setClinicalHistory,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      const Divider(),
                      const SizedBox(height: 10),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Subtotal:', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                          Text('₹${prov.subTotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Discount Applied:', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                          Text('-₹${prov.discountAmount.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.danger, fontSize: 13)),
                        ],
                      ),
                      const SizedBox(height: 10),
                      const Divider(),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Grand Total:',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.textPrimary),
                          ),
                          Text(
                            '₹${prov.grandTotal.toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: AppColors.success),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Submit Booking button
                  CustomButton(
                    text: 'Confirm & Book Test',
                    variant: ButtonVariant.primary,
                    height: 54,
                    isLoading: prov.isSubmitting,
                    icon: const Icon(Icons.check_circle_rounded, color: Colors.white, size: 22),
                    onPressed: () => _handleSubmitBooking(prov, auth),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _cardSection({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 1.2),
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
          Row(
            children: [
              Icon(icon, size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }
}

