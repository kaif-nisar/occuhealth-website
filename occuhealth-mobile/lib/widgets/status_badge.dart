import 'package:flutter/material.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final bool isSignedOff;

  const StatusBadge({
    super.key,
    required this.status,
    this.isSignedOff = false,
  });

  @override
  Widget build(BuildContext context) {
    final s = status.trim().toLowerCase();

    Color bg;
    Color fg;
    String label;
    IconData icon;

    if (isSignedOff || s == 'completed') {
      bg = const Color(0xFFDCFCE7);
      fg = const Color(0xFF166534);
      label = isSignedOff ? 'Signed-off' : 'Completed';
      icon = Icons.check_circle_rounded;
    } else if (s.contains('partial')) {
      bg = const Color(0xFFDBEAFE);
      fg = const Color(0xFF1D4ED8);
      label = 'Partial';
      icon = Icons.hourglass_top_rounded;
    } else if (s == 'pending') {
      bg = const Color(0xFFFEF3C7);
      fg = const Color(0xFFB45309);
      label = 'Pending';
      icon = Icons.access_time_filled_rounded;
    } else if (s == 'booked') {
      bg = const Color(0xFFEDE9FE);
      fg = const Color(0xFF6D28D9);
      label = 'Booked';
      icon = Icons.bookmark_added_rounded;
    } else if (s.contains('hold')) {
      bg = const Color(0xFFFEE2E2);
      fg = const Color(0xFFB91C1C);
      label = 'On Hold';
      icon = Icons.pause_circle_rounded;
    } else if (s.contains('clinical')) {
      bg = const Color(0xFFCCFBF1);
      fg = const Color(0xFF0F766E);
      label = 'Clinical';
      icon = Icons.medical_services_rounded;
    } else if (s.contains('cancel')) {
      bg = const Color(0xFFFEE2E2);
      fg = const Color(0xFF991B1B);
      label = 'Cancelled';
      icon = Icons.cancel_rounded;
    } else {
      bg = const Color(0xFFE2E8F0);
      fg = const Color(0xFF334155);
      label = status.isNotEmpty ? status : 'Unknown';
      icon = Icons.info_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: fg),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: fg,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

