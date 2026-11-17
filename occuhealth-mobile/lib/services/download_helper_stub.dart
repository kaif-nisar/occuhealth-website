import 'dart:typed_data';

class DownloadHelper {
  static Future<String> saveAndDownloadPdf({
    required Uint8List bytes,
    required String filename,
  }) async {
    throw UnsupportedError('Platform not supported');
  }

  static Future<void> openPdf(String pathOrStatus, [Uint8List? bytes, String? filename]) async {
    throw UnsupportedError('Platform not supported');
  }

  static Future<void> sharePdf(
    String pathOrStatus, {
    Uint8List? bytes,
    String? filename,
    String? patientName,
  }) async {
    throw UnsupportedError('Platform not supported');
  }
}
