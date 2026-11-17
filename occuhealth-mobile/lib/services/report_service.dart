import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/report_model.dart';
import 'api_client.dart';
import 'download_helper.dart';
import 'storage_service.dart';

class ReportService {
  // Fetch Existing Saved Report
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

    // Single Tests
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

    // Panels
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
      'saveMode': isFinalSignOff ? 'signOff' : 'saveOnly',
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

  // Download Report PDF
  static Future<String> downloadReportPdf({
    required String bookingId,
    String? patientName,
  }) async {
    final baseUrl = await StorageService.getServerUrl();
    final token = await StorageService.getToken();

    final cleanPatient = (patientName ?? 'Report').replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final filename = 'OccuHealth_${cleanPatient}_$bookingId.pdf';

    final uri = Uri.parse('$baseUrl/api/v1/user/get-pdf');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/pdf, application/json',
    };
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    final payload = jsonEncode({
      'bookingId': bookingId,
      'value1': bookingId,
      'DownloadPdf': true,
      'auditAction': 'DOWNLOAD',
    });

    final response = await http
        .post(uri, headers: headers, body: payload)
        .timeout(const Duration(seconds: 45));

    if (response.statusCode != 200) {
      throw Exception('PDF download failed with status ${response.statusCode}');
    }

    return await DownloadHelper.saveAndDownloadPdf(
      bytes: response.bodyBytes,
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
