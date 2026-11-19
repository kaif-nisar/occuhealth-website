import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class EmbeddedPortalView extends StatelessWidget {
  final String page;
  final String value1;
  final bool autoPrepare;
  final VoidCallback? onLoaded;
  final ValueChanged<bool>? onPrepared;

  const EmbeddedPortalView({
    super.key,
    required this.page,
    required this.value1,
    this.autoPrepare = false,
    this.onLoaded,
    this.onPrepared,
  });

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Embedded web view is supported on Mobile (Android/iOS) and Web browsers.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
      ),
    );
  }
}
