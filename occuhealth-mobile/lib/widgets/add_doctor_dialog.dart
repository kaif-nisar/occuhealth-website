import 'package:flutter/material.dart';
import '../models/doctor_model.dart';
import '../theme/app_colors.dart';
import 'custom_button.dart';
import 'custom_text_field.dart';

class AddDoctorDialog extends StatefulWidget {
  final Future<DoctorModel> Function({
    required String firstName,
    required String lastName,
    required String specialization,
    String? address,
  }) onAdd;

  const AddDoctorDialog({super.key, required this.onAdd});

  @override
  State<AddDoctorDialog> createState() => _AddDoctorDialogState();
}

class _AddDoctorDialogState extends State<AddDoctorDialog> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _specializationController = TextEditingController(text: 'General Physician');
  final _addressController = TextEditingController();
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _specializationController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final doc = await widget.onAdd(
        firstName: _firstNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        specialization: _specializationController.text.trim(),
        address: _addressController.text.trim(),
      );
      if (mounted) {
        Navigator.of(context).pop(doc);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppColors.primaryLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.person_add_alt_1_rounded, color: AppColors.primary, size: 20),
                        ),
                        const SizedBox(width: 10),
                        const Text(
                          'Add New Doctor',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: AppColors.textMuted),
                      onPressed: () => Navigator.of(context).pop(),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.dangerLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: AppColors.danger, fontSize: 12),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                CustomTextField(
                  label: 'First Name *',
                  hint: 'e.g. Ramesh',
                  controller: _firstNameController,
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'First name is required' : null,
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  label: 'Last Name *',
                  hint: 'e.g. Sharma',
                  controller: _lastNameController,
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Last name is required' : null,
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  label: 'Specialization',
                  hint: 'e.g. MBBS, MD, Cardiologist',
                  controller: _specializationController,
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  label: 'Clinic / Hospital Address',
                  hint: 'e.g. Sector 12, Delhi',
                  controller: _addressController,
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: CustomButton(
                        text: 'Cancel',
                        variant: ButtonVariant.outline,
                        height: 46,
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: CustomButton(
                        text: 'Add Doctor',
                        variant: ButtonVariant.primary,
                        height: 46,
                        isLoading: _isLoading,
                        onPressed: _handleSubmit,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

