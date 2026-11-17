import 'package:flutter/material.dart';
import '../models/lab_model.dart';
import '../theme/app_colors.dart';
import 'custom_button.dart';
import 'custom_text_field.dart';

class AddLabDialog extends StatefulWidget {
  final Future<LabModel> Function({
    required String labName,
    String? labAddress,
  }) onAdd;

  const AddLabDialog({super.key, required this.onAdd});

  @override
  State<AddLabDialog> createState() => _AddLabDialogState();
}

class _AddLabDialogState extends State<AddLabDialog> {
  final _formKey = GlobalKey<FormState>();
  final _labNameController = TextEditingController();
  final _labAddressController = TextEditingController();
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _labNameController.dispose();
    _labAddressController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final lab = await widget.onAdd(
        labName: _labNameController.text.trim(),
        labAddress: _labAddressController.text.trim(),
      );
      if (mounted) {
        Navigator.of(context).pop(lab);
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
                          child: const Icon(Icons.business_rounded, color: AppColors.primary, size: 20),
                        ),
                        const SizedBox(width: 10),
                        const Text(
                          'Add New Lab / Hospital',
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
                  label: 'Lab / Hospital Name *',
                  hint: 'e.g. Metro Diagnostic Lab',
                  controller: _labNameController,
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Lab name is required' : null,
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  label: 'Lab Address',
                  hint: 'e.g. Ground Floor, City Center',
                  controller: _labAddressController,
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
                        text: 'Add Lab',
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

