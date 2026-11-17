import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'custom_button.dart';

class BookingSuccessDialog extends StatelessWidget {
  final String bookingId;
  final String patientName;
  final double totalAmount;
  final int sampleCount;
  final bool isAdmin;
  final VoidCallback onEnterResult;
  final VoidCallback onListBooking;
  final VoidCallback onNewBooking;

  const BookingSuccessDialog({
    super.key,
    required this.bookingId,
    required this.patientName,
    required this.totalAmount,
    required this.sampleCount,
    required this.isAdmin,
    required this.onEnterResult,
    required this.onListBooking,
    required this.onNewBooking,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 26),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Success Icon with Glow
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: AppColors.successLight,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.success.withValues(alpha: 0.3), width: 2),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.success.withValues(alpha: 0.18),
                    blurRadius: 18,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: const Center(
                child: Icon(
                  Icons.check_circle_rounded,
                  color: AppColors.success,
                  size: 46,
                ),
              ),
            ),
            const SizedBox(height: 18),

            // Title
            const Text(
              'बुकिंग सफलतापूर्वक दर्ज हो गई!',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Booking Placed Successfully',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.textMuted,
              ),
            ),
            const SizedBox(height: 18),

            // Summary Info Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surfaceSecondary,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  _infoRow('Booking ID', bookingId, isBold: true, color: AppColors.primary),
                  const Divider(height: 16),
                  _infoRow('Patient Name', patientName, isBold: true),
                  const Divider(height: 16),
                  _infoRow('Sample Vials', '$sampleCount Vials / Barcodes'),
                  const Divider(height: 16),
                  _infoRow('Grand Total', '₹${totalAmount.toStringAsFixed(2)}', isBold: true, color: AppColors.success),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // PROMINENT ACTION BUTTON 1: ENTER RESULT (Admin Only)
            if (isAdmin) ...[
              CustomButton(
                text: 'Enter Result (रिजल्ट डालें)',
                variant: ButtonVariant.primary,
                height: 52,
                icon: const Icon(Icons.edit_document, size: 20, color: Colors.white),
                onPressed: () {
                  Navigator.of(context).pop();
                  onEnterResult();
                },
              ),
              const SizedBox(height: 12),
            ],

            // PROMINENT ACTION BUTTON 2: LIST BOOKING (For Everyone)
            CustomButton(
              text: 'List Booking (बुकिंग लिस्ट देखें)',
              variant: isAdmin ? ButtonVariant.secondary : ButtonVariant.primary,
              height: 52,
              icon: Icon(
                Icons.list_alt_rounded,
                size: 20,
                color: isAdmin ? AppColors.primaryDark : Colors.white,
              ),
              onPressed: () {
                Navigator.of(context).pop();
                onListBooking();
              },
            ),
            const SizedBox(height: 12),

            // ACTION BUTTON 3: Book Another
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                onNewBooking();
              },
              child: const Text(
                '+ Book Another Patient (नया मरीज जोड़ें)',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value, {bool isBold = false, Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.textMuted,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
            color: color ?? AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

