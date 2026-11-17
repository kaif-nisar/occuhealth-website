import 'dart:io';
import 'dart:typed_data';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

class DownloadHelper {
  static Future<String> saveAndDownloadPdf({
    required Uint8List bytes,
    required String filename,
  }) async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/$filename');
    await file.writeAsBytes(bytes);
    return file.path;
  }

  static Future<void> openPdf(String pathOrStatus, [Uint8List? bytes, String? filename]) async {
    if (pathOrStatus.isNotEmpty) {
      final file = File(pathOrStatus);
      if (await file.exists()) {
        await OpenFilex.open(pathOrStatus);
      }
    }
  }

  static Future<void> sharePdf(
    String pathOrStatus, {
    Uint8List? bytes,
    String? filename,
    String? patientName,
  }) async {
    final file = File(pathOrStatus);
    if (await file.exists()) {
      final xFile = XFile(pathOrStatus, mimeType: 'application/pdf');
      await Share.shareXFiles(
        [xFile],
        text: 'OccuHealth Diagnostic Lab Report for ${patientName ?? "Patient"}',
        subject: 'Lab Report - $patientName',
      );
    } else {
      await Share.share(
        'OccuHealth Diagnostic Lab Report for ${patientName ?? "Patient"}',
        subject: 'Lab Report - $patientName',
      );
    }
  }
}

