// ignore_for_file: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'dart:typed_data';

class DownloadHelper {
  static Future<String> saveAndDownloadPdf({
    required Uint8List bytes,
    required String filename,
  }) async {
    final blob = html.Blob([bytes], 'application/pdf');
    final url = html.Url.createObjectUrlFromBlob(blob);
    html.AnchorElement(href: url)
      ..setAttribute('download', filename)
      ..click();
    Future.delayed(const Duration(seconds: 5), () {
      html.Url.revokeObjectUrl(url);
    });
    return 'web_downloaded';
  }

  static Future<void> openPdf(String pathOrStatus, [Uint8List? bytes, String? filename]) async {
    if (bytes != null) {
      final blob = html.Blob([bytes], 'application/pdf');
      final url = html.Url.createObjectUrlFromBlob(blob);
      html.window.open(url, '_blank');
      Future.delayed(const Duration(minutes: 1), () {
        html.Url.revokeObjectUrl(url);
      });
    }
  }

  static Future<void> sharePdf(
    String pathOrStatus, {
    Uint8List? bytes,
    String? filename,
    String? patientName,
  }) async {
    final text = Uri.encodeComponent(
      'OccuHealth Diagnostic Lab Report for ${patientName ?? "Patient"}.\n'
      'Please check your patient portal or downloaded PDF report.',
    );
    html.window.open('https://api.whatsapp.com/send?text=$text', '_blank');
  }
}
