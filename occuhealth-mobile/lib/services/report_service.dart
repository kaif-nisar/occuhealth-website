import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/report_model.dart';
import 'api_client.dart';
import 'download_helper.dart';
import 'storage_service.dart';

class ReportReadyInfo {
  final String reportId;
  final String bookingId;
  final String patientName;
  final String? assignedPdfFormat;
  final bool isDraft;
  final bool hasSavedLayout;
  final bool isSignedOff;

  ReportReadyInfo({
    required this.reportId,
    required this.bookingId,
    required this.patientName,
    this.assignedPdfFormat,
    required this.isDraft,
    required this.hasSavedLayout,
    required this.isSignedOff,
  });

  bool get exists => reportId.isNotEmpty && !isDraft;
}

class ReportService {
  // Fetch Existing Saved Report (typed)
  static Future<ReportDataModel?> getReportData(String bookingId) async {
    final response = await ApiClient.post(
      '/api/v1/user/ReportData',
      body: {
        'value1': bookingId,
        'bookingId': bookingId,
      },
    );

    if (!response.success || response.data is! Map) return null;
    return ReportDataModel.fromJson(response.data as Map<String, dynamic>, bookingId);
  }

  // Fetch Raw Report JSON (includes _id, pdfFormat, isDraft, savedPdfLayout, signoff, patientName, bookingId)
  static Future<Map<String, dynamic>?> getRawReportData(String bookingId) async {
    final response = await ApiClient.post(
      '/api/v1/user/ReportData',
      body: {
        'value1': bookingId,
        'bookingId': bookingId,
      },
    );

    if (!response.success || response.data is! Map) return null;
    return Map<String, dynamic>.from(response.data as Map);
  }

  // Check whether report exists and has its exact formatted layout saved on the server
  static Future<ReportReadyInfo?> checkReportReady(String bookingId) async {
    final raw = await getRawReportData(bookingId);
    if (raw == null) return null;

    final reportId = raw['_id']?.toString().trim() ?? '';
    final isDraft = raw['isDraft'] == true;
    final savedLayout = raw['savedPdfLayout']?.toString().trim() ?? '';
    final pdfFmt = raw['pdfFormat']?.toString().trim();

    return ReportReadyInfo(
      reportId: reportId,
      bookingId: raw['bookingId']?.toString().trim().isNotEmpty == true
          ? raw['bookingId'].toString().trim()
          : bookingId,
      patientName: raw['patientName']?.toString().trim() ?? 'Patient',
      assignedPdfFormat: (pdfFmt != null && pdfFmt.isNotEmpty) ? pdfFmt : null,
      isDraft: isDraft,
      hasSavedLayout: savedLayout.isNotEmpty,
      isSignedOff: raw['signoff'] == true || raw['isSignedOff'] == true,
    );
  }

  // Fetch Initial Tests for Barcode / Booking
  static Future<List<ReportCategoryModel>> getBarcodeTests(String bookingId) async {
    final response = await ApiClient.post(
      '/api/v1/user/getbarcodeTests',
      body: {'bookingId': bookingId},
    );

    if (!response.success) return [];

    final data = response.data;
    if (data is! List || data.isEmpty) return [];

    final firstGroup = data[0];
    if (firstGroup is! Map) return [];

    final singleTests = firstGroup['singleTests'] is List ? firstGroup['singleTests'] as List : [];
    final panels = firstGroup['panels'] is List ? firstGroup['panels'] as List : [];

    final Map<String, List<ReportParameterModel>> categoryMap = {};

    for (final t in singleTests) {
      if (t is! Map<String, dynamic>) continue;
      String catName = 'General Routine';
      if (t['category'] is Map) {
        catName = t['category']['category']?.toString() ?? 'General Routine';
      } else if (t['category'] != null) {
        catName = t['category'].toString();
      }

      final param = ReportParameterModel(
        testId: t['_id']?.toString() ?? t['testId']?.toString() ?? '',
        testName: t['Name']?.toString() ?? t['testName']?.toString() ?? '',
        result: t['default_result']?.toString() ?? '',
        unit: t['Unit']?.toString() ?? t['unit']?.toString() ?? '',
        normalRange: t['General_Normal_Range']?.toString() ?? t['normalRange']?.toString() ?? '',
      );

      categoryMap.putIfAbsent(catName, () => []).add(param);
    }

    for (final p in panels) {
      if (p is! Map<String, dynamic>) continue;
      final panelName = p['name']?.toString() ?? p['panelName']?.toString() ?? 'Panel Group';
      final panelTests = p['testsId'] is List ? p['testsId'] as List : [];

      final List<ReportParameterModel> panelParams = [];
      for (final pt in panelTests) {
        if (pt is! Map<String, dynamic>) continue;
        panelParams.add(
          ReportParameterModel(
            testId: pt['_id']?.toString() ?? pt['testId']?.toString() ?? '',
            testName: pt['Name']?.toString() ?? pt['testName']?.toString() ?? '',
            result: pt['default_result']?.toString() ?? '',
            unit: pt['Unit']?.toString() ?? pt['unit']?.toString() ?? '',
            normalRange: pt['General_Normal_Range']?.toString() ?? pt['normalRange']?.toString() ?? '',
          ),
        );
      }

      categoryMap[panelName] = panelParams;
    }

    return categoryMap.entries.map((entry) {
      return ReportCategoryModel(
        category: entry.key,
        title: entry.key,
        type: 'test',
        tests: entry.value,
      );
    }).toList();
  }

  // Save Report (Draft or Final Sign-Off)
  static Future<bool> saveReportData({
    required Map<String, dynamic> booking,
    required String bookingId,
    required List<ReportCategoryModel> categories,
    String notes = '',
    bool isFinalSignOff = false,
  }) async {
    final todayStr = DateTime.now().toIso8601String();

    final payload = {
      'booking': {
        ...booking,
        'bookingId': bookingId,
        'status': isFinalSignOff ? 'completed' : 'in-process',
      },
      'reg_id': bookingId,
      'bookingId': bookingId,
      'reportData': categories.map((c) => c.toJson()).toList(),
      'reportMeta': {},
      'moredetails': notes,
      'saveMode': isFinalSignOff ? 'final' : 'saveOnly',
      'categorized': true,
      'registeredOn': booking['date']?.toString() ?? todayStr,
      'reportedOn': todayStr,
    };

    final response = await ApiClient.post('/api/v1/user/saveReportData', body: payload);
    if (!response.success) {
      throw Exception(response.message ?? 'Failed to save test results');
    }

    return true;
  }

  // Download Report PDF 100% generated on the server (exact parity with website allcases.js & Search_booking.js)
  // IMPORTANT:
  //   withLetterhead = true  => checkBox: false (and NO DownloadPdf:true so server includes letterhead!)
  //   withLetterhead = false => checkBox: true  (clean print-ready PDF without letterhead)
  static Future<String> downloadReportPdf({
    required String bookingId,
    String? patientName,
    String? knownReportId,
    bool withLetterhead = true,
  }) async {
    final baseUrl = await StorageService.getServerUrl();
    final token = await StorageService.getToken();

    String? reportId = knownReportId;
    String resolvedBookingId = bookingId;
    String resolvedPatientName = (patientName != null && patientName.trim().isNotEmpty)
        ? patientName.trim()
        : 'Report';

    if (reportId == null || reportId.isEmpty) {
      final rawReport = await getRawReportData(bookingId);
      reportId = rawReport?['_id']?.toString();
      final isDraft = rawReport?['isDraft'] == true;

      if (reportId == null || reportId.isEmpty || isDraft) {
        throw Exception(
          'Report is not ready yet. Please enter and save test results before downloading the PDF.',
        );
      }

      resolvedBookingId = rawReport?['bookingId']?.toString() ?? bookingId;
      if (patientName == null || patientName.trim().isEmpty) {
        resolvedPatientName = rawReport?['patientName']?.toString() ?? 'Report';
      }
    }

    final cleanPatient = resolvedPatientName.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final lhTag = withLetterhead ? 'WithLetterhead' : 'WithoutLetterhead';
    final filename = '${cleanPatient}_${resolvedBookingId}_$lhTag.pdf';

    // Exact 4-key payload matching website allcases.js:552 & Search_booking.js:533
    // Do NOT send DownloadPdf:true — on the server `if (checkBox || DownloadPdf)` strips letterhead!
    final uri = Uri.parse('$baseUrl/api/v1/user/get-pdf');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/pdf, application/json',
    };
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    final payload = jsonEncode({
      'value1': reportId,
      'bookingId': resolvedBookingId,
      'checkBox': withLetterhead ? false : true,
      'auditAction': 'DOWNLOAD',
    });

    final response = await http
        .post(uri, headers: headers, body: payload)
        .timeout(const Duration(seconds: 75));

    if (response.statusCode != 200) {
      String errMsg = 'PDF download failed (Status ${response.statusCode})';
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map && decoded['message'] != null) {
          errMsg = decoded['message'].toString();
        }
      } catch (_) {}
      throw Exception(errMsg);
    }

    final bytes = response.bodyBytes;
    if (bytes.isEmpty) {
      throw Exception('Server returned an empty PDF response.');
    }

    final contentType = (response.headers['content-type'] ?? '').toLowerCase();
    if (contentType.contains('application/json')) {
      String errMsg = 'Server could not generate PDF.';
      try {
        final decoded = jsonDecode(utf8.decode(bytes));
        if (decoded is Map && decoded['message'] != null) {
          errMsg = decoded['message'].toString();
        }
      } catch (_) {}
      throw Exception(errMsg);
    }

    return await DownloadHelper.saveAndDownloadPdf(
      bytes: bytes,
      filename: filename,
    );
  }

  // Open Report PDF
  static Future<void> openReportPdf(String filePath) async {
    await DownloadHelper.openPdf(filePath);
  }

  // Share Report PDF via WhatsApp / System Share
  static Future<void> shareReportPdf(String filePath, {String? patientName}) async {
    await DownloadHelper.sharePdf(filePath, patientName: patientName);
  }
}
